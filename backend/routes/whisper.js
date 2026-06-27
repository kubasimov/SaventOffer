const express = require('express');
const router = express.Router();
const multer = require('multer');
const fetch = require('node-fetch');
const FormData = require('form-data');
const fs = require('fs');

const upload = multer({
  dest: '/tmp/whisper/',
  limits: { fileSize: 100 * 1024 * 1024 } // 100MB
});

function wykryjRozszerzenie(file) {
  if (file.originalname && file.originalname.includes('.')) {
    return file.originalname.split('.').pop().toLowerCase()
  }
  const mapa = {
    'audio/webm': 'webm',
    'audio/mpeg': 'mp3',
    'audio/mp3': 'mp3',
    'audio/wav': 'wav',
    'audio/x-wav': 'wav',
    'audio/mp4': 'm4a',
    'audio/x-m4a': 'm4a',
    'audio/ogg': 'ogg'
  }
  return mapa[file.mimetype] || 'webm'
}

const WHISPER_URL = process.env.WHISPER_URL || 'http://192.168.1.12:5050/transcribe';

router.post('/transcribe', upload.single('audio'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'brak pliku audio' });

    const ext = wykryjRozszerzenie(req.file)
    console.log('Whisper: plik otrzymany:', req.file.originalname, req.file.size, 'bytes, ext:', ext);

    const tmpPath = req.file.path;
    const finalPath = tmpPath + '.' + ext;
    fs.renameSync(tmpPath, finalPath);

    const form = new FormData();
    form.append('audio', fs.createReadStream(finalPath), {
      filename: `audio.${ext}`,
      contentType: req.file.mimetype || 'application/octet-stream'
    });

    console.log('Whisper: wysyłam do', WHISPER_URL);

    const response = await fetch(WHISPER_URL, {
      method: 'POST',
      body: form,
      headers: form.getHeaders(),
      timeout: 1200000 // 20 minut
    });

    const data = await response.json();
    console.log('Whisper: odpowiedź:', JSON.stringify(data).slice(0, 300));

    fs.unlinkSync(finalPath);
    res.json(data);
  } catch (err) {
    console.error('Whisper route error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
