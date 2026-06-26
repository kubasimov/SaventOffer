const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const { port } = require('./config');

const app = express();

app.use(helmet());
app.use(cors());
app.use(express.json());

// Routes
app.use('/api/auth', require('./routes/auth'));

// Wszystkie poniższe routes wymagają zalogowania
const requireAuth = require('./middleware/auth');
app.use('/api/cennik', requireAuth, require('./routes/cennik'));
app.use('/api/klienci', requireAuth, require('./routes/klienci'));
app.use('/api/oferty', requireAuth, require('./routes/oferty'));
app.use('/api/auth', require('./routes/auth'));
app.use('/api/pdf', requireAuth, require('./routes/pdf'));
app.use('/api/whisper', requireAuth, require('./routes/whisper'));
app.use('/api/import', requireAuth, require('./routes/import'));
app.use('/api/users', requireAuth, require('./routes/users'));
app.use('/api/ustawienia', requireAuth, require('./routes/ustawienia'));

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', czas: new Date().toISOString() });
});

app.listen(port, () => {
  console.log(`Savento backend działa na porcie ${port}`);
});
// poniżej tego komentarza nie dodawaj nic - placeholder
