const express = require('express');
const router = express.Router();
const pool = require('../db/pool');
const { exec } = require('child_process');
const path = require('path');
const fs = require('fs');
const { pobierzPozycjeZWartoscia, zKorekta, round2 } = require('../utils/calc');

router.get('/:id', async (req, res) => {
  try {
    // Pobierz ofertę z bazy
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

    const zalozenia = req.query.zalozenia || ''

    const dane = {
      numer: oferta.rows[0].numer,
      klient: oferta.rows[0].klient_nazwa || '',
      zalozenia: zalozenia,
      tabele: tabele.rows
    };

    // Nazwa pliku PDF
    const nazwaPliku = `${oferta.rows[0].numer}.pdf`;
    const outputPath = path.join('/opt/savento/pdf-output', nazwaPliku);

    // Wywołaj skrypt Python
    const daneJson = JSON.stringify(dane).replace(/'/g, "\\'");
    const cmd = `python3 /opt/savento/backend/generate_pdf.py '${daneJson}' '${outputPath}'`;

    exec(cmd, (error, stdout, stderr) => {
      if (error) {
        console.error('PDF error:', stderr);
        return res.status(500).json({ error: 'Błąd generowania PDF', details: stderr });
      }

      // Wyślij plik
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename="${nazwaPliku}"`);
      const fileStream = fs.createReadStream(outputPath);
      fileStream.pipe(res);
    });

  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
