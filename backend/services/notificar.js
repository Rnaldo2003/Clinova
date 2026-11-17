// Crea notificaciones en MongoDB. Nunca rompe la petición principal: si falla, solo lo registra.
const pool = require('../db');
const Notificacion = require('../models/Notificacion');
const { mongoListo } = require('../mongo');

// Notificar a usuarios concretos por id
async function notificar(usuarioIds, { tipo, titulo, descripcion, datos }) {
  if (!mongoListo()) return;
  const ids = [...new Set(usuarioIds.filter(Boolean).map(Number))];
  if (!ids.length) return;
  try {
    await Notificacion.insertMany(ids.map((usuario_id) => ({ usuario_id, tipo, titulo, descripcion, datos })));
  } catch (e) {
    console.error('No se pudo crear la notificación:', e.message);
  }
}

// Notificar a todos los usuarios activos con alguno de estos roles
async function notificarRoles(roles, aviso) {
  try {
    const [rows] = await pool.query(
      `SELECT u.id FROM usuarios u JOIN roles r ON r.id = u.rol_id
        WHERE u.activo = 1 AND r.nombre IN (?)`,
      [roles]
    );
    await notificar(rows.map((r) => r.id), aviso);
  } catch (e) {
    console.error('No se pudo notificar por rol:', e.message);
  }
}

module.exports = { notificar, notificarRoles };
