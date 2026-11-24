// Rutas del DASHBOARD  ->  /api/dashboard
const router = require('express').Router();
const pool = require('../db');
const Mensaje = require('../models/Mensaje');
const { mongoListo } = require('../mongo');

// Tarjetas de resumen del día (pacientes hoy, pendientes, mensajes, resultados, seguimientos)
router.get('/resumen', async (_req, res, next) => {
  try {
    const [[pac]]  = await pool.query(
      "SELECT COUNT(*) AS n FROM citas WHERE fecha = CURDATE()");
    const [[pend]] = await pool.query(
      "SELECT COUNT(*) AS n FROM citas WHERE fecha = CURDATE() AND estado IN ('Pendiente','Confirmada','En espera')");
    // Mensajes de pacientes sin leer (MongoDB)
    const msg = { n: mongoListo()
      ? await Mensaje.countDocuments({ 'autor.tipo': 'paciente', leido: false })
      : 0 };
    const [[lab]]  = await pool.query(
      "SELECT COUNT(*) AS n FROM ordenes_laboratorio WHERE estado = 'Lista'");
    const [[seg]]  = await pool.query(
      "SELECT COUNT(*) AS n FROM seguimientos WHERE estado = 'Pendiente' AND fecha_programada <= CURDATE()");

    const [[esp]]  = await pool.query(
      "SELECT COUNT(*) AS n FROM citas WHERE fecha = CURDATE() AND estado = 'En espera'");
    const [[ate]]  = await pool.query(
      "SELECT COUNT(*) AS n FROM citas WHERE fecha = CURDATE() AND estado = 'Atendida'");
    const [[stk]]  = await pool.query(
      'SELECT COUNT(*) AS n FROM inventario WHERE existencia <= stock_minimo');

    res.json({
      en_espera:            esp.n,
      atendidas:            ate.n,
      stock_bajo:           stk.n,
      pacientes_hoy:        pac.n,
      pendientes:           pend.n,
      mensajes:             msg.n,
      resultados_nuevos:    lab.n,
      seguimientos_urgentes: seg.n,
    });
  } catch (e) { next(e); }
});

// Agenda del día (para la tarjeta "Agenda de hoy")
router.get('/agenda-hoy', async (_req, res, next) => {
  try {
    const [rows] = await pool.query(
      `SELECT c.id, c.paciente_id, c.hora_inicio, c.tipo, c.estado, c.motivo,
              CONCAT(p.nombres,' ',p.apellidos) AS paciente, p.expediente_no,
              TIMESTAMPDIFF(YEAR, p.fecha_nacimiento, CURDATE()) AS edad
         FROM citas c
         JOIN pacientes p ON p.id = c.paciente_id
        WHERE c.fecha = CURDATE()
        ORDER BY c.hora_inicio`
    );
    res.json(rows);
  } catch (e) { next(e); }
});

// Tipos de consulta de hoy (para la dona)
router.get('/tipos-consulta', async (_req, res, next) => {
  try {
    const [rows] = await pool.query(
      `SELECT tipo, COUNT(*) AS total
         FROM citas WHERE fecha = CURDATE()
        GROUP BY tipo ORDER BY total DESC`
    );
    res.json(rows);
  } catch (e) { next(e); }
});

// Citas por día de los últimos 7 días (para la gráfica de la semana)
router.get('/semana', async (_req, res, next) => {
  try {
    const [rows] = await pool.query(
      `SELECT DATE_FORMAT(fecha, '%Y-%m-%d') AS fecha, COUNT(*) AS total,
              CAST(SUM(estado = 'Atendida') AS UNSIGNED) AS atendidas,
              CAST(SUM(estado IN ('Cancelada','No asistio')) AS UNSIGNED) AS canceladas
         FROM citas WHERE fecha BETWEEN CURDATE() - INTERVAL 6 DAY AND CURDATE()
        GROUP BY fecha ORDER BY fecha`);
    res.json(rows);
  } catch (e) { next(e); }
});

module.exports = router;
