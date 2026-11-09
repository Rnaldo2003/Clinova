// Rutas de CITAS (agenda)  ->  /api/citas
const router = require('express').Router();
const pool = require('../db');

// Listar citas. Filtros opcionales: ?fecha=YYYY-MM-DD  ?medico_id=1  ?estado=Confirmada
router.get('/', async (req, res, next) => {
  try {
    const where = [];
    const params = [];
    if (req.query.fecha)     { where.push('c.fecha = ?');     params.push(req.query.fecha); }
    if (req.query.medico_id) { where.push('c.medico_id = ?'); params.push(req.query.medico_id); }
    if (req.query.estado)    { where.push('c.estado = ?');    params.push(req.query.estado); }
    const filtro = where.length ? 'WHERE ' + where.join(' AND ') : '';

    const [rows] = await pool.query(
      `SELECT c.id, c.fecha, c.hora_inicio, c.hora_fin, c.tipo, c.estado, c.motivo,
              p.id AS paciente_id, CONCAT(p.nombres,' ',p.apellidos) AS paciente,
              TIMESTAMPDIFF(YEAR, p.fecha_nacimiento, CURDATE()) AS edad,
              CONCAT(u.nombres,' ',u.apellidos) AS medico
         FROM citas c
         JOIN pacientes p ON p.id = c.paciente_id
         JOIN usuarios  u ON u.id = c.medico_id
         ${filtro}
        ORDER BY c.fecha, c.hora_inicio`,
      params
    );
    res.json(rows);
  } catch (e) { next(e); }
});

// Crear cita
router.post('/', async (req, res, next) => {
  try {
    const b = req.body;
    const [r] = await pool.query(
      `INSERT INTO citas (clinica_id, paciente_id, medico_id, servicio_id, fecha, hora_inicio, hora_fin, tipo, estado, motivo)
       VALUES (?,?,?,?,?,?,?,?,?,?)`,
      [b.clinica_id || 1, b.paciente_id, b.medico_id, b.servicio_id || null, b.fecha, b.hora_inicio,
       b.hora_fin || null, b.tipo || 'Consulta general', b.estado || 'Pendiente', b.motivo || null]
    );
    res.status(201).json({ id: r.insertId, mensaje: 'Cita creada' });
  } catch (e) { next(e); }
});

// Cambiar solo el estado de una cita (ej. Confirmada -> En consulta)
router.patch('/:id/estado', async (req, res, next) => {
  try {
    const { estado } = req.body;
    await pool.query('UPDATE citas SET estado = ? WHERE id = ?', [estado, req.params.id]);
    res.json({ mensaje: 'Estado actualizado', estado });
  } catch (e) { next(e); }
});

module.exports = router;
