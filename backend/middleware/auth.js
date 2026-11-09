// Middlewares de autenticación y permisos
const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET;

// Exige un token válido en el header:  Authorization: Bearer <token>
function requireAuth(req, res, next) {
  const h = req.headers.authorization || '';
  const token = h.startsWith('Bearer ') ? h.slice(7) : null;
  if (!token) return res.status(401).json({ error: 'Falta el token. Inicia sesión.' });
  try {
    req.usuario = jwt.verify(token, JWT_SECRET); // { id, rol }
    next();
  } catch {
    res.status(401).json({ error: 'Token inválido o expirado. Inicia sesión de nuevo.' });
  }
}

// Exige que el usuario tenga uno de los roles indicados. Úsalo DESPUÉS de requireAuth.
//   router.post('/', requireRol('admin', 'superadmin'), ...)
function requireRol(...roles) {
  return (req, res, next) => {
    if (!req.usuario || !roles.includes(req.usuario.rol)) {
      return res.status(403).json({ error: 'No tienes permiso para esta acción' });
    }
    next();
  };
}

module.exports = { requireAuth, requireRol, JWT_SECRET };
