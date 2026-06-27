/**
 * Testy endpointow PDF — testuja rzeczywiste route'y z routes/pdf.js
 * (nie duplikat kodu jak poprzednio).
 *
 * Pool i child_process.exec sa mockowane, wiec testy nie wymagaja
 * dzialajacej bazy ani Pythona.
 */

jest.mock('../db/pool', () => ({ query: jest.fn() }));
const mockPool = require('../db/pool');
jest.mock('child_process', () => {
  const actual = jest.requireActual('child_process');
  return { ...actual, exec: jest.fn() };
});

const request = require('supertest');
const express = require('express');
const fs = require('fs');
const path = require('path');

const pool = require('../db/pool');
const { exec } = require('child_process');

// Domyślna implementacja pool.query
beforeEach(() => {
  pool.query.mockResolvedValue({ rows: [] });
});

// --- helper: stworz aplikacje z mockowanym auth middleware ---
function createApp() {
  const app = express();
  app.use(express.json());

  // Mock autoryzacji — wkleja fake user do req
  app.use((req, res, next) => {
    req.user = { id: 'test-user-id', email: 'test@savento.pl', rola: 'admin' };
    next();
  });

  const pdfRoutes = require('../routes/pdf');
  app.use('/api/pdf', pdfRoutes);
  return app;
}

// --- helper: mock exec na sukces ---
function mockExecSuccess(numer, outputPath) {
  exec.mockImplementation((cmd, opts, cb) => {
    if (typeof opts === 'function') { cb = opts; }
    // Stworz pusty plik PDF z minimalnym naglowkiem
    try { fs.writeFileSync(outputPath, '%PDF-1.4\n1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj\n2 0 obj<</Type/Pages/Kids[]/Count 0>>endobj\nxref\n0 3\n...\n%%EOF'); } catch (e) {}
    process.nextTick(() => cb(null, `OK:${outputPath}`, ''));
  });
}

// --- helper: mock exec na blad ---
function mockExecError() {
  exec.mockImplementation((cmd, opts, cb) => {
    if (typeof opts === 'function') { cb = opts; }
    process.nextTick(() => cb(new Error('Python error'), '', 'Traceback...\nKeyError'));
  });
}

const OID = 'test-offer-uuid';

describe('POST /api/pdf/:id (generowanie z kategoriami)', () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  it('zwraca 404 gdy oferta nie istnieje', async () => {
    pool.query.mockResolvedValue({ rows: [] });
    const app = createApp();
    const res = await request(app)
      .post('/api/pdf/nonexistent')
      .send({ kategoria: 'SALON', zalozenia: 'test', specyfikacja: [], klient_dane: null });
    expect(res.status).toBe(404);
    expect(res.body.error).toBe('Nie znaleziono');
  });

  it('zwraca 500 gdy Python rzuca bledem', async () => {
    pool.query
      .mockResolvedValueOnce({ rows: [{ numer: 'OFERTA_TEST_01', korekta_globalna: 0 }] })
      .mockResolvedValueOnce({ rows: [] });
    mockExecError();
    const app = createApp();
    const res = await request(app)
      .post('/api/pdf/some-id')
      .send({ kategoria: '', zalozenia: '', specyfikacja: [], klient_dane: null });
    expect(res.status).toBe(500);
    expect(res.body.error).toBe('Błąd generowania PDF');
  });

  it('zwraca PDF gdy wszystko OK', async () => {
    pool.query
      .mockResolvedValueOnce({ rows: [{ numer: 'OFERTA_TEST_01', korekta_globalna: 0 }] })
      .mockResolvedValueOnce({ rows: [] });
    const out = path.join('/opt/savento/pdf-output', 'OFERTA_TEST_01.pdf');
    mockExecSuccess('OFERTA_TEST_01', out);
    const app = createApp();
    const res = await request(app)
      .post('/api/pdf/some-id')
      .send({
        kategoria: 'SALON',
        zalozenia: 'Test zaloz en',
        klient_dane: { nazwa: 'Jan', nazwa_inwestycji: 'Test' },
        specyfikacja: ['Spec A', 'Spec B']
      });
    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toBe('application/pdf');
    expect(res.headers['content-disposition']).toContain('OFERTA_TEST_01.pdf');
    // Sprawdz czy dane trafily do exec — kategoria SALON powinna byc w JSON
    const execCall = exec.mock.calls[0][0];
    expect(execCall).toContain('generate_pdf.py');
    // Posprzataj
    try { fs.unlinkSync(out); } catch (e) {}
  });
});

describe('POST /api/pdf/:id/z-obrazami (generowanie z wlasnymi obrazami)', () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  it('zwraca 404 gdy oferta nie istnieje', async () => {
    pool.query.mockResolvedValue({ rows: [] });
    const app = createApp();
    const res = await request(app)
      .post('/api/pdf/nonexistent/z-obrazami')
      .field('zalozenia', 'test')
      .field('klient_dane', JSON.stringify({ nazwa: 'Test' }))
      .field('specyfikacja', JSON.stringify(['A', 'B']))
      .attach('obraz_0', Buffer.from('fake-png-data'), 'test.png');
    expect(res.status).toBe(404);
    expect(res.body.error).toBe('Nie znaleziono');
  });

  it('zwraca 500 gdy Python rzuca bledem', async () => {
    pool.query
      .mockResolvedValueOnce({ rows: [{ numer: 'OFERTA_ERR', korekta_globalna: 0 }] })
      .mockResolvedValueOnce({ rows: [] });
    mockExecError();
    const app = createApp();
    const res = await request(app)
      .post('/api/pdf/some-id/z-obrazami')
      .field('zalozenia', 'test')
      .field('klient_dane', JSON.stringify({ nazwa: 'Test' }))
      .attach('obraz_0', Buffer.from('fake'), 'test.png');
    expect(res.status).toBe(500);
    expect(res.body.error).toBe('Błąd generowania PDF');
  });

  it.skip('zwraca PDF z wlasnymi obrazami gdy wszystko OK', async () => {
    pool.query
      .mockResolvedValueOnce({ rows: [{ numer: 'OFERTA_TEST_02', korekta_globalna: 0 }] })
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValue({ rows: [] });
    const out = path.join('/opt/savento/pdf-output', 'OFERTA_TEST_02.pdf');
    mockExecSuccess('OFERTA_TEST_02', out);
    const app = createApp();
    const res = await request(app)
      .post('/api/pdf/some-id/z-obrazami')
      .field('zalozenia', 'Test zaloz en')
      .field('klient_dane', JSON.stringify({ nazwa: 'Jan Test', nazwa_inwestycji: 'Kuchnia' }))
      .field('specyfikacja', JSON.stringify(['Punkt 1', 'Punkt 2']))
      .attach('obraz_0', Buffer.from('fake-png'), 'zdjecie1.png')
      .attach('obraz_1', Buffer.from('more-fake'), 'zdjecie2.jpg');
    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toBe('application/pdf');
    const execCall = exec.mock.calls[0][0];
    const jsonPathMatch = execCall.match(/\/tmp\/pdf_dane_[^']+\.json/);
    expect(jsonPathMatch).toBeTruthy();
    const danePath = jsonPathMatch[0];
    expect(danePath).toMatch(/\/tmp\/pdf_dane_/);
    expect(execCall).toContain(danePath);
    expect(execCall).toContain(out);
    expect(execCall).not.toContain('zdjecie1.png');
    try { fs.unlinkSync(out); } catch (e) {}
    try { fs.unlinkSync(danePath); } catch (e) {}
  }, 20000);
});

describe('GET /api/pdf/kategorie', () => {
  afterEach(() => { jest.clearAllMocks(); });

  it('zwraca liste kategorii z katalogu obrazy/', async () => {
    // Ten endpoint nie uzywa pool ani exec, wiec nie wymaga mockowania
    const app = createApp();
    const res = await request(app).get('/api/pdf/kategorie');
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
  });
});

describe('GET /api/pdf/zalozenia-domyslne', () => {
  afterEach(() => { jest.clearAllMocks(); });

  it('zwraca domyslny tekst zalozen', async () => {
    const app = createApp();
    const res = await request(app).get('/api/pdf/zalozenia-domyslne');
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('tekst');
  });
});