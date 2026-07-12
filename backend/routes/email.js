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
const SMTP_PASS = process.env.SMTP_PASS || process.env.SMTP_PASSWORD || 'OcytKkFcyB#[PX5T';
const IMAP_HOST = process.env.IMAP_HOST || 'n3.smarthost.pl';
const IMAP_PORT = parseInt(process.env.IMAP_PORT || '993');
const EMAIL_FROM = process.env.EMAIL_FROM || 'reklamacja@savento.pl';

async function pobierzKonfiguracjeEmail() {
  try {
    const pool = require('./db/pool');
    const r = await pool.query("SELECT wartosc FROM ustawienia WHERE klucz='konfiguracja_email'");
    if (r.rows.length) {
      const c = JSON.parse(r.rows[0].wartosc);
      return {
        smtp_host: c.smtp_host || SMTP_HOST,
        smtp_port: parseInt(c.smtp_port) || SMTP_PORT,
        smtp_user: c.smtp_user || SMTP_USER,
        smtp_pass: c.smtp_pass || SMTP_PASS,
        imap_host: c.imap_host || IMAP_HOST,
        imap_port: parseInt(c.imap_port) || IMAP_PORT,
        email_from: c.email_from || EMAIL_FROM
      };
    }
  } catch(e) { console.error('KonfiguracjaEmail error:', e.message); }
  return { smtp_host: SMTP_HOST, smtp_port: SMTP_PORT, smtp_user: SMTP_USER, smtp_pass: SMTP_PASS, imap_host: IMAP_HOST, imap_port: IMAP_PORT, email_from: EMAIL_FROM };
}

// Transporter SMTP z konfiguracji z bazy
async function getTransporter() {
  const cfg = await pobierzKonfiguracjeEmail();
  return nodemailer.createTransport({
    host: cfg.smtp_host, port: cfg.smtp_port, secure: true,
    auth: { user: cfg.smtp_user, pass: cfg.smtp_pass }
  });
}

// Pobierz ostatnie maile z IMAP dla danego adresu
async function pobierzMaile(adres, limit = 20) {
  const cfg = await pobierzKonfiguracjeEmail();
  return new Promise((resolve, reject) => {
    const imap = new Imap({
      user: cfg.smtp_user, password: cfg.smtp_pass,
      host: cfg.imap_host, port: cfg.imap_port, tls: true
    });
    const wyniki = [];
    let oczekuje = 0;
    imap.once('ready', () => {
      imap.openBox('INBOX', false, (err, box) => {
        if (err) { imap.end(); return reject(err); }
        imap.search([['FROM', adres]], (err, results) => {
          if (err) { imap.end(); return reject(err); }
          const najnowsze = results.slice(-limit).reverse();
          if (!najnowsze.length) { imap.end(); return resolve([]); }
          oczekuje = najnowsze.length;
          const fetch = imap.fetch(najnowsze, { bodies: '' });
          fetch.on('message', (msg) => {
            msg.on('body', (stream) => {
              simpleParser(stream).then(parsed => {
                const msgId = (parsed.messageId || '').replace(/[<>]/g, '');
                wyniki.push({
                  uid: msgId,
                  from: parsed.from ? parsed.from.text : '',
                  subject: parsed.subject || '',
                  date: parsed.date || new Date(),
                  text: (parsed.text || '').slice(0, 10000),
                  html: parsed.html || '',
                  messageId: msgId,
                  inReplyTo: (parsed.inReplyTo || '').replace(/[<>]/g, ''),
                  references: (parsed.references || '').replace(/[<>]/g, '')
                });
              }).catch(() => {}).finally(() => {
                oczekuje--;
                if (oczekuje <= 0) { imap.end(); resolve(wyniki); }
              });
            });
          });
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
    const { do_adresu, temat, tresc, odpowiedz_na, html_oryginalny } = req.body;
        if (!do_adresu) return res.status(400).json({ error: 'Brak adresu odbiorcy' });

        // Generuj PDF
        const data = await pobierzDaneOferty(req.params.id);
        const pdfBuf = await generujPdf(data);
        const outputPath = `/tmp/oferta_${Date.now()}.pdf`;
        require('fs').writeFileSync(outputPath, pdfBuf);

        // Pobierz konfiguracje email
        const cfg = await pobierzKonfiguracjeEmail();
    require('fs').writeFileSync(danePath, JSON.stringify({
      ...data, klient_dane: req.body.klient_dane || null,
      zalozenia: '', specyfikacja: [], kategoria: '', tylko_podsumowanie: false
    }), 'utf8');
    const { execSync } = require('child_process');
    execSync(`python3 /opt/savento/backend/generate_pdf.py '${danePath}' '${outputPath}'`, { timeout: 120000 });
    try { require('fs').unlinkSync(danePath); } catch(e) {}

    // Wyslij maila
            const transporter = await getTransporter();
            const stopkaRaw = require('fs').readFileSync('/opt/savento/backend/obrazy/contact_footer.html', 'utf8');
            // Zachowaj style, usun tylko otaczajace <html><head><body>
            let stopkaTresc = stopkaRaw.replace(/<!DOCTYPE[^>]*>/gi, '');
            stopkaTresc = stopkaTresc.replace(/<\/?html[^>]*>/gi, '');
            const styleMatch = stopkaTresc.match(/<style[^>]*>[\s\S]*<\/style>/i);
            const styleBlock = styleMatch ? styleMatch[0] : '';
            const stopkaBodyMatch = stopkaTresc.match(/<body[^>]*>([\s\S]*)<\/body>/i);
            const stopkaBody = stopkaBodyMatch ? stopkaBodyMatch[1] : stopkaTresc;
        
            const wlasnyTekst = tresc || 'W załączniku przesyłam wycenę.';
            // Konwertuj URL na klikalne linki
            const urlRegex = /(https?:\/\/[^\s<]+)/g;
            const wlasnaTrescHtml = wlasnyTekst.replace(/\n/g, '<br>').replace(urlRegex, '<a href="$1">$1</a>');
            // Zbuduj czysty tekst dla text/plain
            const wlasnaTrescPlain = wlasnyTekst.replace(/<[^>]+>/g, '').replace(/\n/g, '\r\n');
        
            // Wyciagnij tylko zawartosc <body> z oryginalnego HTML cytatu
            let cytatTresc = html_oryginalny || '';
            const bodyMatch = cytatTresc.match(/<body[^>]*>([\s\S]*)<\/body>/i);
            if (bodyMatch) cytatTresc = bodyMatch[1];
            cytatTresc = cytatTresc.replace(/<!DOCTYPE[^>]*>/gi, '').replace(/<\/?html[^>]*>/gi, '');
            const cytatHtml = cytatTresc
              ? `<blockquote style="border-left:2px solid #ccc;margin:16px 0;padding:0 0 0 12px;color:#555">${cytatTresc}</blockquote>`
              : '';
            const emailHtml = `<!DOCTYPE html>
    <html lang="pl">
    <head><meta charset="UTF-8"><meta name="color-scheme" content="light only">
    <style>body{margin:0;padding:20px;font-family:Arial,sans-serif;font-size:14px;color:#333}${styleBlock}</style>
    </head>
    <body>
    <p style="margin:0 0 16px 0">${wlasnaTrescHtml}</p>
    ${stopkaBody}
    ${cytatHtml}
    </body>
    </html>`;
    const mailOptions = {
      from: cfg.email_from, to: do_adresu,
      subject: temat || `Wycena: ${data.oferta.numer}`,
      html: emailHtml,
      text: wlasnaTrescPlain,
      attachments: [{ filename: `${data.oferta.numer}.pdf`, path: outputPath }]
    };
    if (odpowiedz_na) {
      mailOptions.inReplyTo = odpowiedz_na;
      mailOptions.references = odpowiedz_na;
      mailOptions.headers = { 'In-Reply-To': `<${odpowiedz_na}>`, 'References': `<${odpowiedz_na}>` };
    }

    const info = await transporter.sendMail(mailOptions);

    // Zapisz kopie w IMAP INBOX.Sent uzywajac nodemailer (stream transport) dla poprawnego MIME
    try {
      const cfg = await pobierzKonfiguracjeEmail();
      const rawGen = nodemailer.createTransport({ streamTransport: true, newline: 'unix', buffer: true });
      const rawInfo = await rawGen.sendMail(mailOptions);
      // Z buffer: true, rawInfo.message jest juz gotowym Bufferem
      const rawBuffer = rawInfo.message;
      
      await new Promise((resolve) => {
        const Imap2 = require('imap');
        const imapSent = new Imap2({
          user: cfg.smtp_user, password: cfg.smtp_pass,
          host: cfg.imap_host, port: cfg.imap_port, tls: true
        });
        imapSent.once('ready', () => {
          imapSent.append(rawBuffer, { mailbox: 'INBOX.Sent', flags: ['\\Seen'] }, (err) => {
            if (err) console.error('IMAP append error:', err.message);
            else console.log('IMAP append OK');
            imapSent.end();
            resolve();
          });
        });
        imapSent.once('error', (e) => { console.error('IMAP sent error:', e.message); resolve(); });
        imapSent.connect();
      });
    } catch (imapErr) {
      console.error('IMAP append error:', imapErr.message);
    }

    // Zapisz w historii wyslanych maili
    const insertRes = await pool.query(
      `INSERT INTO sent_emails (oferta_id, odbiorca, temat, message_id, odpowiedz_na)
       VALUES ($1,$2,$3,$4,$5) RETURNING *`,
      [req.params.id, do_adresu, mailOptions.subject, info.messageId || '', odpowiedz_na || null]
    );

    // Zmien status oferty na "wyslana" i zapisz w changelogu
    const staryStatus = (await pool.query('SELECT status FROM offers WHERE id=$1', [req.params.id])).rows[0]?.status;
    if (staryStatus && staryStatus !== 'wyslana') {
      await pool.query('UPDATE offers SET status=$1 WHERE id=$2', ['wyslana', req.params.id]);
      await pool.query(
        `INSERT INTO offer_changelog (oferta_id, uzytkownik_id, pole, stara_wartosc, nowa_wartosc) VALUES ($1,$2,$3,$4,$5)`,
        [req.params.id, req.user?.id, 'status', staryStatus, 'wyslana']
      );
    }

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