// Rutas de AUTENTICACIÓN  ->  /api/auth
const router = require('express').Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const pool = require('../db');
const { requireAuth, requireRol, JWT_SECRET } = require('../middleware/auth');

// Iniciar sesión (pública).  Body: { email, password }  ->  devuelve un token
router.post('/login', async (req, res, next) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) return res.status(400).json({ error: 'email y password son obligatorios' });

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

// Datos del usuario con sesión iniciada (sirve para comprobar si el token sigue vigente)
router.get('/me', requireAuth, async (req, res, next) => {
  try {
    const [rows] = await pool.query(
      `SELECT u.id, u.nombres, u.apellidos, u.email, r.nombre AS rol, e.nombre AS especialidad
         FROM usuarios u
         JOIN roles r ON r.id = u.rol_id
         LEFT JOIN especialidades e ON e.id = u.especialidad_id
        WHERE u.id = ? AND u.activo = 1`,
      [req.usuario.id]
    );
    if (!rows.length) return res.status(401).json({ error: 'Usuario no encontrado o inactivo' });
    const u = rows[0];
    res.json({ id: u.id, nombre: `${u.nombres} ${u.apellidos}`, email: u.email, rol: u.rol, especialidad: u.especialidad });
  } catch (e) { next(e); }
});

// Registrar un usuario del personal. SOLO un administrador con sesión iniciada puede hacerlo.
// (Para crear el PRIMER usuario usa:  npm run crear-usuario)
// Body: { nombres, apellidos, email, password, rol_id, especialidad_id?, sede_id?, colegiatura? }
router.post('/register', requireAuth, requireRol('admin', 'superadmin'), async (req, res, next) => {
  try {
    const b = req.body;
    if (!b.nombres || !b.apellidos || !b.email || !b.password) {
      return res.status(400).json({ error: 'nombres, apellidos, email y password son obligatorios' });
    }
    if (String(b.password).length < 6) {
      return res.status(400).json({ error: 'La contraseña debe tener al menos 6 caracteres' });
    }
    const rolId = Number(b.rol_id) || 3;
    // Solo un superadmin puede crear otro superadmin
    if (rolId === 1 && req.usuario.rol !== 'superadmin') {
      return res.status(403).json({ error: 'Solo un superadmin puede crear otro superadmin' });
    }

    const hash = await bcrypt.hash(b.password, 10);
    const [r] = await pool.query(
      `INSERT INTO usuarios (clinica_id, sede_id, rol_id, especialidad_id, nombres, apellidos, email, password_hash, colegiatura)
       VALUES (?,?,?,?,?,?,?,?,?)`,
      [b.clinica_id || 1, b.sede_id || 1, rolId, b.especialidad_id || null,
       b.nombres, b.apellidos, b.email, hash, b.colegiatura || null]
    );
    res.status(201).json({ id: r.insertId, mensaje: 'Usuario creado' });
  } catch (e) {
    if (e.code === 'ER_DUP_ENTRY') return res.status(409).json({ error: 'Ese email ya está registrado' });
    if (e.code === 'ER_NO_REFERENCED_ROW_2') return res.status(400).json({ error: 'rol_id, especialidad_id o sede_id no existe' });
    next(e);
  }
});

module.exports = router;
