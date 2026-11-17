// Rutas de MENSAJES (MongoDB)  ->  /api/mensajes
const router = require('express').Router();
const mongoose = require('mongoose');
const pool = require('../db');
const Mensaje = require('../models/Mensaje');
const { notificarRoles } = require('../services/notificar');

const AREAS = ['Administrativa', 'Clinica', 'Laboratorio', 'Recepcion'];

// Busca el paciente activo en MySQL; devuelve null si no existe
async function buscarPaciente(id) {
  const [rows] = await pool.query(
    'SELECT id, nombres, apellidos FROM pacientes WHERE id = ? AND activo = 1', [id]);
  return rows[0] || null;
}

function validarTexto(texto) {
  return typeof texto === 'string' && texto.trim().length > 0 && texto.length <= 2000;
}

// Lista de conversaciones: una por paciente, con el último mensaje y cuántos no leídos tiene
router.get('/', async (_req, res, next) => {
  try {
    // Últimos 2000 mensajes, del más reciente al más antiguo; se agrupan por paciente
    const msgs = await Mensaje.find({}, 'paciente_id texto autor.tipo creado_en leido')
      .sort({ creado_en: -1 }).limit(2000).lean();
    const porPaciente = new Map();
    for (const m of msgs) {
      let c = porPaciente.get(m.paciente_id);
      if (!c) {
        c = { _id: m.paciente_id, ultimo_texto: m.texto, ultimo_autor: m.autor.tipo, ultima_fecha: m.creado_en, no_leidos: 0 };
        porPaciente.set(m.paciente_id, c);
      }
      if (m.autor.tipo === 'paciente' && !m.leido) c.no_leidos++;
    }
    const conv = [...porPaciente.values()]; // ya quedan ordenadas por el mensaje más reciente
    if (!conv.length) return res.json([]);

    // Nombres de los pacientes desde MySQL
    const [pacs] = await pool.query(
      'SELECT id, nombres, apellidos FROM pacientes WHERE id IN (?)', [conv.map((c) => c._id)]);
    const nombre = Object.fromEntries(pacs.map((p) => [p.id, `${p.nombres} ${p.apellidos}`]));

    res.json(conv.map((c) => ({
      paciente_id: c._id,
      paciente: nombre[c._id] || 'Paciente',
      ultimo_texto: c.ultimo_texto,
      ultimo_autor: c.ultimo_autor,
      ultima_fecha: c.ultima_fecha,
      no_leidos: c.no_leidos,
    })));
  } catch (e) { next(e); }
});

// Conversación completa con un paciente (del más antiguo al más reciente)
router.get('/paciente/:pacienteId', async (req, res, next) => {
  try {
    const pid = Number(req.params.pacienteId);
    if (!Number.isInteger(pid)) return res.status(400).json({ error: 'pacienteId inválido' });
    const limite = Math.min(Number(req.query.limite) || 100, 500);
    const msgs = await Mensaje.find({ paciente_id: pid }).sort({ creado_en: -1 }).limit(limite).lean();
    res.json(msgs.reverse());
  } catch (e) { next(e); }
});

// Marcar como leídos todos los mensajes del paciente en esa conversación
router.patch('/paciente/:pacienteId/leidos', async (req, res, next) => {
  try {
    const pid = Number(req.params.pacienteId);
    if (!Number.isInteger(pid)) return res.status(400).json({ error: 'pacienteId inválido' });
    const r = await Mensaje.updateMany(
      { paciente_id: pid, 'autor.tipo': 'paciente', leido: false }, { $set: { leido: true } });
    res.json({ mensaje: 'Mensajes marcados como leídos', actualizados: r.modifiedCount });
  } catch (e) { next(e); }
});

// Enviar un mensaje de la clínica al paciente. El autor sale del token, nunca del body.
// Body: { paciente_id, texto, area?, adjunto? }
router.post('/', async (req, res, next) => {
  try {
    const { paciente_id, texto, area, adjunto } = req.body;
    if (!validarTexto(texto)) return res.status(400).json({ error: 'texto es obligatorio (máx. 2000 caracteres)' });
    if (area && !AREAS.includes(area)) return res.status(400).json({ error: 'area inválida', permitidos: AREAS });
    const pac = await buscarPaciente(paciente_id);
    if (!pac) return res.status(404).json({ error: 'Paciente no encontrado' });

    const [[u]] = await pool.query('SELECT nombres, apellidos FROM usuarios WHERE id = ?', [req.usuario.id]);
    const msg = await Mensaje.create({
      paciente_id: pac.id,
      autor: { tipo: 'usuario', id: req.usuario.id, nombre: u ? `${u.nombres} ${u.apellidos}` : 'Clínica' },
      texto, area, adjunto, leido: true,
    });
    res.status(201).json(msg);
  } catch (e) { next(e); }
});

// Registrar un mensaje que ESCRIBIÓ el paciente (por teléfono, WhatsApp o mostrador).
// Mientras no exista una app para pacientes, recepción lo registra aquí. Avisa al personal.
// Body: { paciente_id, texto, area? }
router.post('/entrante', async (req, res, next) => {
  try {
    const { paciente_id, texto, area } = req.body;
    if (!validarTexto(texto)) return res.status(400).json({ error: 'texto es obligatorio (máx. 2000 caracteres)' });
    if (area && !AREAS.includes(area)) return res.status(400).json({ error: 'area inválida', permitidos: AREAS });
    const pac = await buscarPaciente(paciente_id);
    if (!pac) return res.status(404).json({ error: 'Paciente no encontrado' });

    const nombre = `${pac.nombres} ${pac.apellidos}`;
    const msg = await Mensaje.create({
      paciente_id: pac.id, autor: { tipo: 'paciente', id: pac.id, nombre }, texto, area,
    });
    await notificarRoles(['medico', 'recepcion', 'admin'], {
      tipo: 'Mensaje', titulo: `Nuevo mensaje de ${nombre}`,
      descripcion: texto.slice(0, 120), datos: { paciente_id: pac.id, mensaje_id: String(msg._id) },
    });
    res.status(201).json(msg);
  } catch (e) { next(e); }
});

// Borrar un mensaje: solo quien lo escribió o un administrador
router.delete('/:id', async (req, res, next) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) return res.status(400).json({ error: 'id inválido' });
    const msg = await Mensaje.findById(req.params.id);
    if (!msg) return res.status(404).json({ error: 'Mensaje no encontrado' });
    const esAutor = msg.autor.tipo === 'usuario' && msg.autor.id === req.usuario.id;
    if (!esAutor && !['admin', 'superadmin'].includes(req.usuario.rol)) {
      return res.status(403).json({ error: 'Solo puedes borrar tus propios mensajes' });
    }
    await msg.deleteOne();
    res.json({ mensaje: 'Mensaje eliminado' });
  } catch (e) { next(e); }
});

module.exports = router;
