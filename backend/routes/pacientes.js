// Rutas de PACIENTES  ->  /api/pacientes
const router = require('express').Router();
const pool = require('../db');

// Listar pacientes (con búsqueda opcional ?q=texto)
router.get('/', async (req, res, next) => {
  try {
    const q = `%${req.query.q || ''}%`;
    const [rows] = await pool.query(
      `SELECT id, expediente_no, nombres, apellidos, fecha_nacimiento, sexo, telefono, email,
              TIMESTAMPDIFF(YEAR, fecha_nacimiento, CURDATE()) AS edad
         FROM pacientes
        WHERE activo = 1
          AND (nombres LIKE ? OR apellidos LIKE ? OR expediente_no LIKE ? OR telefono LIKE ?)
        ORDER BY apellidos, nombres`,
      [q, q, q, q]
    );
    res.json(rows);
  } catch (e) { next(e); }
});

// Un paciente por id
router.get('/:id', async (req, res, next) => {
  try {
    const [rows] = await pool.query('SELECT * FROM pacientes WHERE id = ?', [req.params.id]);
    if (!rows.length) return res.status(404).json({ error: 'Paciente no encontrado' });
    res.json(rows[0]);
  } catch (e) { next(e); }
});

// Crear paciente
router.post('/', async (req, res, next) => {
  try {
    const b = req.body;
    if (!b.nombres || !b.apellidos) return res.status(400).json({ error: 'nombres y apellidos son obligatorios' });
    const [r] = await pool.query(
      `INSERT INTO pacientes
         (clinica_id, expediente_no, identidad, nombres, apellidos, fecha_nacimiento, sexo,
          telefono, email, direccion, tipo_sangre, alergias, antecedentes,
          contacto_emerg_nombre, contacto_emerg_telefono)
       VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
      [b.clinica_id || 1, b.expediente_no || null, b.identidad || null, b.nombres, b.apellidos,
       b.fecha_nacimiento || null, b.sexo || null, b.telefono || null, b.email || null,
       b.direccion || null, b.tipo_sangre || null, b.alergias || null, b.antecedentes || null,
       b.contacto_emerg_nombre || null, b.contacto_emerg_telefono || null]
    );
    res.status(201).json({ id: r.insertId, mensaje: 'Paciente creado' });
  } catch (e) { next(e); }
});

// Actualizar paciente
router.put('/:id', async (req, res, next) => {
  try {
    const b = req.body;
    if (!b.nombres || !b.apellidos) return res.status(400).json({ error: 'nombres y apellidos son obligatorios' });
    const [r] = await pool.query(
      `UPDATE pacientes SET
         nombres=?, apellidos=?, fecha_nacimiento=?, sexo=?, telefono=?, email=?,
         direccion=?, tipo_sangre=?, alergias=?, antecedentes=?,
         contacto_emerg_nombre=?, contacto_emerg_telefono=?
       WHERE id=?`,
      [b.nombres, b.apellidos, b.fecha_nacimiento || null, b.sexo || null, b.telefono || null,
       b.email || null, b.direccion || null, b.tipo_sangre || null, b.alergias || null,
       b.antecedentes || null, b.contacto_emerg_nombre || null, b.contacto_emerg_telefono || null,
       req.params.id]
    );
    if (!r.affectedRows) return res.status(404).json({ error: 'Paciente no encontrado' });
    res.json({ mensaje: 'Paciente actualizado' });
  } catch (e) { next(e); }
});

// "Eliminar" (desactivar) paciente
router.delete('/:id', async (req, res, next) => {
  try {
    const [r] = await pool.query('UPDATE pacientes SET activo = 0 WHERE id = ?', [req.params.id]);
    if (!r.affectedRows) return res.status(404).json({ error: 'Paciente no encontrado' });
    res.json({ mensaje: 'Paciente desactivado' });
  } catch (e) { next(e); }
});

module.exports = router;
