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

// Testuj polaczenie SMTP/IMAP i pobierz 5 ostatnich maili
router.post('/test-email', async (req, res) => {
  const { smtp_host, smtp_port, smtp_user, smtp_pass, imap_host, imap_port } = req.body;
  try {
    // Test SMTP
    const nodemailer = require('nodemailer');
    const smtp = nodemailer.createTransport({
      host: smtp_host, port: parseInt(smtp_port), secure: true,
      auth: { user: smtp_user, pass: smtp_pass }
    });
    await smtp.verify();
    smtp.close();

    // Test IMAP i pobierz 5 ostatnich maili
    const Imap = require('imap');
    const { simpleParser } = require('mailparser');
    const maile = await new Promise((resolve, reject) => {
      const imap = new Imap({
        user: smtp_user, password: smtp_pass,
        host: imap_host, port: parseInt(imap_port), tls: true
      });
      const wyniki = [];
      imap.once('ready', () => {
        imap.openBox('INBOX', false, (err, box) => {
          if (err) { imap.end(); return reject(err); }
          const total = box.messages.total;
          if (total === 0) { imap.end(); return resolve([]); }
          const zakres = Math.max(1, total - 4);
          const f = imap.seq.fetch(`${zakres}:${total}`, { bodies: '' });
          f.on('message', (msg) => {
            let buf = '';
            msg.on('body', (stream) => {
              stream.on('data', d => buf += d.toString('utf8'));
            });
            msg.on('end', () => {
              simpleParser(buf).then(parsed => {
                wyniki.push({
                  from: parsed.from?.text || '',
                  subject: parsed.subject || '',
                  date: parsed.date?.toISOString() || '',
                  text: (parsed.text || '').slice(0, 200)
                });
              }).catch(() => {});
            });
          });
          f.once('error', reject);
          f.once('end', () => { imap.end(); setTimeout(() => resolve(wyniki), 500); });
        });
      });
      imap.once('error', reject);
      imap.connect();
    });

    res.json({ success: true, maile });
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

// Test polaczenia email
router.post('/testuj-email', async (req, res) => {
  const { smtp_host, smtp_port, smtp_user, smtp_pass, imap_host, imap_port } = req.body;
  const wynik = { ok: false, maile: [], error: '' };
  // Test SMTP
  try {
    const nodemailer = require('nodemailer');
    const t = nodemailer.createTransport({
      host: smtp_host, port: parseInt(smtp_port) || 465, secure: true,
      auth: { user: smtp_user, pass: smtp_pass },
      tls: { rejectUnauthorized: false }, connectionTimeout: 5000
    });
    await t.verify();
  } catch (e) { wynik.error = 'SMTP: ' + e.message; }
  // Test IMAP i pobierz 5 ostatnich maili
  try {
    const Imap = require('imap');
    const { simpleParser } = require('mailparser');
    await new Promise((resolve) => {
      const imap = new Imap({
        user: smtp_user, password: smtp_pass,
        host: imap_host, port: parseInt(imap_port) || 993, tls: true,
        tlsOptions: { rejectUnauthorized: false },
        connTimeout: 5000
      });
      imap.once('ready', () => {
        imap.openBox('INBOX', false, (err) => {
          if (err) { imap.end(); return resolve(); }
          imap.search([['SINCE', new Date(Date.now() - 30*24*60*60*1000)]], (err, results) => {
            if (err || !results?.length) { imap.end(); return resolve(); }
            const najnowsze = results.slice(-5).reverse();
            let odebrane = 0;
            const fetch = imap.fetch(najnowsze, { bodies: '' });
            fetch.on('message', (msg) => {
              msg.on('body', (stream) => {
                simpleParser(stream).then(parsed => {
                  wynik.maile.push({
                    from: parsed.from?.text || '',
                    subject: parsed.subject || '',
                    date: parsed.date?.toISOString() || ''
                  });
                }).catch(() => {});
              });
              msg.once('end', () => {
                odebrane++;
                if (odebrane >= najnowsze.length) { imap.end(); setTimeout(resolve, 300); }
              });
            });
            fetch.once('error', () => { imap.end(); resolve(); });
          });
        });
      });
      imap.once('error', () => resolve());
      imap.connect();
    });
  } catch (e) { wynik.error += ' IMAP: ' + e.message; }
  wynik.ok = !wynik.error;
  res.json(wynik);
});

module.exports = router;
