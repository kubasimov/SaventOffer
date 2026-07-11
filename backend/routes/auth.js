const express = require('express');
const router = express.Router();
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const pool = require('../db/pool');
const { enforcePasswordPolicy } = require('../utils/password');

const JWT_EXPIRES = '7d';

function sign(user) {
  return { token: jwt.sign({ id: user.id, email: user.email, imie: user.imie_nazwisko, rola: user.rola }, jwtSecret, { expiresIn: JWT_EXPIRES }), user: { id: user.id, email: user.email, imie: user.imie_nazwisko, rola: user.rola } };
}

router.post('/login', async (req, res) => {
  const { email, haslo } = req.body;
  const u = await pool.query('SELECT * FROM users WHERE email = $1 AND aktywny = true', [email]);
  if (!u.rows[0] || !await bcrypt.compare(haslo, u.rows[0].haslo_hash)) return res.status(401).json({ error: 'Nieprawidlowy email lub haslo' });
  res.json(sign(u.rows[0]));
});

router.get('/me', async (req, res) => {
  const auth = req.headers.authorization;
  if (!auth?.startsWith('Bearer ')) return res.status(401).json({ error: 'Brak tokenu' });
  try {
    const decoded = jwt.verify(auth.slice(7), jwtSecret);
    const user = (await pool.query('SELECT id,email,imie_nazwisko,rola FROM users WHERE id = $1', [decoded.id])).rows[0];
    if (!user) return res.status(401).json({ error: 'Uzytkownik nie istnieje' });
    res.json(user);
  } catch { res.status(401).json({ error: 'Nieprawidlowy token' }); }
});

router.post('/zmien-haslo', async (req, res) => {
  const auth = req.headers.authorization;
  if (!auth?.startsWith('Bearer ')) return res.status(401).json({ error: 'Brak tokenu' });
  const { stare_haslo, nowe_haslo } = req.body;
  if (!stare_haslo || !nowe_haslo) return res.status(400).json({ error: 'Podaj stare i nowe haslo' });
  try { enforcePasswordPolicy(nowe_haslo); } catch (e) { return res.status(400).json({ error: e.message }); }
  try {
    const decoded = jwt.verify(auth.slice(7), jwtSecret);
    const user = (await pool.query('SELECT * FROM users WHERE id = $1', [decoded.id])).rows[0];
    if (!await bcrypt.compare(stare_haslo, user.haslo_hash)) return res.status(401).json({ error: 'Nieprawidlowe stare haslo' });
    const hash = await bcrypt.hash(nowe_haslo, 11);
    await pool.query('UPDATE users SET haslo_hash = $1 WHERE id = $2', [hash, decoded.id]);
    res.json({ success: true });
  } catch { res.status(500).json({ error: 'Blad zmiany hasla' }); }
});

module.exports = router;
