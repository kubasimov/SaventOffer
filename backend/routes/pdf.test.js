jest.mock('../db/pool', () => ({
  query: jest.fn()
}));

const request = require('supertest');
const express = require('express');
const multer = require('multer');
const fs = require('fs');
const path = require('path');

const pool = require('../db/pool');

const multerPdf = multer({ dest: '/tmp/pdf-obrazy/', limits: { fileSize: 20 * 1024 * 1024 } });
const expectedOutput = path.join('/tmp', 'OFERTA_01_01_2026.pdf');

function createApp() {
  const app = express();
  app.use(multerPdf.any());
  app.use(express.json());
  app.post('/api/pdf/:id/z-obrazami', async (req, res) => {
    try {
      const { pobierzPozycjeZWartoscia, zKorekta, round2 } = require('../utils/calc');
      const id = req.params.id;
      const zalozenia = req.body.zalozenia || '';
      const klient_dane = req.body.klient_dane ? JSON.parse(req.body.klient_dane) : null;
      const specyfikacja = req.body.specyfikacja ? JSON.parse(req.body.specyfikacja) : [];

      const oferta = (await pool.query(`
        SELECT o.*, c.nazwa as klient_nazwa
        FROM offers o LEFT JOIN clients c ON o.klient_id = c.id
        WHERE o.id = $1`, [id])).rows[0];
      if (!oferta) return res.status(404).json({ error: 'Nie znaleziono' });

      const tabele = (await pool.query(
        `SELECT * FROM furniture_tables WHERE oferta_id = $1 ORDER BY kolejnosc ASC`, [id]
      )).rows;
      for (const t of tabele) {
        t.pozycje = await pobierzPozycjeZWartoscia(pool, t.id);
      }
      const kortGlobalna = parseFloat(oferta.korekta_globalna || 0);
      for (const t of tabele) {
        const kortLaczna = (parseFloat(t.korekta_pct || 0)) + kortGlobalna;
        for (const p of t.pozycje) { p.wartosc_koncowa = zKorekta(p.wartosc_bazowa, kortLaczna); }
        const sumaRaw = round2(t.pozycje.reduce((s, p) => s + parseFloat(p.wartosc_bazowa || 0), 0));
        t.razem = zKorekta(sumaRaw, kortLaczna);
      }

      const obrazyPliki = (req.files || [])
        .filter(f => f.fieldname.startsWith('obraz_'))
        .sort((a, b) => a.fieldname.localeCompare(b.fieldname))
        .map(f => f.path);

      const dane = {
        numer: oferta.numer,
        klient: oferta.klient_nazwa || '',
        klient_dane,
        zalozenia,
        specyfikacja,
        kategoria: '',
        wlasne_obrazy: obrazyPliki,
        tabele
      };

      const nazwaPliku = `${oferta.numer}.pdf`;
      const outputPath = path.join('/tmp', nazwaPliku);
      const daneJson = JSON.stringify(dane).replace(/'/g, "\\'");
      const cmd = `python3 ${path.join(__dirname, 'generate_pdf.py')} '${daneJson}' '${outputPath}'`;
      const { exec } = require('child_process');
      exec(cmd, (error, stdout, stderr) => {
        if (error) {
          console.error('PDF error:', stderr);
          return res.status(500).json({ error: 'Błąd generowania PDF', details: stderr });
        }
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `attachment; filename="${nazwaPliku}"`);
        fs.createReadStream(outputPath).pipe(res);
      });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });
  return app;
}

describe('POST /api/pdf/:id/z-obrazami', () => {
  afterEach(() => {
    jest.clearAllMocks();
    jest.resetModules();
  });

  it('returns 404 when offer does not exist', async () => {
    pool.query.mockResolvedValue({ rows: [] });
    const app = createApp();
    const response = await request(app)
      .post('/api/pdf/99999999-9999-9999-9999-999999999999/z-obrazami')
      .attach('field', Buffer.from('img'), 'obraz.jpg');
    expect(response.status).toBe(404);
  });

  it('returns 500 when python script fails', async () => {
    const execMock = (cmd, opts, cb) => {
      if (typeof opts === 'function') cb = opts;
      process.nextTick(() => cb(new Error('boom'), '', 'boom'));
    };
    jest.isolateModules(() => {
      jest.doMock('child_process', () => ({ exec: execMock }));
    });
    pool.query
      .mockResolvedValueOnce({ rows: [{ numer: 'ERR', korekta_globalna: 0 }] })
      .mockResolvedValueOnce({ rows: [] });

    const app = createApp();
    const response = await request(app)
      .post('/api/pdf/err/z-obrazami')
      .attach('field', Buffer.from('img'), 'obraz.jpg');
    expect(response.status).toBe(500);
    expect(response.body.error).toBe('Błąd generowania PDF');
  });

  it('streams pdf from expected output path when valid', async () => {
    const execMock = (cmd, opts, cb) => {
      if (typeof opts === 'function') cb = opts;
      try {
        fs.writeFileSync(expectedOutput, '%PDF-1.4 ok');
        process.nextTick(() => cb(null, `OK:${expectedOutput}`, ''));
      } catch (e) {
        process.nextTick(() => cb(e, '', 'file error'));
      }
    };
    jest.isolateModules(() => {
      jest.doMock('child_process', () => ({ exec: execMock }));
    });
    pool.query
      .mockResolvedValueOnce({ rows: [{ numer: 'OFERTA_01_01_2026', korekta_globalna: 0 }] })
      .mockResolvedValueOnce({ rows: [] });

    const app = createApp();
    const response = await request(app)
      .post('/api/pdf/12345678-1234-1234-1234-123456789012/z-obrazami')
      .attach('field', Buffer.from('img'), 'obraz.jpg');

    expect(response.status).toBe(200);
    expect(response.headers['content-type']).toBe('application/pdf');
    expect(response.headers['content-disposition']).toBe('attachment; filename="OFERTA_01_01_2026.pdf"');
  });
});
