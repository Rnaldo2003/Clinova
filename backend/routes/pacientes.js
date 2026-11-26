// Rutas de PACIENTES  ->  /api/pacientes
const router = require('express').Router();
const bcrypt = require('bcryptjs');
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

// Un paciente por id (incluye edad)
router.get('/:id', async (req, res, next) => {
  try {
    const [rows] = await pool.query(
      'SELECT *, TIMESTAMPDIFF(YEAR, fecha_nacimiento, CURDATE()) AS edad FROM pacientes WHERE id = ?', [req.params.id]);
    if (!rows.length) return res.status(404).json({ error: 'Paciente no encontrado' });
    const { password_hash, ...paciente } = rows[0]; // la contraseña del portal nunca sale de la API
    paciente.portal_tiene_password = Boolean(password_hash);
    res.json(paciente);
  } catch (e) { next(e); }
});

// Activar o actualizar el acceso al PORTAL DE PACIENTES. Body: { email, password }
router.post('/:id/portal', async (req, res, next) => {
  try {
    if (!['admin', 'superadmin', 'recepcion', 'medico'].includes(req.usuario.rol)) {
      return res.status(403).json({ error: 'No tienes permiso para dar acceso al portal' });
    }
    const email = String(req.body.email || '').trim().toLowerCase();
    const { password } = req.body;
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return res.status(400).json({ error: 'Escribe un correo válido' });
    if (!password || String(password).length < 6) return res.status(400).json({ error: 'La contraseña debe tener al menos 6 caracteres' });
    const [[otro]] = await pool.query(
      'SELECT id FROM pacientes WHERE LOWER(email) = ? AND portal_activo = 1 AND id <> ?', [email, req.params.id]);
    if (otro) return res.status(409).json({ error: 'Otro paciente ya usa ese correo en el portal' });
    const hash = await bcrypt.hash(String(password), 10);
    const [r] = await pool.query(
      'UPDATE pacientes SET email = ?, password_hash = ?, portal_activo = 1 WHERE id = ? AND activo = 1', [email, hash, req.params.id]);
    if (!r.affectedRows) return res.status(404).json({ error: 'Paciente no encontrado' });
    res.json({ mensaje: 'Acceso al portal activado' });
  } catch (e) { next(e); }
});

// Quitar el acceso al portal
router.delete('/:id/portal', async (req, res, next) => {
  try {
    if (!['admin', 'superadmin', 'recepcion', 'medico'].includes(req.usuario.rol)) {
      return res.status(403).json({ error: 'No tienes permiso para quitar el acceso al portal' });
    }
    const [r] = await pool.query('UPDATE pacientes SET portal_activo = 0 WHERE id = ?', [req.params.id]);
    if (!r.affectedRows) return res.status(404).json({ error: 'Paciente no encontrado' });
    res.json({ mensaje: 'Acceso al portal desactivado' });
  } catch (e) { next(e); }
});

// Expediente completo: consultas, recetas (con medicamentos), citas y signos vitales
router.get('/:id/historial', async (req, res, next) => {
  try {
    const id = req.params.id;
    const [[p]] = await pool.query('SELECT id FROM pacientes WHERE id = ?', [id]);
    if (!p) return res.status(404).json({ error: 'Paciente no encontrado' });
    const [consultas] = await pool.query(
      `SELECT c.id, c.fecha, c.motivo, c.diagnostico, c.cie10, c.tratamiento, c.indicaciones,
              CONCAT(u.nombres,' ',u.apellidos) AS medico
         FROM consultas c JOIN usuarios u ON u.id = c.medico_id
        WHERE c.paciente_id = ? ORDER BY c.fecha DESC`, [id]);
    const [recetas] = await pool.query(
      `SELECT r.id, r.fecha, r.notas, r.consulta_id, CONCAT(u.nombres,' ',u.apellidos) AS medico
         FROM recetas r JOIN usuarios u ON u.id = r.medico_id
        WHERE r.paciente_id = ? ORDER BY r.fecha DESC`, [id]);
    for (const r of recetas) {
      [r.items] = await pool.query(
        'SELECT medicamento, dosis, frecuencia, duracion, indicaciones FROM receta_items WHERE receta_id = ?', [r.id]);
    }
    const [citas] = await pool.query(
      `SELECT c.id, c.fecha, c.hora_inicio, c.tipo, c.estado, c.motivo, CONCAT(u.nombres,' ',u.apellidos) AS medico
         FROM citas c JOIN usuarios u ON u.id = c.medico_id
        WHERE c.paciente_id = ? ORDER BY c.fecha DESC, c.hora_inicio DESC LIMIT 50`, [id]);
    const [signos] = await pool.query(
      'SELECT * FROM signos_vitales WHERE paciente_id = ? ORDER BY creado_en DESC LIMIT 20', [id]);
    res.json({ consultas, recetas, citas, signos });
  } catch (e) { next(e); }
});

// Registrar signos vitales (enfermería, médico o admin)
// Body: { cita_id?, peso_kg, talla_cm, temperatura_c, presion_sistolica, presion_diastolica,
//         frecuencia_cardiaca, frecuencia_resp, saturacion_o2, motivo_consulta, observaciones }
router.post('/:id/signos', async (req, res, next) => {
  try {
    if (!['enfermeria', 'medico', 'admin', 'superadmin'].includes(req.usuario.rol)) {
      return res.status(403).json({ error: 'No tienes permiso para registrar signos vitales' });
    }
    const b = req.body;
    const num = (v) => (v === '' || v === null || v === undefined ? null : Number(v));
    const vals = {
      peso_kg: num(b.peso_kg), talla_cm: num(b.talla_cm), temperatura_c: num(b.temperatura_c),
      presion_sistolica: num(b.presion_sistolica), presion_diastolica: num(b.presion_diastolica),
      frecuencia_cardiaca: num(b.frecuencia_cardiaca), frecuencia_resp: num(b.frecuencia_resp),
      saturacion_o2: num(b.saturacion_o2),
    };
    if (Object.values(vals).some((v) => v !== null && (Number.isNaN(v) || v < 0))) {
      return res.status(400).json({ error: 'Los signos vitales deben ser números positivos' });
    }
    if (Object.values(vals).every((v) => v === null)) {
      return res.status(400).json({ error: 'Registra al menos un signo vital' });
    }
    const [r] = await pool.query(
      `INSERT INTO signos_vitales (cita_id, paciente_id, tomado_por, peso_kg, talla_cm, temperatura_c,
         presion_sistolica, presion_diastolica, frecuencia_cardiaca, frecuencia_resp, saturacion_o2,
         motivo_consulta, observaciones)
       VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)`,
      [b.cita_id || null, req.params.id, req.usuario.id, vals.peso_kg, vals.talla_cm, vals.temperatura_c,
       vals.presion_sistolica, vals.presion_diastolica, vals.frecuencia_cardiaca, vals.frecuencia_resp,
       vals.saturacion_o2, b.motivo_consulta || null, b.observaciones || null]);
    res.status(201).json({ id: r.insertId, mensaje: 'Signos vitales registrados' });
  } catch (e) {
    if (e.code === 'ER_NO_REFERENCED_ROW_2') return res.status(404).json({ error: 'Paciente o cita no encontrado' });
    next(e);
  }
});

// Crear paciente
router.post('/', async (req, res, next) => {
  try {
    const b = req.body;
    if (!b.nombres || !b.apellidos) return res.status(400).json({ error: 'nombres y apellidos son obligatorios' });
    if (b.sexo && !['M', 'F', 'O'].includes(b.sexo)) return res.status(400).json({ error: 'sexo debe ser M, F u O' });
    // Número de expediente automático: EXP-0001, EXP-0002...
    if (!b.expediente_no) {
      const [[m]] = await pool.query(
        "SELECT COALESCE(MAX(CAST(SUBSTRING(expediente_no, 5) AS UNSIGNED)), 0) + 1 AS n FROM pacientes WHERE expediente_no LIKE 'EXP-%'");
      b.expediente_no = 'EXP-' + String(m.n).padStart(4, '0');
    }
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
    res.status(201).json({ id: r.insertId, expediente_no: b.expediente_no, mensaje: 'Paciente creado' });
  } catch (e) {
    if (e.code === 'ER_DUP_ENTRY') return res.status(409).json({ error: 'Ese número de expediente ya existe' });
    next(e);
  }
});

// Actualizar paciente
router.put('/:id', async (req, res, next) => {
  try {
    const b = req.body;
    if (!b.nombres || !b.apellidos) return res.status(400).json({ error: 'nombres y apellidos son obligatorios' });
    if (b.sexo && !['M', 'F', 'O'].includes(b.sexo)) return res.status(400).json({ error: 'sexo debe ser M, F u O' });
    const [r] = await pool.query(
      `UPDATE pacientes SET
         identidad=?, nombres=?, apellidos=?, fecha_nacimiento=?, sexo=?, telefono=?, email=?,
         direccion=?, tipo_sangre=?, alergias=?, antecedentes=?,
         contacto_emerg_nombre=?, contacto_emerg_telefono=?
       WHERE id=?`,
      [b.identidad || null, b.nombres, b.apellidos, b.fecha_nacimiento || null, b.sexo || null, b.telefono || null,
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
