const express = require('express');
const router = express.Router();
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const pool = require('../db/pool');
const { enforcePasswordPolicy } = require('../utils/password');
const { jwtSecret } = require('../config');
const nodemailer = require('nodemailer');

const JWT_EXPIRES = '7d';
const BCRYPT_COST = 13;

// Admin SMTP — powiadomienia
const ADMIN_SMTP = nodemailer.createTransport({
  host: 'n3.smarthost.pl', port: 465, secure: true,
  auth: { user: 'admin@savento.pl', pass: '6R6JZk5sga%ycx%zPR*d' }
});
const ADMIN_EMAIL = 'admin@savento.pl';

function sign(user) {
  return { token: jwt.sign({ id: user.id, email: user.email, imie: user.imie_nazwisko, rola: user.rola }, jwtSecret, { expiresIn: JWT_EXPIRES }), user: { id: user.id, email: user.email, imie_nazwisko: user.imie_nazwisko, rola: user.rola } };
}

async function wyslijPowiadomienie(temat, html) {
  try {
    await ADMIN_SMTP.sendMail({ from: ADMIN_EMAIL, to: ADMIN_EMAIL, subject: temat, html });
  } catch (e) { console.error('Admin email error:', e.message); }
}

// Rejestracja nowego uzytkownika (oczekujacy na akceptacje)
router.post('/rejestracja', async (req, res) => {
  const { email, haslo, imie_nazwisko } = req.body;
  if (!email || !haslo || !imie_nazwisko) return res.status(400).json({ error: 'Wypelnij wszystkie pola' });
  try { enforcePasswordPolicy(haslo); } catch (e) { return res.status(400).json({ error: e.message }); }
  const istnieje = await pool.query('SELECT id FROM users WHERE email = $1', [email]);
  if (istnieje.rows.length) return res.status(409).json({ error: 'Email juz uzywany' });
  const hash = await bcrypt.hash(haslo, BCRYPT_COST);
  await pool.query('INSERT INTO users (email, haslo_hash, imie_nazwisko, rola, aktywny) VALUES ($1,$2,$3,$4,$5)', [email, hash, imie_nazwisko, 'pracownik', false]);
  wyslijPowiadomienie('Nowy uzytkownik czeka na akceptacje', `<p>Nowy użytkownik zarejestrował się w SaventOffer:</p><p><b>Imię:</b> ${imie_nazwisko}<br><b>Email:</b> ${email}</p><p>Zaloguj się i zatwierdź konto w panelu Ustawienia → Użytkownicy.</p>`);
  res.status(201).json({ success: true, message: 'Konto utworzone. Poczekaj na akceptacje administratora.' });
});

// Lista oczekujacych uzytkownikow (tylko admin)
router.get('/oczekujacy', async (req, res) => {
  const users = await pool.query('SELECT id, email, imie_nazwisko, utworzony FROM users WHERE aktywny = false ORDER BY utworzony ASC');
  res.json(users.rows);
});

// Zatwierdz uzytkownika (tylko admin)
router.put('/zatwierdz/:id', async (req, res) => {
  const { rola } = req.body;
  if (!rola || !['admin', 'pracownik'].includes(rola)) return res.status(400).json({ error: 'Niepoprawna rola' });
  const user = await pool.query('UPDATE users SET aktywny = true, rola = $1 WHERE id = $2 AND aktywny = false RETURNING email, imie_nazwisko', [rola, req.params.id]);
  if (!user.rows.length) return res.status(404).json({ error: 'Uzytkownik nie znaleziony lub juz aktywny' });
  wyslijPowiadomienie(`Uzytkownik ${user.rows[0].imie_nazwisko} zatwierdzony`, `<p>Użytkownik <b>${user.rows[0].imie_nazwisko}</b> (${user.rows[0].email}) został zatwierdzony z rolą <b>${rola}</b>.</p>`);
  res.json({ success: true });
});

// Odrzuc uzytkownika (usun)
router.delete('/oczekujacy/:id', async (req, res) => {
  const user = await pool.query('DELETE FROM users WHERE id = $1 AND aktywny = false RETURNING email, imie_nazwisko', [req.params.id]);
  if (!user.rows.length) return res.status(404).json({ error: 'Nie znaleziono' });
  res.json({ success: true });
});

// Logowanie — z powiadomieniem
router.post('/login', async (req, res) => {
  const { email, haslo } = req.body;
  const u = await pool.query('SELECT * FROM users WHERE email = $1 AND aktywny = true', [email]);
  if (!u.rows[0] || !await bcrypt.compare(haslo, u.rows[0].haslo_hash)) return res.status(401).json({ error: 'Nieprawidlowy email lub haslo' });
  wyslijPowiadomienie('Zalogowano do SaventOffer', `<p>Użytkownik <b>${u.rows[0].imie_nazwisko}</b> (${email}) zalogował się do SaventOffer.</p><p>Data: ${new Date().toLocaleString('pl-PL')}</p>`);
  res.json(sign(u.rows[0]));
});

// Prosba o haslo — powiadom admina
router.post('/prosba-haslo', async (req, res) => {
  const { email } = req.body;
  if (!email) return res.status(400).json({ error: 'Podaj email' });
  wyslijPowiadomienie('Prosba o dostep do SaventOffer', `<p>Osoba z emailem <b>${email}</b> prosi o utworzenie konta w SaventOffer.</p><p>Jeśli chcesz utworzyć konto, wejdź w panel administracyjny.</p>`);
  res.json({ success: true, message: 'Wiadomosc zostala wyslana do administratora.' });
});

router.get('/me', async (req, res) => {
  const auth = req.headers.authorization;
  if (!auth?.startsWith('Bearer ')) return res.status(401).json({ error: 'Brak tokenu' });
  try {
    const decoded = jwt.verify(auth.slice(7), jwtSecret);
    const user = (await pool.query('SELECT id,email,imie_nazwisko,rola,aktywny FROM users WHERE id = $1', [decoded.id])).rows[0];
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
    const hash = await bcrypt.hash(nowe_haslo, BCRYPT_COST);
    await pool.query('UPDATE users SET haslo_hash = $1 WHERE id = $2', [hash, decoded.id]);
    res.json({ success: true });
  } catch { res.status(500).json({ error: 'Blad zmiany hasla' }); }
});

module.exports = router;