const express = require('express');
const router = express.Router();
const pool = require('../db/pool');
const { exec } = require('child_process');
const path = require('path');
const fs = require('fs');

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
      const pozycje = await pool.query(`
        SELECT ti.*,
          CASE
            WHEN ti.jednostka = 'm2' THEN
              COALESCE((
                SELECT SUM(ROUND(ROUND(d.wymiar_x * d.wymiar_y, 2) * ti.cena_jedn, 2))
                FROM item_dimensions d WHERE d.item_id = ti.id
              ), 0)
            ELSE
              COALESCE((
                SELECT SUM(ROUND(d.ilosc * ti.cena_jedn, 2))
                FROM item_dimensions d WHERE d.item_id = ti.id
              ), 0)
          END as wartosc_bazowa
        FROM table_items ti
        WHERE ti.tabela_id = $1
        ORDER BY ti.kolejnosc ASC
      `, [t.id]);
      t.pozycje = pozycje.rows;
    }

    const round2 = v => Math.round((v + Number.EPSILON) * 100) / 100
    const kortGlobalna = parseFloat(oferta.rows[0].korekta_globalna) || 0

    // Przelicz wartości z korektą lokalną + globalną
    for (const t of tabele.rows) {
      const kortLokalna = parseFloat(t.korekta_pct) || 0
      const kortLaczna = kortLokalna + kortGlobalna
      for (const p of t.pozycje) {
        const bazowa = parseFloat(p.wartosc_bazowa || 0)
        p.wartosc_koncowa = round2(bazowa * (1 + kortLaczna / 100))
      }
      const sumaRaw = round2(t.pozycje.reduce((s, p) => s + parseFloat(p.wartosc_bazowa || 0), 0))
      t.razem = round2(sumaRaw * (1 + kortLaczna / 100))
    }

    const dane = {
      numer: oferta.rows[0].numer,
      klient: oferta.rows[0].klient_nazwa || '',
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
