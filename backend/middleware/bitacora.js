// Registra en la bitácora (MongoDB) cada operación que cambia datos: POST, PUT, PATCH y DELETE.
// También los intentos de inicio de sesión, exitosos o no.
const Bitacora = require('../models/Bitacora');
const { mongoListo } = require('../mongo');

const METODOS = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

function bitacora(req, res, next) {
  if (!METODOS.has(req.method) || !req.originalUrl.startsWith('/api/')) return next();
  const inicio = Date.now();
  res.on('finish', () => {
    if (!mongoListo()) return;
    Bitacora.create({
      usuario_id: req.usuario ? req.usuario.id : null,
      rol: req.usuario ? req.usuario.rol : null,
      metodo: req.method,
      ruta: req.originalUrl.split('?')[0],
      status: res.statusCode,
      ip: req.ip,
      duracion_ms: Date.now() - inicio,
    }).catch((e) => console.error('Bitácora:', e.message));
  });
  next();
}

module.exports = bitacora;
