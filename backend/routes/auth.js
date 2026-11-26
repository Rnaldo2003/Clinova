// Rutas de AUTENTICACIÓN  ->  /api/auth
const router = require('express').Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const pool = require('../db');
const crypto = require('crypto');
const { requireAuth, requireRol, JWT_SECRET } = require('../middleware/auth');
const Recuperacion = require('../models/Recuperacion');
const { mongoListo } = require('../mongo');
const { enviarCorreo } = require('../services/correo');

const APP_URL = () => (process.env.APP_URL || `http://localhost:${process.env.PORT || 4000}`).replace(/\/$/, '');
const MINUTOS_ENLACE = 30;

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
    req.usuario = { id: user.id, rol: user.rol }; // para que la bitácora registre quién entró

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

// Cambiar MI contraseña. Body: { actual, nueva }
router.patch('/password', requireAuth, async (req, res, next) => {
  try {
    const { actual, nueva } = req.body;
    if (!actual || !nueva) return res.status(400).json({ error: 'actual y nueva son obligatorias' });
    if (String(nueva).length < 6) return res.status(400).json({ error: 'La nueva contraseña debe tener al menos 6 caracteres' });
    const [[u]] = await pool.query('SELECT password_hash FROM usuarios WHERE id = ?', [req.usuario.id]);
    if (!u || !(await bcrypt.compare(String(actual), u.password_hash))) {
      return res.status(400).json({ error: 'La contraseña actual no es correcta' });
    }
    await pool.query('UPDATE usuarios SET password_hash = ? WHERE id = ?', [await bcrypt.hash(String(nueva), 10), req.usuario.id]);
    res.json({ mensaje: 'Contraseña actualizada' });
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

// ============================================================
//  Recuperar contraseña (personal y pacientes)
//  1) POST /recuperar   { email, tipo: 'personal' | 'paciente' }
//     Si el correo existe, envía un enlace que vence en 30 minutos.
//     Siempre responde lo mismo, para no revelar qué correos existen.
//  2) POST /restablecer { token, nueva }
// ============================================================
router.post('/recuperar', async (req, res, next) => {
  try {
    if (!mongoListo()) return res.status(503).json({ error: 'El servicio no está disponible. Intenta más tarde.' });
    const email = String(req.body.email || '').trim().toLowerCase();
    const esPaciente = req.body.tipo === 'paciente';
    const respuesta = { mensaje: 'Si el correo está registrado, te enviamos un enlace para crear una nueva contraseña.' };
    if (!email) return res.status(400).json({ error: 'Escribe tu correo' });

    const [rows] = esPaciente
      ? await pool.query('SELECT id, nombres FROM pacientes WHERE LOWER(email) = ? AND activo = 1 AND portal_activo = 1', [email])
      : await pool.query('SELECT id, nombres FROM usuarios WHERE LOWER(email) = ? AND activo = 1', [email]);
    if (!rows.length) return res.json(respuesta);

    const token = crypto.randomBytes(32).toString('hex');
    await Recuperacion.create({
      tipo: esPaciente ? 'paciente' : 'usuario',
      ref_id: rows[0].id,
      token_hash: crypto.createHash('sha256').update(token).digest('hex'),
      expira: new Date(Date.now() + MINUTOS_ENLACE * 60 * 1000),
    });
    const enlace = `${APP_URL()}/${esPaciente ? 'portal.html' : 'login.html'}?reset=${token}`;
    await enviarCorreo({
      para: email,
      asunto: 'Clinnova · Restablecer tu contraseña',
      texto: `Hola ${rows[0].nombres}:\n\nPara crear una nueva contraseña abre este enlace (vence en ${MINUTOS_ENLACE} minutos):\n${enlace}\n\nSi no lo pediste, ignora este correo.`,
      html: `<p>Hola ${rows[0].nombres}:</p><p>Para crear una nueva contraseña haz clic aquí (vence en ${MINUTOS_ENLACE} minutos):</p>
             <p><a href="${enlace}" style="background:#0f72b8;color:#fff;padding:10px 18px;border-radius:8px;text-decoration:none">Crear nueva contraseña</a></p>
             <p style="color:#888">Si no lo pediste, ignora este correo.</p>`,
    });
    res.json(respuesta);
  } catch (e) { next(e); }
});

router.post('/restablecer', async (req, res, next) => {
  try {
    if (!mongoListo()) return res.status(503).json({ error: 'El servicio no está disponible. Intenta más tarde.' });
    const { token, nueva } = req.body;
    if (!token || typeof token !== 'string') return res.status(400).json({ error: 'Enlace inválido' });
    if (!nueva || String(nueva).length < 6) return res.status(400).json({ error: 'La contraseña debe tener al menos 6 caracteres' });
    const rec = await Recuperacion.findOne({
      token_hash: crypto.createHash('sha256').update(token).digest('hex'),
      usado: false,
      expira: { $gt: new Date() },
    });
    if (!rec) return res.status(400).json({ error: 'El enlace no es válido o ya venció. Pide uno nuevo.' });
    const hash = await bcrypt.hash(String(nueva), 10);
    const tabla = rec.tipo === 'paciente' ? 'pacientes' : 'usuarios';
    await pool.query(`UPDATE ${tabla} SET password_hash = ? WHERE id = ?`, [hash, rec.ref_id]);
    rec.usado = true;
    await rec.save();
    res.json({ mensaje: 'Contraseña actualizada. Ya puedes iniciar sesión.' });
  } catch (e) { next(e); }
});

module.exports = router;
