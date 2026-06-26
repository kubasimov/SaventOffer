const express = require('express');
const router = express.Router();
const pool = require('../db/pool');
const { pobierzPozycjeZWartoscia, zKorekta } = require('../utils/calc');

async function generujNumer() {
  const now = new Date();
  const dd = String(now.getDate()).padStart(2, '0');
  const mm = String(now.getMonth() + 1).padStart(2, '0');
  const yyyy = now.getFullYear();
  const dataPart = `${dd}_${mm}_${yyyy}`;
  const res = await pool.query(`SELECT COUNT(*) FROM offers WHERE numer LIKE $1`, [`%_${dataPart}`]);
  const nr = String(parseInt(res.rows[0].count) + 1).padStart(2, '0');
  return `OFERTA_CENOWA_${nr}_${dataPart}`;
}

router.get('/', async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT o.*, o.nazwa as oferta_nazwa, c.nazwa as klient_nazwa
      FROM offers o LEFT JOIN clients c ON o.klient_id = c.id
      ORDER BY o.utworzony DESC
    `);
    res.json(result.rows);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.get('/:id', async (req, res) => {
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
      const pozycje = await pool.query(`
        SELECT * FROM table_items WHERE tabela_id = $1 ORDER BY kolejnosc ASC
      `, [t.id]);
      for (let p of pozycje.rows) {
        const dims = await pool.query(`
          SELECT * FROM item_dimensions WHERE item_id = $1 ORDER BY kolejnosc ASC
        `, [p.id]);
        p.wymiary = dims.rows;
      }
      t.pozycje = pozycje.rows;
    }
    res.json({ ...oferta.rows[0], tabele: tabele.rows });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.post('/', async (req, res) => {
  const { klient_id, uwagi } = req.body;
  try {
    const numer = await generujNumer();
    const result = await pool.query(`
      INSERT INTO offers (klient_id, numer, uwagi) VALUES ($1, $2, $3) RETURNING *
    `, [klient_id || null, numer, uwagi || null]);
    res.status(201).json(result.rows[0]);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.put('/:id', async (req, res) => {
  const { klient_id, status, uwagi, korekta_globalna, numer, nazwa } = req.body;
  try {
    const result = await pool.query(`
      UPDATE offers SET klient_id=$1, status=$2, uwagi=$3,
        korekta_globalna=COALESCE($4, korekta_globalna),
        numer=COALESCE($5, numer),
        nazwa=COALESCE($6, nazwa)
      WHERE id=$7 RETURNING *
    `, [klient_id || null, status, uwagi || null,
        korekta_globalna !== undefined ? korekta_globalna : null,
        numer || null,
        nazwa !== undefined ? nazwa : null,
        req.params.id]);
    res.json(result.rows[0]);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.post('/:id/tabele', async (req, res) => {
  const { nazwa_mebla, kolejnosc } = req.body;
  try {
    const result = await pool.query(`
      INSERT INTO furniture_tables (oferta_id, nazwa_mebla, kolejnosc)
      VALUES ($1, $2, $3) RETURNING *
    `, [req.params.id, nazwa_mebla, kolejnosc || 1]);
    res.status(201).json({ ...result.rows[0], pozycje: [] });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.put('/tabele/:tabela_id', async (req, res) => {
  const { nazwa_mebla, korekta_pct, razem_przed, razem } = req.body;
  try {
    const result = await pool.query(`
      UPDATE furniture_tables
      SET nazwa_mebla=$1, korekta_pct=$2, razem_przed=$3, razem=$4
      WHERE id=$5 RETURNING *
    `, [nazwa_mebla, korekta_pct || 0, razem_przed || 0, razem || 0, req.params.tabela_id]);
    res.json(result.rows[0]);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.delete('/tabele/:tabela_id', async (req, res) => {
  try {
    await pool.query('DELETE FROM furniture_tables WHERE id=$1', [req.params.tabela_id]);
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// Dodaj pozycję (bez wymiarów - te dodawane osobno)
router.post('/tabele/:tabela_id/pozycje', async (req, res) => {
  const { cennik_id, nazwa, jednostka, cena_jedn, kolejnosc } = req.body;
  try {
    const result = await pool.query(`
      INSERT INTO table_items (tabela_id, cennik_id, nazwa, jednostka, cena_jedn, ilosc, kolejnosc)
      VALUES ($1,$2,$3,$4,$5,0,$6) RETURNING *
    `, [req.params.tabela_id, cennik_id || null, nazwa, jednostka, cena_jedn, kolejnosc || 1]);
    res.status(201).json({ ...result.rows[0], wymiary: [] });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.delete('/pozycje/:pozycja_id', async (req, res) => {
  try {
    await pool.query('DELETE FROM table_items WHERE id=$1', [req.params.pozycja_id]);
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// Dodaj wymiar do pozycji
router.post('/pozycje/:item_id/wymiary', async (req, res) => {
  const { wymiar_x, wymiar_y, ilosc, kolejnosc } = req.body;
  try {
    const result = await pool.query(`
      INSERT INTO item_dimensions (item_id, wymiar_x, wymiar_y, ilosc, kolejnosc)
      VALUES ($1,$2,$3,$4,$5) RETURNING *
    `, [req.params.item_id, wymiar_x || null, wymiar_y || null, ilosc, kolejnosc || 1]);
    res.status(201).json(result.rows[0]);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// Usuń wymiar
router.delete('/wymiary/:dim_id', async (req, res) => {
  try {
    await pool.query('DELETE FROM item_dimensions WHERE id=$1', [req.params.dim_id]);
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

module.exports = router;

// Eksport oferty do CSV
router.get('/:id/csv', async (req, res) => {
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

    const kortGlobalnaCSV = parseFloat(oferta.rows[0].korekta_globalna) || 0

    let csv = '\uFEFF' // BOM dla Excel
    csv += `Numer oferty;${oferta.rows[0].numer}\n`
    csv += `Klient;${oferta.rows[0].klient_nazwa || ''}\n`
    csv += `Data;${new Date(oferta.rows[0].data_oferty).toLocaleDateString('pl-PL')}\n`
    csv += '\n'

    for (const tabela of tabele.rows) {
      csv += `${tabela.nazwa_mebla}\n`
      const kortLaczCSV = (parseFloat(tabela.korekta_pct) || 0) + kortGlobalnaCSV
      csv += `Pozycja;Ilość;Jednostka;Cena jedn.;Wartość\n`

      const pozycjeRows = await pobierzPozycjeZWartoscia(pool, tabela.id)
      let sumaTabeli = 0
      for (const p of pozycjeRows) {
        const ilosc = parseFloat(p.laczna_ilosc || 0).toFixed(2).replace('.', ',')
        const wartoscZKort = zKorekta(p.wartosc_bazowa, kortLaczCSV)
        sumaTabeli += wartoscZKort
        csv += `${p.nazwa};${ilosc};${p.jednostka};;;${wartoscZKort.toFixed(2).replace('.', ',')}\n`
      }
      const razem = sumaTabeli.toFixed(2).replace('.', ',')
      csv += `RAZEM;;;; ${razem}\n`
      csv += '\n'
    }

    const nazwaPliku = `${oferta.rows[0].numer}.csv`
    res.setHeader('Content-Type', 'text/csv; charset=utf-8')
    res.setHeader('Content-Disposition', `attachment; filename="${nazwaPliku}"`)
    res.send(csv)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
});

// Usuń ofertę
router.delete('/:id', async (req, res) => {
  try {
    await pool.query('DELETE FROM offers WHERE id = $1', [req.params.id]);
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// Pobierz szczegóły jednej tabeli z pozycjami i wymiarami
router.get('/tabele-szczegoly/:tabela_id', async (req, res) => {
  try {
    const tabela = await pool.query(
      'SELECT * FROM furniture_tables WHERE id = $1', [req.params.tabela_id]
    )
    if (!tabela.rows.length) return res.status(404).json({ error: 'Nie znaleziono' })

    const pozycje = await pool.query(
      'SELECT * FROM table_items WHERE tabela_id = $1 ORDER BY kolejnosc ASC',
      [req.params.tabela_id]
    )
    for (let p of pozycje.rows) {
      const dims = await pool.query(
        'SELECT * FROM item_dimensions WHERE item_id = $1 ORDER BY kolejnosc ASC', [p.id]
      )
      p.wymiary = dims.rows
    }
    res.json({ ...tabela.rows[0], pozycje: pozycje.rows })
  } catch (err) { res.status(500).json({ error: err.message }) }
})

// Edytuj wymiar
router.put('/wymiary/:dim_id', async (req, res) => {
  const { wymiar_x, wymiar_y, ilosc } = req.body;
  try {
    const nowaIlosc = wymiar_x && wymiar_y
      ? parseFloat(wymiar_x) * parseFloat(wymiar_y)
      : parseFloat(ilosc);
    const result = await pool.query(
      `UPDATE item_dimensions SET wymiar_x=$1, wymiar_y=$2, ilosc=$3 WHERE id=$4 RETURNING *`,
      [wymiar_x || null, wymiar_y || null, nowaIlosc, req.params.dim_id]
    );
    res.json(result.rows[0]);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// Edytuj nazwę i/lub cenę pozycji
router.put('/pozycje/:pozycja_id', async (req, res) => {
  const { nazwa, cena_jedn } = req.body;
  try {
    const result = await pool.query(
      `UPDATE table_items SET nazwa=$1, cena_jedn=COALESCE($2, cena_jedn) WHERE id=$3 RETURNING *`,
      [nazwa, cena_jedn || null, req.params.pozycja_id]
    );
    res.json(result.rows[0]);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// Dodaj wpis do logu dyktowania
router.post('/tabele/:tabela_id/dyktowanie', async (req, res) => {
  const { tekst, rozpoznano, sukces } = req.body;
  try {
    const result = await pool.query(
      `INSERT INTO dictation_log (tabela_id, tekst, rozpoznano, sukces) VALUES ($1,$2,$3,$4) RETURNING *`,
      [req.params.tabela_id, tekst, rozpoznano || null, !!sukces]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// Pobierz log dyktowania dla tabeli
router.get('/tabele/:tabela_id/dyktowanie', async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT * FROM dictation_log WHERE tabela_id = $1 ORDER BY utworzono ASC`,
      [req.params.tabela_id]
    );
    res.json(result.rows);
  } catch (err) { res.status(500).json({ error: err.message }); }
});
module.exports = router;
