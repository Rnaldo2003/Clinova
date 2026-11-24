// CATÁLOGOS para llenar listas desplegables  ->  /api/catalogos
const router = require('express').Router();
const pool = require('../db');

router.get('/', async (_req, res, next) => {
  try {
    const [roles] = await pool.query('SELECT id, nombre, descripcion FROM roles ORDER BY id');
    const [especialidades] = await pool.query('SELECT id, nombre FROM especialidades ORDER BY nombre');
    const [servicios] = await pool.query(
      'SELECT id, nombre, duracion_min, precio FROM servicios WHERE activo = 1 ORDER BY nombre');
    const [medicos] = await pool.query(
      `SELECT u.id, CONCAT(u.nombres,' ',u.apellidos) AS nombre, e.nombre AS especialidad
         FROM usuarios u JOIN roles r ON r.id = u.rol_id
         LEFT JOIN especialidades e ON e.id = u.especialidad_id
        WHERE r.nombre = 'medico' AND u.activo = 1 ORDER BY u.nombres`);
    res.json({
      roles, especialidades, servicios, medicos,
      estados_cita: ['Pendiente', 'Confirmada', 'En espera', 'En consulta', 'Atendida', 'Cancelada', 'No asistio'],
      tipos_cita: ['Consulta general', 'Control', 'Seguimiento', 'Primera consulta', 'Resultado de laboratorio', 'Otro'],
      tipos_inventario: ['Medicamento', 'Material', 'Insumo'],
    });
  } catch (e) { next(e); }
});

module.exports = router;
