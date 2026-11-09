// Rutas del DASHBOARD  ->  /api/dashboard
const router = require('express').Router();
const pool = require('../db');

// Tarjetas de resumen del día (pacientes hoy, pendientes, mensajes, resultados, seguimientos)
router.get('/resumen', async (_req, res, next) => {
  try {
    const [[pac]]  = await pool.query(
      "SELECT COUNT(*) AS n FROM citas WHERE fecha = CURDATE()");
    const [[pend]] = await pool.query(
      "SELECT COUNT(*) AS n FROM citas WHERE fecha = CURDATE() AND estado IN ('Pendiente','Confirmada','En espera')");
    const [[msg]]  = await pool.query(
      "SELECT COUNT(*) AS n FROM mensajes WHERE leido = 0");
    const [[lab]]  = await pool.query(
      "SELECT COUNT(*) AS n FROM ordenes_laboratorio WHERE estado = 'Lista'");
    const [[seg]]  = await pool.query(
      "SELECT COUNT(*) AS n FROM seguimientos WHERE estado = 'Pendiente' AND fecha_programada <= CURDATE()");

    res.json({
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
      `SELECT c.hora_inicio, c.tipo, c.estado,
              CONCAT(p.nombres,' ',p.apellidos) AS paciente,
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

module.exports = router;
