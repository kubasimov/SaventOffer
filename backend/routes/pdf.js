const express = require('express');
const router = express.Router();
const pool = require('../db/pool');
const multer = require('multer');
const XLSX = require('xlsx');
const fs = require('fs');
const { exec } = require('child_process');
const path = require('path');
const { pobierzPozycjeZWartoscia, zKorekta, round2 } = require('../utils/calc');

// Pobierz dostępne kategorie obrazów

router.get('/kategorie', async (req, res) => {
  try {
    const nodePath = require('path')
    const nodeFs = require('fs')
    const obrazyDir = '/opt/savento/backend/obrazy'
    if (!nodeFs.existsSync(obrazyDir)) return res.json([])
    const kategorie = nodeFs.readdirSync(obrazyDir)
      .filter(f => nodeFs.statSync(nodePath.join(obrazyDir, f)).isDirectory())
      .map(nazwa => {
        const pliki = nodeFs.readdirSync(nodePath.join(obrazyDir, nazwa))
          .filter(f => f.match(/^\d+\.pdf$/))
          .length
        return { nazwa, pliki }
      })
      .filter(k => k.pliki > 0)
      .sort((a, b) => a.nazwa.localeCompare(b.nazwa, 'pl'))
    res.json(kategorie)
  } catch (err) { res.status(500).json({ error: err.message }) }
})

// Pobierz domyślny tekst założeń z pliku
router.get('/zalozenia-domyslne', async (req, res) => {
  try {
    const fs = require('fs')
    const path = '/opt/savento/backend/obrazy/ZALOZENIA.txt'
    if (!fs.existsSync(path)) return res.json({ tekst: '' })
    const tekst = fs.readFileSync(path, 'utf8')
    res.json({ tekst: tekst.trim() })
  } catch (err) { res.status(500).json({ error: err.message }) }
})

// Helper: zapisz JSON do pliku tymczasowego, wywołaj Pythona, posprzątaj
async function generujPrzezPythona(dane, outputPath, res, onCleanup) {
  const danePath = path.join('/tmp', `pdf_dane_${Date.now()}_${Math.random().toString(36).slice(2,10)}.json`);
  fs.writeFileSync(danePath, JSON.stringify(dane), 'utf8');
  const cmd = `python3 /opt/savento/backend/generate_pdf.py '${danePath}' '${outputPath}'`;

  exec(cmd, { timeout: 120000 }, (error, stdout, stderr) => {
    // Zawsze usuń plik z danymi
    try { fs.unlinkSync(danePath); } catch (e) {}
    // Wywołaj dodatkowy cleanup (np. obrazy tymczasowe)
    if (onCleanup) onCleanup();

    if (error) {
      console.error('PDF error:', (stderr || '').slice(0, 500));
      return res.status(500).json({ error: 'Błąd generowania PDF', details: stderr });
    }

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${path.basename(outputPath)}"`);
    const stream = fs.createReadStream(outputPath);
    const cleanup = () => fs.unlink(outputPath, () => {});
    stream.on('error', cleanup);
    stream.on('end', cleanup);
    stream.pipe(res);
  });
}

router.post('/:id', async (req, res) => {
  try {
    const oferta = await pool.query(`
      SELECT o.*, c.nazwa as klient_nazwa
      FROM offers o LEFT JOIN clients c ON o.klient_id = c.id
      WHERE o.id = $1
    `, [req.params.id]);

    if (!oferta.rows.length) return res.status(404).json({ error: 'Nie znaleziono' });

    const tabele = await pool.query(`
      SELECT * FROM furniture_tables WHERE oferta_id = $1 ORDER BY kolejnosc ASC
    `, [req.params.id]);

    for (let t of tabele.rows) {
      t.pozycje = await pobierzPozycjeZWartoscia(pool, t.id);
    }

    const kortGlobalna = parseFloat(oferta.rows[0].korekta_globalna) || 0

    for (const t of tabele.rows) {
      const kortLaczna = (parseFloat(t.korekta_pct) || 0) + kortGlobalna
      for (const p of t.pozycje) {
        p.wartosc_koncowa = zKorekta(p.wartosc_bazowa, kortLaczna)
      }
      const sumaRaw = round2(t.pozycje.reduce((s, p) => s + parseFloat(p.wartosc_bazowa || 0), 0))
      t.razem = zKorekta(sumaRaw, kortLaczna)
    }

    const dane = {
      numer: oferta.rows[0].numer,
      klient: oferta.rows[0].klient_nazwa || '',
      klient_dane: req.body.klient_dane || null,
      zalozenia: req.body.zalozenia || '',
      specyfikacja: req.body.specyfikacja || [],
      kategoria: req.body.kategoria || '',
      tabele: tabele.rows
    };

    const outputPath = path.join('/opt/savento/pdf-output', `${oferta.rows[0].numer}.pdf`);
    generujPrzezPythona(dane, outputPath, res);

  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Generuj PDF z własnymi obrazami (multipart)
const pdfStorage = multer.diskStorage({
  destination: '/tmp/pdf-obrazy/',
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname) || '';
    cb(null, `${Date.now()}-${Math.random().toString(36).slice(2, 10)}${ext}`);
  }
});
const multerPdf = multer({ storage: pdfStorage, limits: { fileSize: 20 * 1024 * 1024 } });
router.post('/:id/z-obrazami', multerPdf.any(), async (req, res) => {
  try {
    const id = req.params.id;
    const zalozenia = req.body.zalozenia || '';
    const klient_dane = req.body.klient_dane ? JSON.parse(req.body.klient_dane) : null;
    const specyfikacja = req.body.specyfikacja ? JSON.parse(req.body.specyfikacja) : [];

    const oferta = await pool.query(`
      SELECT o.*, c.nazwa as klient_nazwa
      FROM offers o LEFT JOIN clients c ON o.klient_id = c.id
      WHERE o.id = $1`, [id]);
    if (!oferta.rows.length) return res.status(404).json({ error: 'Nie znaleziono' });

    const tabele = await pool.query(
      `SELECT * FROM furniture_tables WHERE oferta_id = $1 ORDER BY kolejnosc ASC`, [id]
    );
    for (let t of tabele.rows) {
      t.pozycje = await pobierzPozycjeZWartoscia(pool, t.id);
    }
    const kortGlobalna = parseFloat(oferta.rows[0].korekta_globalna) || 0;
    for (const t of tabele.rows) {
      const kortLaczna = (parseFloat(t.korekta_pct) || 0) + kortGlobalna;
      for (const p of t.pozycje) { p.wartosc_koncowa = zKorekta(p.wartosc_bazowa, kortLaczna); }
      const sumaRaw = round2(t.pozycje.reduce((s, p) => s + parseFloat(p.wartosc_bazowa || 0), 0));
      t.razem = zKorekta(sumaRaw, kortLaczna);
    }

    const obrazyPliki = (req.files || [])
      .filter(f => f.fieldname.startsWith('obraz_'))
      .sort((a, b) => a.fieldname.localeCompare(b.fieldname))
      .map(f => f.path);

    const dane = {
      numer: oferta.rows[0].numer,
      klient: oferta.rows[0].klient_nazwa || '',
      klient_dane,
      zalozenia,
      specyfikacja,
      kategoria: '',
      wlasne_obrazy: obrazyPliki,
      tabele: tabele.rows
    };

    const nazwaPliku = `${oferta.rows[0].numer}.pdf`;
    const outputPath = path.join('/opt/savento/pdf-output', nazwaPliku);

    function cleanupObrazy() {
      const nodeFs = require('fs');
      obrazyPliki.forEach((f) => {
        try { nodeFs.unlinkSync(f); } catch (e) {}
      });
    }

    generujPrzezPythona(dane, outputPath, res, cleanupObrazy);

  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
