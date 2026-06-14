const express = require('express');
const router = express.Router();
const pool = require('../db/pool');

// Pobierz wszystkie pozycje z aliasami
router.get('/', async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT * FROM price_list WHERE aktywny = true ORDER BY nazwa ASC'
    );
    for (let p of result.rows) {
      const aliases = await pool.query(
        'SELECT * FROM price_list_aliases WHERE cennik_id = $1 ORDER BY utworzony ASC',
        [p.id]
      );
      p.aliasy = aliases.rows;
    }
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Dodaj pozycję
router.post('/', async (req, res) => {
  const { nazwa, opis, cena, jednostka } = req.body;
  try {
    const result = await pool.query(
      `INSERT INTO price_list (nazwa, opis, cena, jednostka)
       VALUES ($1, $2, $3, $4) RETURNING *`,
      [nazwa, opis || null, cena, jednostka]
    );
    result.rows[0].aliasy = [];
    res.status(201).json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Edytuj pozycję
router.put('/:id', async (req, res) => {
  const { id } = req.params;
  const { nazwa, opis, cena, jednostka, aktywny } = req.body;
  try {
    const result = await pool.query(
      `UPDATE price_list
       SET nazwa=$1, opis=$2, cena=$3, jednostka=$4, aktywny=$5, zaktualizowany=NOW()
       WHERE id=$6 RETURNING *`,
      [nazwa, opis || null, cena, jednostka, aktywny, id]
    );
    const aliases = await pool.query(
      'SELECT * FROM price_list_aliases WHERE cennik_id = $1', [id]
    );
    result.rows[0].aliasy = aliases.rows;
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Usuń pozycję (soft delete)
router.delete('/:id', async (req, res) => {
  const { id } = req.params;
  try {
    await pool.query('UPDATE price_list SET aktywny=false WHERE id=$1', [id]);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Dodaj alias
router.post('/:id/aliasy', async (req, res) => {
  const { alias } = req.body;
  try {
    const result = await pool.query(
      'INSERT INTO price_list_aliases (cennik_id, alias) VALUES ($1, $2) RETURNING *',
      [req.params.id, alias]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Usuń alias
router.delete('/aliasy/:alias_id', async (req, res) => {
  try {
    await pool.query('DELETE FROM price_list_aliases WHERE id=$1', [req.params.alias_id]);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
