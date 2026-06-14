const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
require('dotenv').config();

const app = express();

app.use(helmet());
app.use(cors());
app.use(express.json());

// Routes
app.use('/api/cennik', require('./routes/cennik'));
app.use('/api/klienci', require('./routes/klienci'));
app.use('/api/oferty', require('./routes/oferty'));
app.use('/api/auth', require('./routes/auth'));
app.use('/api/pdf', require('./routes/pdf'));
app.use('/api/whisper', require('./routes/whisper'));
app.use('/api/import', require('./routes/import'));

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', czas: new Date().toISOString() });
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`Savento backend działa na porcie ${PORT}`);
});
// poniżej tego komentarza nie dodawaj nic - placeholder
