/**
 * Testy endpointow autoryzacji — routes/auth.js
 *
 * Pool i bcrypt sa mockowane, testy nie wymagaja bazy danych.
 */

jest.mock('../../db/pool', () => ({ query: jest.fn() }));
jest.mock('bcrypt', () => ({
  compare: jest.fn(),
  hash: jest.fn(() => Promise.resolve('$2b$11$hashedpassword')),
}));

const request = require('supertest');
const express = require('express');
const jwt = require('jsonwebtoken');
const pool = require('../../db/pool');
const bcrypt = require('bcrypt');

// Ustaw JWT_SECRET do testow
process.env.JWT_SECRET = 'test-jwt-secret';
process.env.GOOGLE_CLIENT_ID = 'test-google-client-id';

function createApp() {
  const app = express();
  app.use(express.json());
  const authRoutes = require('../../routes/auth');
  app.use('/api/auth', authRoutes);
  return app;
}

function createToken(payload = {}) {
  return jwt.sign(
    { id: 'test-user-id', email: 'test@savento.pl', imie: 'Test User', rola: 'admin', ...payload },
    process.env.JWT_SECRET,
    { expiresIn: '1h' }
  );
}

describe('POST /api/auth/login', () => {
  afterEach(() => { jest.clearAllMocks(); });

  it('zwraca 401 gdy email nie istnieje', async () => {
    pool.query.mockResolvedValue({ rows: [] });
    const app = createApp();
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: 'nonexistent@savento.pl', haslo: 'test12345' });
    expect(res.status).toBe(401);
    expect(res.body.error).toBe('Nieprawidlowy email lub haslo');
  });

  it('zwraca 401 gdy haslo nieprawidlowe', async () => {
    pool.query.mockResolvedValue({
      rows: [{ id: 'uid', email: 'test@savento.pl', haslo_hash: '$2b$11$hash', imie_nazwisko: 'Test', rola: 'pracownik', aktywny: true }]
    });
    bcrypt.compare.mockResolvedValue(false);
    const app = createApp();
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: 'test@savento.pl', haslo: 'zlehaslo' });
    expect(res.status).toBe(401);
    expect(res.body.error).toBe('Nieprawidlowy email lub haslo');
  });

  it('zwraca token i usera gdy dane poprawne', async () => {
    pool.query.mockResolvedValue({
      rows: [{ id: 'uid', email: 'test@savento.pl', haslo_hash: '$2b$11$hash', imie_nazwisko: 'Test User', rola: 'pracownik', aktywny: true }]
    });
    bcrypt.compare.mockResolvedValue(true);
    const app = createApp();
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: 'test@savento.pl', haslo: 'test12345' });
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('token');
    expect(res.body.user).toHaveProperty('email', 'test@savento.pl');
    expect(res.body.user).toHaveProperty('rola', 'pracownik');
  });
});

describe('GET /api/auth/me', () => {
  afterEach(() => { jest.clearAllMocks(); });

  it('zwraca 401 bez tokenu', async () => {
    const app = createApp();
    const res = await request(app).get('/api/auth/me');
    expect(res.status).toBe(401);
    expect(res.body.error).toBe('Brak tokenu');
  });

  it('zwraca usera z poprawnym tokenem', async () => {
    pool.query.mockResolvedValue({
      rows: [{ id: 'uid', email: 'test@savento.pl', imie_nazwisko: 'Test', rola: 'admin' }]
    });
    const app = createApp();
    const res = await request(app)
      .get('/api/auth/me')
      .set('Authorization', `Bearer ${createToken()}`);
    expect(res.status).toBe(200);
    expect(res.body.email).toBe('test@savento.pl');
  });

  it('zwraca 401 gdy token niewazny', async () => {
    const app = createApp();
    const res = await request(app)
      .get('/api/auth/me')
      .set('Authorization', 'Bearer invalid.token.here');
    expect(res.status).toBe(401);
  });
});

describe('POST /api/auth/zmien-haslo', () => {
  afterEach(() => { jest.clearAllMocks(); });

  it('zwraca 401 bez tokenu', async () => {
    const app = createApp();
    const res = await request(app)
      .post('/api/auth/zmien-haslo')
      .send({ stare_haslo: 'old', nowe_haslo: 'NewPass123!' });
    expect(res.status).toBe(401);
  });

  it('zwraca 400 gdy brak pol', async () => {
    const app = createApp();
    const res = await request(app)
      .post('/api/auth/zmien-haslo')
      .set('Authorization', `Bearer ${createToken()}`)
      .send({});
    expect(res.status).toBe(400);
    expect(res.body.error).toContain('Podaj stare i nowe haslo');
  });

  it('zwraca 400 gdy nowe haslo nie spelnia polityki', async () => {
    const app = createApp();
    const res = await request(app)
      .post('/api/auth/zmien-haslo')
      .set('Authorization', `Bearer ${createToken()}`)
      .send({ stare_haslo: 'old', nowe_haslo: 'short' });
    expect(res.status).toBe(400);
    expect(res.body.error).toContain('10 znakow');
  });

  it('zwraca 401 gdy stare haslo nieprawidlowe', async () => {
    pool.query.mockResolvedValue({
      rows: [{ id: 'uid', haslo_hash: '$2b$11$hash' }]
    });
    bcrypt.compare.mockResolvedValue(false);
    const app = createApp();
    const res = await request(app)
      .post('/api/auth/zmien-haslo')
      .set('Authorization', `Bearer ${createToken()}`)
      .send({ stare_haslo: 'wrong', nowe_haslo: 'NewPassword123!' });
    expect(res.status).toBe(401);
    expect(res.body.error).toBe('Nieprawidlowe stare haslo');
  });

  it('zmienia haslo gdy wszystko OK', async () => {
    pool.query
      .mockResolvedValueOnce({ rows: [{ id: 'uid', haslo_hash: '$2b$11$hash' }] })
      .mockResolvedValueOnce({ rows: [] });
    bcrypt.compare.mockResolvedValue(true);
    const app = createApp();
    const res = await request(app)
      .post('/api/auth/zmien-haslo')
      .set('Authorization', `Bearer ${createToken()}`)
      .send({ stare_haslo: 'old', nowe_haslo: 'NewPassword123!' });
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });
});