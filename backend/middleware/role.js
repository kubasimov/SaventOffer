/**
 * Middleware kontroli dostępu oparty na roli użytkownika.
 *
 * - admin: pe³ny dostêp do wszystkiego
 * - pracownik: tylko GET/HEAD (odczyt), z wyj¹tkiem dozwolonych œcie¿ek
 *
 * Wymaga requireAuth() uruchomionego wczeœniej (req.user musi istnieæ).
 */

module.exports = function requireRole(req, res, next) {
  // Admin ma pe³ny dostêp
  if (req.user.rola === 'admin') return next();

  // Tylko admin mo¿e zarz¹dzaæ u¿ytkownikami — blokuj wszystko na /api/users
  if (req.baseUrl === '/api/users') {
    return res.status(403).json({ error: 'Brak uprawnieñ administracyjnych' });
  }

  // Metody tylko-do-odczytu s¹ dozwolone dla ka¿dego
  if (req.method === 'GET' || req.method === 'HEAD') return next();

  // Dozwolone œcie¿ki POST/PUT/DELETE dla pracownika
  const fullPath = req.originalUrl || '';
  const allowedWritePaths = [
    '/api/pdf/',            // Generowanie PDF
    '/api/whisper/',        // Transkrypcja audio
    '/api/auth/zmien-haslo', // Zmiana w³asnego has³a
  ];

  for (const prefix of allowedWritePaths) {
    if (fullPath.startsWith(prefix)) return next();
  }

  // Wszystko inne blokowane
  return res.status(403).json({ error: 'Brak uprawnieñ do tej operacji' });
};
