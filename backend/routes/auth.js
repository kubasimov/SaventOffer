const express = require('express');
const router = express.Router();
const pool = require('../db/pool');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET || 'savento_secret_2026'
const JWT_EXPIRES = '7d'

router.post('/login', async (req, res) => {
  const { email, haslo } = req.body;
  try {
    const result = await pool.query(
      'SELECT * FROM users WHERE email = $1 AND aktywny = true', [email]
    );
    if (!result.rows.length)
      return res.status(401).json({ error: 'Nieprawidłowy email lub hasło' });
    const user = result.rows[0];
    const ok = await bcrypt.compare(haslo, user.haslo_hash);
    if (!ok) return res.status(401).json({ error: 'Nieprawidłowy email lub hasło' });
    const token = jwt.sign(
      { id: user.id, email: user.email, imie: user.imie_nazwisko, rola: user.rola },
      JWT_SECRET, { expiresIn: JWT_EXPIRES }
    );
    res.json({ token, user: { id: user.id, email: user.email, imie: user.imie_nazwisko, rola: user.rola } });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.get('/me', async (req, res) => {
  const auth = req.headers.authorization;
  if (!auth?.startsWith('Bearer ')) return res.status(401).json({ error: 'Brak tokenu' });
  try {
    const decoded = jwt.verify(auth.slice(7), JWT_SECRET);
    const result = await pool.query(
      'SELECT id, email, imie_nazwisko as imie, rola FROM users WHERE id = $1', [decoded.id]
    );
    if (!result.rows.length) return res.status(401).json({ error: 'Użytkownik nie istnieje' });
    res.json(result.rows[0]);
  } catch (err) { res.status(401).json({ error: 'Nieprawidłowy token' }); }
});

router.post('/zmien-haslo', async (req, res) => {
  const auth = req.headers.authorization;
  if (!auth?.startsWith('Bearer ')) return res.status(401).json({ error: 'Brak tokenu' });
  const { stare_haslo, nowe_haslo } = req.body;
  try {
    const decoded = jwt.verify(auth.slice(7), JWT_SECRET);
    const result = await pool.query('SELECT * FROM users WHERE id = $1', [decoded.id]);
    const user = result.rows[0];
    const ok = await bcrypt.compare(stare_haslo, user.haslo_hash);
    if (!ok) return res.status(401).json({ error: 'Nieprawidłowe stare hasło' });
    const hash = await bcrypt.hash(nowe_haslo, 10);
    await pool.query('UPDATE users SET haslo_hash = $1 WHERE id = $2', [hash, decoded.id]);
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

module.exports = router;

// Google OAuth
const { OAuth2Client } = require('google-auth-library');
const googleClient = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

// Weryfikacja tokenu Google (z frontendu)
router.post('/google', async (req, res) => {
  const { credential } = req.body;
  try {
    const ticket = await googleClient.verifyIdToken({
      idToken: credential,
      audience: process.env.GOOGLE_CLIENT_ID
    });
    const payload = ticket.getPayload();
    const email = payload.email;
    const imie = payload.name;

    // Sprawdź czy użytkownik istnieje
    let result = await pool.query('SELECT * FROM users WHERE email = $1', [email]);

    if (!result.rows.length) {
      // Nowy użytkownik — utwórz konto (bez hasła)
      const hash = await require('bcrypt').hash(Math.random().toString(36), 10);
      result = await pool.query(
        `INSERT INTO users (email, haslo_hash, imie_nazwisko, rola)
         VALUES ($1, $2, $3, 'pracownik') RETURNING *`,
        [email, hash, imie]
      );
    }

    const user = result.rows[0];
    if (!user.aktywny) return res.status(401).json({ error: 'Konto zablokowane' });

    const jwt = require('jsonwebtoken');
    const token = jwt.sign(
      { id: user.id, email: user.email, imie: user.imie_nazwisko, rola: user.rola },
      process.env.JWT_SECRET || 'savento_secret_2026',
      { expiresIn: '7d' }
    );
    res.json({ token, user: { id: user.id, email: user.email, imie: user.imie_nazwisko, rola: user.rola } });
  } catch (err) {
    console.error('Google OAuth error:', err.message);
    res.status(401).json({ error: 'Nieprawidłowy token Google' });
  }
});
