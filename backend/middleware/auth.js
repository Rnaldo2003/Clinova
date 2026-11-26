// Middlewares de autenticación y permisos
const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET;

// Exige un token válido en el header:  Authorization: Bearer <token>
function requireAuth(req, res, next) {
  const h = req.headers.authorization || '';
  const token = h.startsWith('Bearer ') ? h.slice(7) : null;
  if (!token) return res.status(401).json({ error: 'Falta el token. Inicia sesión.' });
  let datos;
  try {
    datos = jwt.verify(token, JWT_SECRET); // { id, rol }
  } catch {
    return res.status(401).json({ error: 'Token inválido o expirado. Inicia sesión de nuevo.' });
  }
  // Un token del portal de pacientes nunca entra a las rutas del personal
  if (datos.tipo === 'paciente') return res.status(403).json({ error: 'Esta sección es solo para el personal de la clínica' });
  req.usuario = datos;
  next();
}

// Exige un token del PORTAL DE PACIENTES. Deja el id en req.paciente.id
function requirePaciente(req, res, next) {
  const h = req.headers.authorization || '';
  const token = h.startsWith('Bearer ') ? h.slice(7) : null;
  if (!token) return res.status(401).json({ error: 'Falta el token. Inicia sesión.' });
  let datos;
  try {
    datos = jwt.verify(token, JWT_SECRET);
  } catch {
    return res.status(401).json({ error: 'Tu sesión venció. Inicia sesión de nuevo.' });
  }
  if (datos.tipo !== 'paciente') return res.status(403).json({ error: 'Esta sección es solo para pacientes' });
  req.paciente = { id: datos.id };
  next();
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

module.exports = { requireAuth, requireRol, requirePaciente, JWT_SECRET };
