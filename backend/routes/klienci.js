const express = require('express');
const router = express.Router();
const pool = require('../db/pool');

// Pobierz wszystkich klientów
router.get('/', async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT * FROM clients ORDER BY nazwa ASC'
    );
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Dodaj klienta
router.post('/', async (req, res) => {
  const { nazwa, kontakt, email, telefon, uwagi } = req.body;
  try {
    const result = await pool.query(
      `INSERT INTO clients (nazwa, kontakt, email, telefon, uwagi)
       VALUES ($1, $2, $3, $4, $5) RETURNING *`,
      [nazwa, kontakt || null, email || null, telefon || null, uwagi || null]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Edytuj klienta
router.put('/:id', async (req, res) => {
  const { id } = req.params;
  const { nazwa, kontakt, email, telefon, uwagi } = req.body;
  try {
    const result = await pool.query(
      `UPDATE clients
       SET nazwa=$1, kontakt=$2, email=$3, telefon=$4, uwagi=$5
       WHERE id=$6 RETURNING *`,
      [nazwa, kontakt || null, email || null, telefon || null, uwagi || null, id]
    );
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;

// Pobierz jednego klienta
router.get('/:id', async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT * FROM clients WHERE id = $1', [req.params.id]
    );
    if (!result.rows.length) return res.status(404).json({ error: 'Nie znaleziono' });
    res.json(result.rows[0]);
  } catch (err) { res.status(500).json({ error: err.message }); }
});
module.exports = router;
