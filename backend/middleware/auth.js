const jwt = require('jsonwebtoken');
const { jwtSecret } = require('../config');

function unauthorized(res, message = 'Wymagane logowanie') {
  return res.status(401).json({ error: message });
}

function forbidden(res, message = 'Brak uprawnień') {
  return res.status(403).json({ error: message });
}

module.exports = function requireAuth(req, res, next) {
  const auth = req.headers.authorization;
  if (!auth?.startsWith('Bearer ')) return unauthorized(res);
  try {
    req.user = jwt.verify(auth.slice(7), jwtSecret);
    next();
  } catch (err) {
    return unauthorized(res, 'Sesja wygasła — zaloguj się ponownie');
  }
};

module.exports.requireAdmin = function requireAdmin(req, res, next) {
  if (!req.user || req.user.rola !== 'admin') return forbidden(res);
  next();
};
