const express = require('express');
const router = express.Router();
const nodemailer = require('nodemailer');
const Imap = require('imap');
const { simpleParser } = require('mailparser');
const pool = require('../db/pool');
const { pobierzDaneOferty } = require('./pdf'); // jesli potrzebne

// Konfiguracja SMTP/IMAP — wczytaj z .env lub uzyj testowych
const SMTP_HOST = process.env.SMTP_HOST || 'n3.smarthost.pl';
const SMTP_PORT = parseInt(process.env.SMTP_PORT || '465');
const SMTP_USER = process.env.SMTP_USER || 'reklamacja@savento.pl';
const SMTP_PASS = process.env.SMTP_PASS || '5kbE4V!i#FDeWBfL#vrW';
const IMAP_HOST = process.env.IMAP_HOST || 'n3.smarthost.pl';
const IMAP_PORT = parseInt(process.env.IMAP_PORT || '993');
const EMAIL_FROM = process.env.EMAIL_FROM || 'reklamacja@savento.pl';

// Transporter SMTP
function getTransporter() {
  return nodemailer.createTransport({
    host: SMTP_HOST, port: SMTP_PORT, secure: true,
    auth: { user: SMTP_USER, pass: SMTP_PASS }
  });
}

// Pobierz ostatnie maile z IMAP dla danego adresu
function pobierzMaile(adres, limit = 20) {
  return new Promise((resolve, reject) => {
    const imap = new Imap({
      user: SMTP_USER, password: SMTP_PASS,
      host: IMAP_HOST, port: IMAP_PORT, tls: true
    });
    const wyniki = [];
    imap.once('ready', () => {
      imap.openBox('INBOX', false, (err, box) => {
        if (err) { imap.end(); return reject(err); }
        imap.search([['FROM', adres]], (err, results) => {
          if (err) { imap.end(); return reject(err); }
          const najnowsze = results.slice(-limit).reverse();
          if (!najnowsze.length) { imap.end(); return resolve([]); }
          const fetch = imap.fetch(najnowsze, { bodies: '' });
          fetch.on('message', (msg, seqno) => {
            msg.on('body', (stream) => {
              simpleParser(stream, (err, parsed) => {
                if (err) return;
                const msgId = (parsed.messageId || '').replace(/[<>]/g, '');
                wyniki.push({
                  uid: msgId,
                  from: parsed.from ? parsed.from.text : '',
                  subject: parsed.subject || '',
                  date: parsed.date || new Date(),
                  text: (parsed.text || '').slice(0, 500),
                  messageId: msgId,
                  inReplyTo: (parsed.inReplyTo || '').replace(/[<>]/g, ''),
                  references: (parsed.references || '').replace(/[<>]/g, '')
                });
              });
            });
            msg.on('end', () => {});
          });
          fetch.on('end', () => { imap.end(); resolve(wyniki); });
          fetch.on('error', e => { imap.end(); reject(e); });
        });
      });
    });
    imap.once('error', reject);
    imap.connect();
  });
}

// GET /api/oferty/:id/maile — pobiera maile klienta z serwera
router.get('/oferty/:id/maile', async (req, res) => {
  try {
    const oferta = await pool.query(
      'SELECT o.*, c.nazwa as klient_nazwa, c.email FROM offers o LEFT JOIN clients c ON o.klient_id = c.id WHERE o.id=$1',
      [req.params.id]
    );
    if (!oferta.rows.length) return res.status(404).json({ error: 'Nie znaleziono' });
    const adres = oferta.rows[0].email;
    if (!adres) return res.json({ maile: [], klient: oferta.rows[0].klient_nazwa, email: null });
    const maile = await pobierzMaile(adres);
    res.json({ maile, klient: oferta.rows[0].klient_nazwa, email: adres });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/oferty/:id/wyslij — generuje PDF i wysyla maila
router.post('/oferty/:id/wyslij', async (req, res) => {
  try {
    const { do_adresu, temat, tresc, odpowiedz_na } = req.body;
    if (!do_adresu) return res.status(400).json({ error: 'Brak adresu odbiorcy' });

    // Generuj PDF
    const data = await pobierzDaneOferty(req.params.id);
    if (!data) return res.status(404).json({ error: 'Nie znaleziono oferty' });
    const outputPath = `/opt/savento/pdf-output/${data.oferta.numer}.pdf`;
    const danePath = `/tmp/pdf_dane_${Date.now()}.json`;
    require('fs').writeFileSync(danePath, JSON.stringify({
      ...data, klient_dane: req.body.klient_dane || null,
      zalozenia: '', specyfikacja: [], kategoria: '', tylko_podsumowanie: false
    }), 'utf8');
    const { execSync } = require('child_process');
    execSync(`python3 /opt/savento/backend/generate_pdf.py '${danePath}' '${outputPath}'`, { timeout: 120000 });
    try { require('fs').unlinkSync(danePath); } catch(e) {}

    // Wyslij maila
    const transporter = getTransporter();
    const mailOptions = {
      from: EMAIL_FROM, to: do_adresu,
      subject: temat || `Wycena: ${data.oferta.numer}`,
      html: tresc || `<p>W załączniku przesyłam wycenę.</p>`,
      attachments: [{ filename: `${data.oferta.numer}.pdf`, path: outputPath }]
    };
    if (odpowiedz_na) {
      mailOptions.inReplyTo = odpowiedz_na;
      mailOptions.references = odpowiedz_na;
      mailOptions.headers = { 'In-Reply-To': `<${odpowiedz_na}>`, 'References': `<${odpowiedz_na}>` };
    }

    const info = await transporter.sendMail(mailOptions);

    // Zapisz w historii wyslanych maili
    const insertRes = await pool.query(
      `INSERT INTO sent_emails (oferta_id, odbiorca, temat, message_id, odpowiedz_na)
       VALUES ($1,$2,$3,$4,$5) RETURNING *`,
      [req.params.id, do_adresu, mailOptions.subject, info.messageId || '', odpowiedz_na || null]
    );

    // Usun PDF po wyslaniu
    try { require('fs').unlinkSync(outputPath); } catch(e) {}

    res.json({ success: true, messageId: info.messageId, id: insertRes.rows[0].id });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/oferty/:id/wyslane — historia wyslanych maili
router.get('/oferty/:id/wyslane', async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT * FROM sent_emails WHERE oferta_id=$1 ORDER BY utworzony DESC',
      [req.params.id]
    );
    res.json(result.rows);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

module.exports = router;