module.exports = function requireAdmin(req, res, next) {
  if (!req.user || req.user.rola !== 'admin') {
    return res.status(403).json({ error: 'Brak uprawnien administracyjnych' });
  }
  next();
};
