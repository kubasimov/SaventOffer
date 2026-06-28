const express = require('express');
const router = express.Router();
const pool = require('../db/pool');

// Pobierz klientów z paginacją
router.get('/', async (req, res) => {
  try {
    // ?all=true — zwraca wszystkie rekordy (do dropdownów)
    if (req.query.all === 'true') {
      const result = await pool.query('SELECT * FROM clients ORDER BY nazwa ASC');
      return res.json(result.rows);
    }

    const page = Math.max(1, parseInt(req.query.page) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit) || 20));
    const offset = (page - 1) * limit;

    const countResult = await pool.query('SELECT COUNT(*) FROM clients');
    const total = parseInt(countResult.rows[0].count);

    const result = await pool.query(
      'SELECT * FROM clients ORDER BY nazwa ASC LIMIT $1 OFFSET $2',
      [limit, offset]
    );
    res.json({ rows: result.rows, total, page, limit, pages: Math.ceil(total / limit) });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Dodaj klienta
router.post('/', async (req, res) => {
  const { nazwa, adres, kontakt, email, telefon, uwagi } = req.body;
  try {
    const result = await pool.query(
      `INSERT INTO clients (nazwa, adres, kontakt, email, telefon, uwagi)
       VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
      [nazwa, adres || null, kontakt || null, email || null, telefon || null, uwagi || null]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Edytuj klienta
router.put('/:id', async (req, res) => {
  const { id } = req.params;
  const { nazwa, adres, kontakt, email, telefon, uwagi } = req.body;
  try {
    const result = await pool.query(
      `UPDATE clients
       SET nazwa=$1, adres=$2, kontakt=$3, email=$4, telefon=$5, uwagi=$6
       WHERE id=$7 RETURNING *`,
      [nazwa, adres || null, kontakt || null, email || null, telefon || null, uwagi || null, id]
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

// Usuń klienta
router.delete('/:id', async (req, res) => {
  try {
    const refs = await pool.query('SELECT COUNT(*) FROM offers WHERE klient_id=$1', [req.params.id]);
    if (parseInt(refs.rows[0].count) > 0) {
      return res.status(400).json({ error: 'Nie można usunąć klienta, który ma przypisane oferty' });
    }
    const r = await pool.query("DELETE FROM clients WHERE id=$1 RETURNING id, nazwa", [req.params.id]);
    if (!r.rows.length) return res.status(404).json({ error: 'Nie znaleziono' });
    res.json({ success: true, usuniety: r.rows[0] });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

module.exports = router;
