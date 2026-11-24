// CONSULTAS médicas  ->  /api/consultas
const router = require('express').Router();
const pool = require('../db');
const { requireRol } = require('../middleware/auth');

const PUEDEN_EDITAR = requireRol('medico', 'admin', 'superadmin');

// Listar. Filtros: ?paciente_id ?medico_id ?desde=AAAA-MM-DD ?hasta ?q (diagnóstico, paciente o CIE-10)
router.get('/', async (req, res, next) => {
  try {
    const where = [], params = [];
    if (req.query.paciente_id) { where.push('c.paciente_id = ?'); params.push(req.query.paciente_id); }
    if (req.query.medico_id)   { where.push('c.medico_id = ?');   params.push(req.query.medico_id); }
    if (req.query.desde)       { where.push('DATE(c.fecha) >= ?'); params.push(req.query.desde); }
    if (req.query.hasta)       { where.push('DATE(c.fecha) <= ?'); params.push(req.query.hasta); }
    if (req.query.q) {
      const q = `%${req.query.q}%`;
      where.push("(c.diagnostico LIKE ? OR c.cie10 LIKE ? OR CONCAT(p.nombres,' ',p.apellidos) LIKE ? OR c.motivo LIKE ?)");
      params.push(q, q, q, q);
    }
    const [rows] = await pool.query(
      `SELECT c.id, c.fecha, c.motivo, c.diagnostico, c.cie10, c.cita_id,
              c.paciente_id, CONCAT(p.nombres,' ',p.apellidos) AS paciente, p.expediente_no,
              c.medico_id, CONCAT(u.nombres,' ',u.apellidos) AS medico,
              (SELECT COUNT(*) FROM recetas r WHERE r.consulta_id = c.id) AS recetas
         FROM consultas c
         JOIN pacientes p ON p.id = c.paciente_id
         JOIN usuarios u ON u.id = c.medico_id
        ${where.length ? 'WHERE ' + where.join(' AND ') : ''}
        ORDER BY c.fecha DESC LIMIT 300`, params);
    res.json(rows);
  } catch (e) { next(e); }
});

// Una consulta completa, con sus recetas
router.get('/:id', async (req, res, next) => {
  try {
    const [rows] = await pool.query(
      `SELECT c.*, CONCAT(p.nombres,' ',p.apellidos) AS paciente, p.expediente_no,
              CONCAT(u.nombres,' ',u.apellidos) AS medico
         FROM consultas c JOIN pacientes p ON p.id = c.paciente_id JOIN usuarios u ON u.id = c.medico_id
        WHERE c.id = ?`, [req.params.id]);
    if (!rows.length) return res.status(404).json({ error: 'Consulta no encontrada' });
    const [recetas] = await pool.query('SELECT id, fecha, notas FROM recetas WHERE consulta_id = ?', [req.params.id]);
    for (const r of recetas) {
      [r.items] = await pool.query('SELECT * FROM receta_items WHERE receta_id = ?', [r.id]);
    }
    res.json({ ...rows[0], recetas });
  } catch (e) { next(e); }
});

function datosConsulta(b) {
  return [b.motivo || null, b.historia || null, b.exploracion || null, b.diagnostico || null,
          b.cie10 ? String(b.cie10).toUpperCase().slice(0, 10) : null, b.tratamiento || null, b.indicaciones || null];
}

// Registrar consulta. Si viene cita_id, la cita pasa a "Atendida".
// Body: { paciente_id, cita_id?, medico_id? (solo admin), motivo, historia, exploracion, diagnostico, cie10, tratamiento, indicaciones }
router.post('/', PUEDEN_EDITAR, async (req, res, next) => {
  const b = req.body;
  if (!b.paciente_id) return res.status(400).json({ error: 'paciente_id es obligatorio' });
  if (!b.motivo && !b.diagnostico) return res.status(400).json({ error: 'Escribe al menos el motivo o el diagnóstico' });
  // El médico es quien inicia sesión; un admin puede indicar otro
  const medicoId = req.usuario.rol === 'medico' ? req.usuario.id : (b.medico_id || req.usuario.id);
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    const [r] = await conn.query(
      `INSERT INTO consultas (cita_id, paciente_id, medico_id, motivo, historia, exploracion, diagnostico, cie10, tratamiento, indicaciones)
       VALUES (?,?,?,?,?,?,?,?,?,?)`,
      [b.cita_id || null, b.paciente_id, medicoId, ...datosConsulta(b)]);
    if (b.cita_id) await conn.query("UPDATE citas SET estado = 'Atendida' WHERE id = ?", [b.cita_id]);
    await conn.commit();
    res.status(201).json({ id: r.insertId, mensaje: 'Consulta registrada' });
  } catch (e) {
    await conn.rollback();
    if (e.code === 'ER_NO_REFERENCED_ROW_2') return res.status(400).json({ error: 'El paciente, médico o cita no existe' });
    next(e);
  } finally { conn.release(); }
});

// Editar consulta (solo el médico que la hizo o un admin)
router.put('/:id', PUEDEN_EDITAR, async (req, res, next) => {
  try {
    const [[c]] = await pool.query('SELECT medico_id FROM consultas WHERE id = ?', [req.params.id]);
    if (!c) return res.status(404).json({ error: 'Consulta no encontrada' });
    if (req.usuario.rol === 'medico' && c.medico_id !== req.usuario.id) {
      return res.status(403).json({ error: 'Solo el médico que hizo la consulta puede editarla' });
    }
    await pool.query(
      `UPDATE consultas SET motivo=?, historia=?, exploracion=?, diagnostico=?, cie10=?, tratamiento=?, indicaciones=?
        WHERE id=?`, [...datosConsulta(req.body), req.params.id]);
    res.json({ mensaje: 'Consulta actualizada' });
  } catch (e) { next(e); }
});

module.exports = router;
