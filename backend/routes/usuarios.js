// USUARIOS del personal  ->  /api/usuarios   (solo admin/superadmin; se protege en server.js)
// Para crear usuarios se usa POST /api/auth/register.
const router = require('express').Router();
const bcrypt = require('bcryptjs');
const pool = require('../db');

const CAMPOS = `u.id, u.nombres, u.apellidos, u.email, u.telefono, u.colegiatura, u.activo, u.ultimo_acceso,
                u.rol_id, r.nombre AS rol, u.especialidad_id, e.nombre AS especialidad`;
const DESDE = `FROM usuarios u JOIN roles r ON r.id = u.rol_id LEFT JOIN especialidades e ON e.id = u.especialidad_id`;

router.get('/', async (req, res, next) => {
  try {
    const q = `%${req.query.q || ''}%`;
    const [rows] = await pool.query(
      `SELECT ${CAMPOS} ${DESDE}
        WHERE (u.nombres LIKE ? OR u.apellidos LIKE ? OR u.email LIKE ?)
        ORDER BY u.activo DESC, u.nombres`, [q, q, q]);
    res.json(rows);
  } catch (e) { next(e); }
});

router.get('/:id', async (req, res, next) => {
  try {
    const [rows] = await pool.query(`SELECT ${CAMPOS} ${DESDE} WHERE u.id = ?`, [req.params.id]);
    if (!rows.length) return res.status(404).json({ error: 'Usuario no encontrado' });
    res.json(rows[0]);
  } catch (e) { next(e); }
});

// Editar datos y rol. Body: { nombres, apellidos, email, telefono?, colegiatura?, rol_id, especialidad_id? }
router.put('/:id', async (req, res, next) => {
  try {
    const b = req.body;
    if (!b.nombres || !b.apellidos || !b.email || !b.rol_id) {
      return res.status(400).json({ error: 'nombres, apellidos, email y rol_id son obligatorios' });
    }
    if (Number(b.rol_id) === 1 && req.usuario.rol !== 'superadmin') {
      return res.status(403).json({ error: 'Solo un superadmin puede asignar el rol superadmin' });
    }
    if (Number(req.params.id) === req.usuario.id && Number(b.rol_id) > 2) {
      return res.status(400).json({ error: 'No puedes quitarte a ti mismo el rol de administrador' });
    }
    const [r] = await pool.query(
      `UPDATE usuarios SET nombres=?, apellidos=?, email=?, telefono=?, colegiatura=?, rol_id=?, especialidad_id=?
        WHERE id=?`,
      [b.nombres, b.apellidos, b.email, b.telefono || null, b.colegiatura || null, b.rol_id,
       b.especialidad_id || null, req.params.id]);
    if (!r.affectedRows) return res.status(404).json({ error: 'Usuario no encontrado' });
    res.json({ mensaje: 'Usuario actualizado' });
  } catch (e) {
    if (e.code === 'ER_DUP_ENTRY') return res.status(409).json({ error: 'Ese email ya está registrado' });
    if (e.code === 'ER_NO_REFERENCED_ROW_2') return res.status(400).json({ error: 'rol o especialidad no existe' });
    next(e);
  }
});

// Activar / desactivar. Body: { activo: true|false }
router.patch('/:id/activo', async (req, res, next) => {
  try {
    if (Number(req.params.id) === req.usuario.id) {
      return res.status(400).json({ error: 'No puedes desactivar tu propia cuenta' });
    }
    const activo = req.body.activo ? 1 : 0;
    const [r] = await pool.query('UPDATE usuarios SET activo = ? WHERE id = ?', [activo, req.params.id]);
    if (!r.affectedRows) return res.status(404).json({ error: 'Usuario no encontrado' });
    res.json({ mensaje: activo ? 'Usuario activado' : 'Usuario desactivado' });
  } catch (e) { next(e); }
});

// Restablecer contraseña de otro usuario. Body: { password }
router.patch('/:id/password', async (req, res, next) => {
  try {
    if (!req.body.password || String(req.body.password).length < 6) {
      return res.status(400).json({ error: 'La contraseña debe tener al menos 6 caracteres' });
    }
    const hash = await bcrypt.hash(String(req.body.password), 10);
    const [r] = await pool.query('UPDATE usuarios SET password_hash = ? WHERE id = ?', [hash, req.params.id]);
    if (!r.affectedRows) return res.status(404).json({ error: 'Usuario no encontrado' });
    res.json({ mensaje: 'Contraseña restablecida' });
  } catch (e) { next(e); }
});

module.exports = router;
