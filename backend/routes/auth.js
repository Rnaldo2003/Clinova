// Rutas de AUTENTICACIÓN  ->  /api/auth
const router = require('express').Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const pool = require('../db');

const JWT_SECRET = process.env.JWT_SECRET || 'cambia_esto';

// Registrar un usuario del personal (la contraseña se guarda encriptada con bcrypt)
// Body: { nombres, apellidos, email, password, rol_id, especialidad_id?, clinica_id? }
router.post('/register', async (req, res, next) => {
  try {
    const b = req.body;
    if (!b.email || !b.password) return res.status(400).json({ error: 'email y password son obligatorios' });

    const hash = await bcrypt.hash(b.password, 10);
    const [r] = await pool.query(
      `INSERT INTO usuarios (clinica_id, sede_id, rol_id, especialidad_id, nombres, apellidos, email, password_hash, colegiatura)
       VALUES (?,?,?,?,?,?,?,?,?)`,
      [b.clinica_id || 1, b.sede_id || 1, b.rol_id || 3, b.especialidad_id || null,
       b.nombres, b.apellidos, b.email, hash, b.colegiatura || null]
    );
    res.status(201).json({ id: r.insertId, mensaje: 'Usuario creado' });
  } catch (e) {
    if (e.code === 'ER_DUP_ENTRY') return res.status(409).json({ error: 'Ese email ya está registrado' });
    next(e);
  }
});

// Iniciar sesión.  Body: { email, password }  ->  devuelve un token
router.post('/login', async (req, res, next) => {
  try {
    const { email, password } = req.body;
    const [rows] = await pool.query(
      `SELECT u.id, u.nombres, u.apellidos, u.email, u.password_hash, r.nombre AS rol
         FROM usuarios u JOIN roles r ON r.id = u.rol_id
        WHERE u.email = ? AND u.activo = 1`,
      [email]
    );
    if (!rows.length) return res.status(401).json({ error: 'Credenciales inválidas' });

    const user = rows[0];
    const ok = await bcrypt.compare(password, user.password_hash);
    if (!ok) return res.status(401).json({ error: 'Credenciales inválidas' });

    await pool.query('UPDATE usuarios SET ultimo_acceso = NOW() WHERE id = ?', [user.id]);

    const token = jwt.sign({ id: user.id, rol: user.rol }, JWT_SECRET, { expiresIn: '8h' });
    res.json({
      token,
      usuario: { id: user.id, nombre: `${user.nombres} ${user.apellidos}`, email: user.email, rol: user.rol },
    });
  } catch (e) { next(e); }
});

module.exports = router;

// ------------------------------------------------------------
// Middleware opcional para proteger rutas (úsalo cuando quieras):
//   const { requireAuth } = require('./routes/auth');
//   app.use('/api/pacientes', requireAuth, require('./routes/pacientes'));
// ------------------------------------------------------------
function requireAuth(req, res, next) {
  const h = req.headers.authorization || '';
  const token = h.startsWith('Bearer ') ? h.slice(7) : null;
  if (!token) return res.status(401).json({ error: 'Falta el token' });
  try {
    req.usuario = jwt.verify(token, JWT_SECRET);
    next();
  } catch {
    res.status(401).json({ error: 'Token inválido o expirado' });
  }
}
module.exports.requireAuth = requireAuth;
