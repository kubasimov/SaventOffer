const express = require('express');
const router = express.Router();
const multer = require('multer');
const fetch = require('node-fetch');
const FormData = require('form-data');
const fs = require('fs');

const upload = multer({ dest: '/tmp/whisper/' });

router.post('/transcribe', upload.single('audio'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'brak pliku audio' });

    console.log('Whisper: otrzymano plik', req.file.originalname, req.file.size, 'bytes');

    const form = new FormData();
    form.append('audio', fs.createReadStream(req.file.path), {
      filename: 'audio.webm',
      contentType: req.file.mimetype || 'audio/webm'
    });

    const response = await fetch('http://192.168.1.12:5050/transcribe', {
      method: 'POST',
      body: form,
      headers: form.getHeaders()
    });

    const text = await response.text();
    console.log('Whisper response:', text);

    try {
      const data = JSON.parse(text);
      if (req.file) fs.unlinkSync(req.file.path);
      res.json(data);
    } catch(e) {
      res.status(500).json({ error: 'Nieprawidłowa odpowiedź Whisper', raw: text });
    }

  } catch (err) {
    console.error('Whisper route error:', err.message);
    if (req.file) try { fs.unlinkSync(req.file.path) } catch(e) {}
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
