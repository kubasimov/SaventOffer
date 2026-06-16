const jwt = require('jsonwebtoken');
const JWT_SECRET = process.env.JWT_SECRET || 'savento_secret_2026'

module.exports = function requireAuth(req, res, next) {
  const auth = req.headers.authorization;
  if (!auth?.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Wymagane logowanie' });
  }
  try {
    req.user = jwt.verify(auth.slice(7), JWT_SECRET);
    next();
  } catch (err) {
    return res.status(401).json({ error: 'Sesja wygasła — zaloguj się ponownie' });
  }
}
