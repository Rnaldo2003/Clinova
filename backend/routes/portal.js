// ============================================================
//  PORTAL DE PACIENTES  ->  /api/portal
//  El paciente entra con su correo y contraseña (los activa la clínica
//  desde el Expediente). Su token solo sirve aquí: nunca abre las rutas
//  del personal, y aquí solo ve y cambia SUS propios datos.
// ============================================================
const router = require('express').Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const pool = require('../db');
const Mensaje = require('../models/Mensaje');
const { requirePaciente, JWT_SECRET } = require('../middleware/auth');
const { mongoListo } = require('../mongo');
const { notificar, notificarRoles } = require('../services/notificar');

const HORARIO = { inicio: 8 * 60, fin: 17 * 60, paso: 30 }; // 08:00 a 17:00, cada 30 min

// ---------- Iniciar sesión (pública) ----------
router.post('/login', async (req, res, next) => {
  try {
    const email = String(req.body.email || '').trim().toLowerCase();
    const { password } = req.body;
    if (!email || !password) return res.status(400).json({ error: 'Escribe tu correo y contraseña' });
    const [rows] = await pool.query(
      `SELECT id, nombres, apellidos, email, password_hash FROM pacientes
        WHERE LOWER(email) = ? AND activo = 1 AND portal_activo = 1`, [email]);
    const p = rows[0];
    if (!p || !p.password_hash || !(await bcrypt.compare(String(password), p.password_hash))) {
      return res.status(401).json({ error: 'Correo o contraseña incorrectos' });
    }
    await pool.query('UPDATE pacientes SET portal_ultimo_acceso = NOW() WHERE id = ?', [p.id]);
    req.paciente = { id: p.id }; // para la bitácora
    const token = jwt.sign({ id: p.id, tipo: 'paciente' }, JWT_SECRET, { expiresIn: '8h' });
    res.json({ token, paciente: { id: p.id, nombre: `${p.nombres} ${p.apellidos}`, email: p.email } });
  } catch (e) { next(e); }
});

// Todo lo de abajo exige sesión de paciente
router.use(requirePaciente);

// ---------- Mis datos ----------
router.get('/yo', async (req, res, next) => {
  try {
    const [rows] = await pool.query(
      `SELECT id, expediente_no, nombres, apellidos, fecha_nacimiento, sexo, telefono, email, direccion,
              tipo_sangre, alergias, contacto_emerg_nombre, contacto_emerg_telefono,
              TIMESTAMPDIFF(YEAR, fecha_nacimiento, CURDATE()) AS edad
         FROM pacientes WHERE id = ? AND activo = 1 AND portal_activo = 1`, [req.paciente.id]);
    if (!rows.length) return res.status(401).json({ error: 'Tu acceso al portal está desactivado' });
    res.json(rows[0]);
  } catch (e) { next(e); }
});

// Actualizar datos de contacto (no los clínicos: alergias y antecedentes los registra el médico)
router.put('/yo', async (req, res, next) => {
  try {
    const b = req.body;
    await pool.query(
      `UPDATE pacientes SET telefono=?, direccion=?, contacto_emerg_nombre=?, contacto_emerg_telefono=? WHERE id=?`,
      [b.telefono || null, b.direccion || null, b.contacto_emerg_nombre || null, b.contacto_emerg_telefono || null, req.paciente.id]);
    res.json({ mensaje: 'Datos actualizados' });
  } catch (e) { next(e); }
});

router.patch('/password', async (req, res, next) => {
  try {
    const { actual, nueva } = req.body;
    if (!actual || !nueva) return res.status(400).json({ error: 'Escribe tu contraseña actual y la nueva' });
    if (String(nueva).length < 6) return res.status(400).json({ error: 'La nueva contraseña debe tener al menos 6 caracteres' });
    const [[p]] = await pool.query('SELECT password_hash FROM pacientes WHERE id = ?', [req.paciente.id]);
    if (!p || !(await bcrypt.compare(String(actual), p.password_hash || ''))) {
      return res.status(400).json({ error: 'La contraseña actual no es correcta' });
    }
    await pool.query('UPDATE pacientes SET password_hash = ? WHERE id = ?', [await bcrypt.hash(String(nueva), 10), req.paciente.id]);
    res.json({ mensaje: 'Contraseña actualizada' });
  } catch (e) { next(e); }
});

// ---------- Resumen para la pantalla de inicio ----------
router.get('/resumen', async (req, res, next) => {
  try {
    const id = req.paciente.id;
    const [[proxima]] = await pool.query(
      `SELECT c.id, DATE_FORMAT(c.fecha, '%Y-%m-%d') AS fecha, c.hora_inicio, c.tipo, c.estado, c.motivo,
              CONCAT(u.nombres,' ',u.apellidos) AS medico
         FROM citas c JOIN usuarios u ON u.id = c.medico_id
        WHERE c.paciente_id = ? AND c.estado IN ('Pendiente','Confirmada','En espera')
          AND (c.fecha > CURDATE() OR (c.fecha = CURDATE() AND c.hora_inicio >= CURTIME() - INTERVAL 1 HOUR))
        ORDER BY c.fecha, c.hora_inicio LIMIT 1`, [id]);
    const [[rec]] = await pool.query('SELECT COUNT(*) AS n FROM recetas WHERE paciente_id = ?', [id]);
    const sinLeer = mongoListo()
      ? await Mensaje.countDocuments({ paciente_id: id, 'autor.tipo': 'usuario', leido_paciente: false })
      : 0;
    res.json({ proxima_cita: proxima || null, recetas: rec.n, mensajes_sin_leer: sinLeer });
  } catch (e) { next(e); }
});

// ---------- Citas ----------
router.get('/citas', async (req, res, next) => {
  try {
    const [rows] = await pool.query(
      `SELECT c.id, DATE_FORMAT(c.fecha, '%Y-%m-%d') AS fecha, c.hora_inicio, c.hora_fin, c.tipo, c.estado, c.motivo,
              CONCAT(u.nombres,' ',u.apellidos) AS medico, e.nombre AS especialidad
         FROM citas c JOIN usuarios u ON u.id = c.medico_id LEFT JOIN especialidades e ON e.id = u.especialidad_id
        WHERE c.paciente_id = ? ORDER BY c.fecha DESC, c.hora_inicio DESC LIMIT 100`, [req.paciente.id]);
    res.json(rows);
  } catch (e) { next(e); }
});

// Médicos con los que se puede pedir cita
router.get('/medicos', async (_req, res, next) => {
  try {
    const [rows] = await pool.query(
      `SELECT u.id, CONCAT(u.nombres,' ',u.apellidos) AS nombre, e.nombre AS especialidad
         FROM usuarios u JOIN roles r ON r.id = u.rol_id LEFT JOIN especialidades e ON e.id = u.especialidad_id
        WHERE r.nombre = 'medico' AND u.activo = 1 ORDER BY u.nombres`);
    res.json(rows);
  } catch (e) { next(e); }
});

const aHora = (min) => `${String(Math.floor(min / 60)).padStart(2, '0')}:${String(min % 60).padStart(2, '0')}`;
const esFechaValida = (f) => /^\d{4}-\d{2}-\d{2}$/.test(String(f || ''));

// Horarios libres de un médico en un día. ?medico_id=&fecha=AAAA-MM-DD
router.get('/disponibilidad', async (req, res, next) => {
  try {
    const { medico_id, fecha } = req.query;
    if (!medico_id || !esFechaValida(fecha)) return res.status(400).json({ error: 'medico_id y fecha son obligatorios' });
    const [ocupadas] = await pool.query(
      `SELECT TIME_FORMAT(hora_inicio, '%H:%i') AS h FROM citas
        WHERE medico_id = ? AND fecha = ? AND estado NOT IN ('Cancelada','No asistio')`, [medico_id, fecha]);
    const tomadas = new Set(ocupadas.map((o) => o.h));
    const ahora = new Date();
    const hoy = `${ahora.getFullYear()}-${String(ahora.getMonth() + 1).padStart(2, '0')}-${String(ahora.getDate()).padStart(2, '0')}`;
    const minAhora = ahora.getHours() * 60 + ahora.getMinutes();
    const libres = [];
    for (let m = HORARIO.inicio; m < HORARIO.fin; m += HORARIO.paso) {
      const h = aHora(m);
      if (tomadas.has(h)) continue;
      if (fecha === hoy && m <= minAhora + 60) continue; // hoy, solo con 1 h de anticipación
      libres.push(h);
    }
    const dia = new Date(fecha + 'T12:00:00').getDay();
    res.json({ fecha, horarios: dia === 0 ? [] : libres }); // domingo cerrado
  } catch (e) { next(e); }
});

// Solicitar cita. Body: { medico_id, fecha, hora_inicio, motivo? }  -> queda "Pendiente" hasta que la clínica confirme
router.post('/citas', async (req, res, next) => {
  try {
    const b = req.body;
    if (!b.medico_id || !esFechaValida(b.fecha) || !/^\d{2}:\d{2}/.test(String(b.hora_inicio || ''))) {
      return res.status(400).json({ error: 'Elige médico, fecha y hora' });
    }
    const hora = String(b.hora_inicio).slice(0, 5);
    const min = Number(hora.slice(0, 2)) * 60 + Number(hora.slice(3, 5));
    if (min < HORARIO.inicio || min >= HORARIO.fin || min % HORARIO.paso) {
      return res.status(400).json({ error: 'Esa hora está fuera del horario de atención' });
    }
    if (new Date(`${b.fecha}T${hora}:00`) <= new Date()) return res.status(400).json({ error: 'Elige una fecha y hora futura' });
    if (new Date(b.fecha + 'T12:00:00').getDay() === 0) return res.status(400).json({ error: 'Los domingos la clínica está cerrada' });

    const [[med]] = await pool.query(
      `SELECT u.id FROM usuarios u JOIN roles r ON r.id = u.rol_id WHERE u.id = ? AND r.nombre = 'medico' AND u.activo = 1`, [b.medico_id]);
    if (!med) return res.status(400).json({ error: 'Ese médico no está disponible' });

    // Máximo 3 solicitudes pendientes a la vez, para evitar abusos
    const [[pend]] = await pool.query(
      "SELECT COUNT(*) AS n FROM citas WHERE paciente_id = ? AND estado = 'Pendiente' AND fecha >= CURDATE()", [req.paciente.id]);
    if (pend.n >= 3) return res.status(400).json({ error: 'Ya tienes 3 citas pendientes de confirmar. Espera la confirmación o cancela alguna.' });

    const [choque] = await pool.query(
      `SELECT id FROM citas WHERE medico_id = ? AND fecha = ? AND hora_inicio = ? AND estado NOT IN ('Cancelada','No asistio')`,
      [b.medico_id, b.fecha, hora + ':00']);
    if (choque.length) return res.status(409).json({ error: 'Ese horario se acaba de ocupar. Elige otro.' });

    const motivo = b.motivo ? String(b.motivo).slice(0, 255) : null;
    const [r] = await pool.query(
      `INSERT INTO citas (clinica_id, paciente_id, medico_id, fecha, hora_inicio, tipo, estado, motivo, notas)
       VALUES (1, ?, ?, ?, ?, 'Consulta general', 'Pendiente', ?, 'Solicitada desde el portal de pacientes')`,
      [req.paciente.id, b.medico_id, b.fecha, hora + ':00', motivo]);

    const [[p]] = await pool.query('SELECT nombres, apellidos FROM pacientes WHERE id = ?', [req.paciente.id]);
    const aviso = {
      tipo: 'Cita', titulo: 'Solicitud de cita desde el portal',
      descripcion: `${p.nombres} ${p.apellidos} · ${b.fecha} ${hora} · por confirmar`, datos: { cita_id: r.insertId },
    };
    await notificar([b.medico_id], aviso);
    await notificarRoles(['recepcion'], aviso);
    res.status(201).json({ id: r.insertId, mensaje: 'Solicitud enviada. La clínica confirmará tu cita.' });
  } catch (e) { next(e); }
});

// Cancelar una cita propia que aún no ha pasado
router.patch('/citas/:id/cancelar', async (req, res, next) => {
  try {
    const [[c]] = await pool.query(
      `SELECT id, medico_id, estado, DATE_FORMAT(fecha, '%Y-%m-%d') AS fecha, TIME_FORMAT(hora_inicio, '%H:%i') AS hora
         FROM citas WHERE id = ? AND paciente_id = ?`, [req.params.id, req.paciente.id]);
    if (!c) return res.status(404).json({ error: 'Cita no encontrada' });
    if (!['Pendiente', 'Confirmada'].includes(c.estado)) return res.status(400).json({ error: 'Esta cita ya no se puede cancelar' });
    if (new Date(`${c.fecha}T${c.hora}:00`) <= new Date()) return res.status(400).json({ error: 'No se puede cancelar una cita que ya pasó' });
    await pool.query("UPDATE citas SET estado = 'Cancelada' WHERE id = ?", [c.id]);
    const [[p]] = await pool.query('SELECT nombres, apellidos FROM pacientes WHERE id = ?', [req.paciente.id]);
    await notificar([c.medico_id], {
      tipo: 'Cita', titulo: 'Cita cancelada por el paciente',
      descripcion: `${p.nombres} ${p.apellidos} · ${c.fecha} ${c.hora}`, datos: { cita_id: c.id },
    });
    res.json({ mensaje: 'Cita cancelada' });
  } catch (e) { next(e); }
});

// ---------- Recetas y consultas ----------
router.get('/recetas', async (req, res, next) => {
  try {
    const [recetas] = await pool.query(
      `SELECT r.id, r.fecha, r.notas, CONCAT(u.nombres,' ',u.apellidos) AS medico
         FROM recetas r JOIN usuarios u ON u.id = r.medico_id
        WHERE r.paciente_id = ? ORDER BY r.fecha DESC`, [req.paciente.id]);
    for (const r of recetas) {
      [r.items] = await pool.query(
        'SELECT medicamento, dosis, frecuencia, duracion, indicaciones FROM receta_items WHERE receta_id = ? ORDER BY id', [r.id]);
    }
    res.json(recetas);
  } catch (e) { next(e); }
});

// Receta completa para imprimir (mismo formato que usa el panel)
router.get('/recetas/:id', async (req, res, next) => {
  try {
    const [rows] = await pool.query(
      `SELECT r.*, CONCAT(p.nombres,' ',p.apellidos) AS paciente, p.expediente_no, p.alergias,
              TIMESTAMPDIFF(YEAR, p.fecha_nacimiento, CURDATE()) AS edad,
              CONCAT(u.nombres,' ',u.apellidos) AS medico, u.colegiatura, e.nombre AS especialidad, cl.nombre AS clinica
         FROM recetas r JOIN pacientes p ON p.id = r.paciente_id JOIN usuarios u ON u.id = r.medico_id
         LEFT JOIN especialidades e ON e.id = u.especialidad_id LEFT JOIN clinicas cl ON cl.id = u.clinica_id
        WHERE r.id = ? AND r.paciente_id = ?`, [req.params.id, req.paciente.id]);
    if (!rows.length) return res.status(404).json({ error: 'Receta no encontrada' });
    const [items] = await pool.query('SELECT * FROM receta_items WHERE receta_id = ? ORDER BY id', [req.params.id]);
    res.json({ ...rows[0], items });
  } catch (e) { next(e); }
});

// Resumen de consultas (sin notas internas del médico)
router.get('/consultas', async (req, res, next) => {
  try {
    const [rows] = await pool.query(
      `SELECT c.id, c.fecha, c.motivo, c.diagnostico, c.indicaciones, CONCAT(u.nombres,' ',u.apellidos) AS medico
         FROM consultas c JOIN usuarios u ON u.id = c.medico_id
        WHERE c.paciente_id = ? ORDER BY c.fecha DESC LIMIT 50`, [req.paciente.id]);
    res.json(rows);
  } catch (e) { next(e); }
});

// ---------- Mensajes con la clínica (MongoDB) ----------
function requireMongo(_req, res, next) {
  if (!mongoListo()) return res.status(503).json({ error: 'Los mensajes no están disponibles en este momento' });
  next();
}

// Mi conversación. Al abrirla, los mensajes de la clínica quedan como leídos.
router.get('/mensajes', requireMongo, async (req, res, next) => {
  try {
    const msgs = await Mensaje.find({ paciente_id: req.paciente.id })
      .sort({ creado_en: -1 }).limit(200).lean();
    await Mensaje.updateMany(
      { paciente_id: req.paciente.id, 'autor.tipo': 'usuario', leido_paciente: false }, { $set: { leido_paciente: true } });
    res.json(msgs.reverse());
  } catch (e) { next(e); }
});

// Enviar un mensaje a la clínica. Body: { texto, area? }
router.post('/mensajes', requireMongo, async (req, res, next) => {
  try {
    const texto = typeof req.body.texto === 'string' ? req.body.texto.trim() : '';
    if (!texto || texto.length > 2000) return res.status(400).json({ error: 'Escribe un mensaje (máx. 2000 caracteres)' });
    const AREAS = ['Administrativa', 'Clinica', 'Laboratorio', 'Recepcion'];
    const area = AREAS.includes(req.body.area) ? req.body.area : 'Clinica';
    const [[p]] = await pool.query('SELECT nombres, apellidos FROM pacientes WHERE id = ?', [req.paciente.id]);
    const nombre = `${p.nombres} ${p.apellidos}`;
    const msg = await Mensaje.create({
      paciente_id: req.paciente.id, autor: { tipo: 'paciente', id: req.paciente.id, nombre },
      texto, area, leido: false, leido_paciente: true,
    });
    await notificarRoles(['medico', 'recepcion', 'admin'], {
      tipo: 'Mensaje', titulo: `Nuevo mensaje de ${nombre}`, descripcion: texto.slice(0, 120),
      datos: { paciente_id: req.paciente.id, mensaje_id: String(msg._id) },
    });
    res.status(201).json(msg);
  } catch (e) { next(e); }
});

module.exports = router;
