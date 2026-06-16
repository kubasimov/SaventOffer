const express = require('express');
const router = express.Router();
const pool = require('../db/pool');
const bcrypt = require('bcrypt');

// Lista użytkowników
router.get('/', async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT id, email, imie, rola, aktywny, utworzony FROM users ORDER BY utworzony ASC'
    );
    res.json(result.rows);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// Dodaj użytkownika
router.post('/', async (req, res) => {
  const { email, haslo, imie } = req.body;
  try {
    const hash = await bcrypt.hash(haslo, 10);
    const result = await pool.query(
      'INSERT INTO users (email, haslo_hash, imie) VALUES ($1,$2,$3) RETURNING id,email,imie,rola,aktywny',
      [email, hash, imie || null]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    if (err.code === '23505') return res.status(400).json({ error: 'Email już istnieje' });
    res.status(500).json({ error: err.message });
  }
});

// Zmień status aktywności
router.put('/:id', async (req, res) => {
  const { aktywny, imie, haslo } = req.body;
  try {
    if (haslo) {
      const hash = await bcrypt.hash(haslo, 10);
      await pool.query('UPDATE users SET haslo_hash=$1 WHERE id=$2', [hash, req.params.id]);
    }
    const result = await pool.query(
      'UPDATE users SET aktywny=COALESCE($1,aktywny), imie=COALESCE($2,imie) WHERE id=$3 RETURNING id,email,imie,rola,aktywny',
      [aktywny !== undefined ? aktywny : null, imie || null, req.params.id]
    );
    res.json(result.rows[0]);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

module.exports = router;
