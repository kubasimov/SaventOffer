const express = require('express');
const router = express.Router();
const pool = require('../db/pool');

router.get('/', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM ustawienia ORDER BY klucz ASC');
    res.json(result.rows);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.get('/:klucz', async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT * FROM ustawienia WHERE klucz = $1', [req.params.klucz]
    );
    if (!result.rows.length) return res.status(404).json({ error: 'Nie znaleziono' });
    res.json(result.rows[0]);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.put('/:klucz', async (req, res) => {
  const { wartosc } = req.body;
  try {
    const result = await pool.query(
      `INSERT INTO ustawienia (klucz, wartosc)
       VALUES ($1, $2)
       ON CONFLICT (klucz) DO UPDATE
       SET wartosc = $2, zaktualizowany = NOW()
       RETURNING *`,
      [req.params.klucz, wartosc]
    );
    res.json(result.rows[0]);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// Zapisz domyślne założenia do bazy danych
router.post('/zapisz-zalozenia', async (req, res) => {
  try {
    const pool = require('../db/pool');
    const { tekst } = req.body;
    await pool.query(
      `INSERT INTO ustawienia (klucz, wartosc) VALUES ($1, $2)
       ON CONFLICT (klucz) DO UPDATE SET wartosc = $2, zaktualizowany = NOW()`,
      ['domyslne_zalozenia', tekst || '']
    );
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: err.message }) }
});

module.exports = router;
