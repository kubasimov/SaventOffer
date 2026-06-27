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

// Wszystkie poni¿sze routes wymagaj¹ zalogowania + kontroli roli
const requireAuth = require('./middleware/auth');
const requireRole = require('./middleware/role');
const authAndRole = [requireAuth, requireRole];

app.use('/api/cennik', authAndRole, require('./routes/cennik'));
app.use('/api/klienci', authAndRole, require('./routes/klienci'));
app.use('/api/oferty', authAndRole, require('./routes/oferty'));
app.use('/api/auth', require('./routes/auth'));
app.use('/api/pdf', authAndRole, require('./routes/pdf'));
app.use('/api/whisper', authAndRole, require('./routes/whisper'));
app.use('/api/import', authAndRole, require('./routes/import'));
app.use('/api/users', authAndRole, require('./routes/users'));
app.use('/api/ustawienia', authAndRole, require('./routes/ustawienia'));

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', czas: new Date().toISOString() });
});

app.listen(port, () => {
  console.log(`Savento backend działa na porcie ${port}`);
});
// poniżej tego komentarza nie dodawaj nic - placeholder
