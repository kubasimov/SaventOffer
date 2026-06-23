const express = require('express');
const router = express.Router();
const pool = require('../db/pool');
const { exec } = require('child_process');
const path = require('path');
const fs = require('fs');
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
    const klient_dane = req.query.klient_dane ? JSON.parse(req.query.klient_dane) : null
    const specyfikacja = req.query.specyfikacja ? JSON.parse(req.query.specyfikacja) : []
    const kategoria = req.query.kategoria || ''

    const dane = {
      numer: oferta.rows[0].numer,
      klient: oferta.rows[0].klient_nazwa || '',
      klient_dane,
      zalozenia,
      specyfikacja,
      kategoria,
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

})
module.exports = router;
