// RECETAS  ->  /api/recetas
const router = require('express').Router();
const pool = require('../db');
const { requireRol } = require('../middleware/auth');

// Listar. Filtros: ?paciente_id ?medico_id ?q (paciente o medicamento)
router.get('/', async (req, res, next) => {
  try {
    const where = [], params = [];
    if (req.query.paciente_id) { where.push('r.paciente_id = ?'); params.push(req.query.paciente_id); }
    if (req.query.medico_id)   { where.push('r.medico_id = ?');   params.push(req.query.medico_id); }
    if (req.query.q) {
      const q = `%${req.query.q}%`;
      where.push("(CONCAT(p.nombres,' ',p.apellidos) LIKE ? OR EXISTS (SELECT 1 FROM receta_items i WHERE i.receta_id = r.id AND i.medicamento LIKE ?))");
      params.push(q, q);
    }
    const [rows] = await pool.query(
      `SELECT r.id, r.fecha, r.notas, r.consulta_id,
              r.paciente_id, CONCAT(p.nombres,' ',p.apellidos) AS paciente, p.expediente_no,
              r.medico_id, CONCAT(u.nombres,' ',u.apellidos) AS medico,
              (SELECT GROUP_CONCAT(i.medicamento SEPARATOR ', ') FROM receta_items i WHERE i.receta_id = r.id) AS medicamentos
         FROM recetas r JOIN pacientes p ON p.id = r.paciente_id JOIN usuarios u ON u.id = r.medico_id
        ${where.length ? 'WHERE ' + where.join(' AND ') : ''}
        ORDER BY r.fecha DESC LIMIT 300`, params);
    res.json(rows);
  } catch (e) { next(e); }
});

// Una receta con sus medicamentos y los datos para imprimirla
router.get('/:id', async (req, res, next) => {
  try {
    const [rows] = await pool.query(
      `SELECT r.*, CONCAT(p.nombres,' ',p.apellidos) AS paciente, p.expediente_no, p.alergias,
              TIMESTAMPDIFF(YEAR, p.fecha_nacimiento, CURDATE()) AS edad,
              CONCAT(u.nombres,' ',u.apellidos) AS medico, u.colegiatura, e.nombre AS especialidad,
              cl.nombre AS clinica
         FROM recetas r
         JOIN pacientes p ON p.id = r.paciente_id
         JOIN usuarios u ON u.id = r.medico_id
         LEFT JOIN especialidades e ON e.id = u.especialidad_id
         LEFT JOIN clinicas cl ON cl.id = u.clinica_id
        WHERE r.id = ?`, [req.params.id]);
    if (!rows.length) return res.status(404).json({ error: 'Receta no encontrada' });
    const [items] = await pool.query('SELECT * FROM receta_items WHERE receta_id = ? ORDER BY id', [req.params.id]);
    res.json({ ...rows[0], items });
  } catch (e) { next(e); }
});

// Crear receta con sus medicamentos (una sola transacción)
// Body: { paciente_id, consulta_id?, notas?, items: [{ medicamento, dosis?, frecuencia?, duracion?, indicaciones? }] }
router.post('/', requireRol('medico', 'admin', 'superadmin'), async (req, res, next) => {
  const b = req.body;
  const items = Array.isArray(b.items) ? b.items.filter((i) => i && String(i.medicamento || '').trim()) : [];
  if (!b.paciente_id) return res.status(400).json({ error: 'paciente_id es obligatorio' });
  if (!items.length) return res.status(400).json({ error: 'Agrega al menos un medicamento' });
  if (items.length > 20) return res.status(400).json({ error: 'Máximo 20 medicamentos por receta' });
  const medicoId = req.usuario.rol === 'medico' ? req.usuario.id : (b.medico_id || req.usuario.id);
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    const [r] = await conn.query(
      'INSERT INTO recetas (consulta_id, paciente_id, medico_id, notas) VALUES (?,?,?,?)',
      [b.consulta_id || null, b.paciente_id, medicoId, b.notas || null]);
    for (const i of items) {
      await conn.query(
        'INSERT INTO receta_items (receta_id, medicamento, dosis, frecuencia, duracion, indicaciones) VALUES (?,?,?,?,?,?)',
        [r.insertId, String(i.medicamento).trim(), i.dosis || null, i.frecuencia || null, i.duracion || null, i.indicaciones || null]);
    }
    await conn.commit();
    res.status(201).json({ id: r.insertId, mensaje: 'Receta creada' });
  } catch (e) {
    await conn.rollback();
    if (e.code === 'ER_NO_REFERENCED_ROW_2') return res.status(400).json({ error: 'El paciente, médico o consulta no existe' });
    next(e);
  } finally { conn.release(); }
});

// Anular receta: solo quien la hizo o un admin
router.delete('/:id', requireRol('medico', 'admin', 'superadmin'), async (req, res, next) => {
  try {
    const [[r]] = await pool.query('SELECT medico_id FROM recetas WHERE id = ?', [req.params.id]);
    if (!r) return res.status(404).json({ error: 'Receta no encontrada' });
    if (req.usuario.rol === 'medico' && r.medico_id !== req.usuario.id) {
      return res.status(403).json({ error: 'Solo el médico que la hizo puede anularla' });
    }
    await pool.query('DELETE FROM recetas WHERE id = ?', [req.params.id]); // los items se borran en cascada
    res.json({ mensaje: 'Receta anulada' });
  } catch (e) { next(e); }
});

module.exports = router;
