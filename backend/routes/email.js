const express = require('express');
const router = express.Router();
const nodemailer = require('nodemailer');
const Imap = require('imap');
const { simpleParser } = require('mailparser');
const pool = require('../db/pool');
const { pobierzDaneOferty } = require('./pdf');

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
    const pool = require('../db/pool');
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
    auth: { user: cfg.smtp_user, pass: cfg.smtp_pass },
    tls: { rejectUnauthorized: false }
  });
}

// Pobierz ostatnie maile z IMAP dla danego adresu - uzyj HEADER zamiast bodies:''
async function pobierzMaile(adres) {
  const cfg = await pobierzKonfiguracjeEmail();
  return new Promise((resolve) => {
    const imap = new Imap({
      user: cfg.smtp_user, password: cfg.smtp_pass,
      host: cfg.imap_host, port: cfg.imap_port, tls: true,
      tlsOptions: { rejectUnauthorized: false }
    });
    const wyniki = [];
    imap.once('ready', () => {
      imap.openBox('INBOX', false, (err) => {
        if (err) { imap.end(); return resolve([]); }
        imap.search([['FROM', adres]], (err, results) => {
          if (err || !results?.length) { imap.end(); return resolve([]); }
          const najnowsze = results.slice(-20).reverse();
          let odebrane = 0;
          const fetch = imap.fetch(najnowsze, { bodies: 'HEADER' });
          fetch.on('message', (msg) => {
            let raw = '';
            msg.on('body', (stream) => {
              stream.on('data', (chunk) => { raw += chunk.toString('utf8'); });
              stream.on('end', () => {
                // Sparsuj naglowki
                const h = {};
                raw.split('\r\n').forEach(l => {
                  const m = l.match(/^([^:]+):\s*(.*)/);
                  if (m) {
                    const key = m[1].toLowerCase();
                    // Dekoduj RFC 2047 (=?UTF-8?Q?...?= or =?UTF-8?B?...?=)
                    const decoded = m[2].trim().replace(/=\?[^?]+\?[QqBb]\?[^?]*\?=/g, (match) => {
                      const parts = match.match(/=\?([^?]+)\?([QqBb])\?([^?]*)\?=/);
                      if (!parts) return match;
                      const [, charset, encoding, encoded] = parts;
                      if (encoding.toUpperCase() === 'Q') {
                        // Q-encoding: =XX to bajt, _ to spacja
                        const bytes = [];
                        let i = 0;
                        while (i < encoded.length) {
                          if (encoded[i] === '=' && i + 2 < encoded.length) {
                            bytes.push(parseInt(encoded.substr(i+1, 2), 16));
                            i += 3;
                          } else if (encoded[i] === '_') {
                            bytes.push(0x20);
                            i++;
                          } else {
                            bytes.push(encoded.charCodeAt(i));
                            i++;
                          }
                        }
                        try { return Buffer.from(bytes).toString(charset || 'utf-8'); } catch(e) { return match; }
                      }
                      if (encoding.toUpperCase() === 'B') {
                        try { return Buffer.from(encoded, 'base64').toString(charset || 'utf-8'); } catch(e) { return match; }
                      }
                      return match;
                    });
                    if (!h[key]) h[key] = decoded;
                    else if (Array.isArray(h[key])) h[key].push(decoded);
                    else h[key] = [h[key], decoded];
                  }
                });
                const fromRaw = (Array.isArray(h.from) ? h.from[0] : h.from) || '';
                const from = fromRaw.replace(/<[^>]*>/g, '').trim() || fromRaw;
                const subject = (Array.isArray(h.subject) ? h.subject[0] : h.subject) || '';
                const msgId = ((Array.isArray(h['message-id']) ? h['message-id'][0] : h['message-id']) || '').replace(/[<>]/g, '');
                const inReplyTo = ((Array.isArray(h['in-reply-to']) ? h['in-reply-to'][0] : h['in-reply-to']) || '').replace(/[<>]/g, '');
                const references = ((Array.isArray(h.references) ? h.references[0] : h.references) || '').replace(/[<>]/g, '');
                const dateStr = (Array.isArray(h.date) ? h.date[0] : h.date) || '';
                wyniki.push({
                  uid: msgId, from, subject,
                  date: dateStr ? new Date(dateStr) : new Date(),
                  text: '', html: '',
                  messageId: msgId, inReplyTo, references
                });
                odebrane++;
                if (odebrane >= najnowsze.length) { imap.end(); resolve(wyniki); }
              });
            });
          });
          fetch.on('error', () => { imap.end(); resolve(wyniki); });
          fetch.on('end', () => {
            setTimeout(() => { if (odebrane < najnowsze.length) { imap.end(); resolve(wyniki); } }, 3000);
          });
        });
      });
    });
    imap.once('error', () => resolve([]));
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

// POST /api/oferty/:id/wyslij — generuje PDF i wysyla maila
router.post('/oferty/:id/wyslij', async (req, res) => {
  try {
    const { do_adresu, temat, tresc, odpowiedz_na, html_oryginalny } = req.body;
    if (!do_adresu) return res.status(400).json({ error: 'Brak adresu odbiorcy' });

    // Generuj PDF
        const data = await pobierzDaneOferty(req.params.id);
        const outputPath = `/tmp/oferta_${Date.now()}.pdf`;

        // Pobierz konfiguracje email
        const cfg = await pobierzKonfiguracjeEmail();
    const danePath = `/tmp/pdf_dane_${Date.now()}.json`;
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
    let stopkaTresc = stopkaRaw.replace(/<!DOCTYPE[^>]*>/gi, '');
    stopkaTresc = stopkaTresc.replace(/<\/?html[^>]*>/gi, '');
    const styleMatch = stopkaTresc.match(/<style[^>]*>[\s\S]*<\/style>/i);
    const styleBlock = styleMatch ? styleMatch[0] : '';
    const stopkaBodyMatch = stopkaTresc.match(/<body[^>]*>([\s\S]*)<\/body>/i);
    const stopkaBody = stopkaBodyMatch ? stopkaBodyMatch[1] : stopkaTresc;

    const wlasnyTekst = tresc || 'W załączniku przesyłam wycenę.';
    const urlRegex = /(https?:\/\/[^\s<]+)/g;
    const wlasnaTrescHtml = wlasnyTekst.replace(/\n/g, '<br>').replace(urlRegex, '<a href="$1">$1</a>');
    const wlasnaTrescPlain = wlasnyTekst.replace(/<[^>]+>/g, '').replace(/\n/g, '\r\n');

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
      const rawGen = nodemailer.createTransport({ streamTransport: true, newline: 'unix', buffer: true });
      const rawInfo = await rawGen.sendMail(mailOptions);
      const rawBuffer = rawInfo.message;

      await new Promise((resolve) => {
        const Imap2 = require('imap');
        const imapSent = new Imap2({
          user: cfg.smtp_user, password: cfg.smtp_pass,
          host: cfg.imap_host, port: cfg.imap_port, tls: true,
          tlsOptions: { rejectUnauthorized: false }
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

module.exports = router;