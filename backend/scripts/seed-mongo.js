// ============================================================
//  Carga datos de ejemplo en MongoDB: conversaciones con pacientes
//  y notificaciones para cada usuario. Se puede correr varias veces:
//  borra los datos de ejemplo anteriores y los vuelve a crear.
//
//  Uso:  npm run seed-mongo
// ============================================================
require('dotenv').config();
const mongoose = require('mongoose');
const pool = require('../db');
const { conectarMongo, mongoListo } = require('../mongo');
const Mensaje = require('../models/Mensaje');
const Notificacion = require('../models/Notificacion');

const haceMin = (m) => new Date(Date.now() - m * 60 * 1000);

(async () => {
  await conectarMongo();
  if (!mongoListo()) { process.exitCode = 1; await pool.end(); return; }
  try {
    const [pacs] = await pool.query('SELECT id, nombres, apellidos FROM pacientes WHERE activo = 1 ORDER BY id LIMIT 4');
    const [[med]] = await pool.query(
      `SELECT u.id, u.nombres, u.apellidos FROM usuarios u JOIN roles r ON r.id = u.rol_id
        WHERE r.nombre = 'medico' AND u.activo = 1 ORDER BY u.id LIMIT 1`);
    const [usuarios] = await pool.query('SELECT id FROM usuarios WHERE activo = 1');
    if (pacs.length < 3 || !med) throw new Error('Primero carga clinnova.sql (faltan pacientes o médicos).');

    const dr = { tipo: 'usuario', id: med.id, nombre: `${med.nombres} ${med.apellidos}` };
    const pac = (p) => ({ tipo: 'paciente', id: p.id, nombre: `${p.nombres} ${p.apellidos}` });
    const [a, b, c, d] = pacs;

    const mensajes = [
      { paciente_id: a.id, autor: pac(a), texto: 'Buenos días doctor, ¿puedo tomar el medicamento con el estómago vacío?', creado_en: haceMin(300), leido: true },
      { paciente_id: a.id, autor: dr, texto: 'Buenos días. Mejor tómelo después del desayuno.', creado_en: haceMin(290), leido: true },
      { paciente_id: b.id, autor: pac(b), texto: 'Doctor, la presión me salió 145/90 esta mañana.', creado_en: haceMin(95), area: 'Clinica' },
      { paciente_id: c.id, autor: pac(c), texto: 'Ya me hice los exámenes que me pidió.', creado_en: haceMin(41), area: 'Laboratorio',
        adjunto: { nombre: 'hemograma.pdf', url: null, tamano_kb: 245 } },
      { paciente_id: c.id, autor: dr, texto: 'Gracias, ya los recibí. Están dentro de lo normal. Nos vemos el martes.', creado_en: haceMin(20), leido: true },
    ];
    if (d) mensajes.push({ paciente_id: d.id, autor: pac(d), texto: '¿Tienen espacio para mañana en la tarde?', creado_en: haceMin(8), area: 'Recepcion' });

    const notifs = usuarios.flatMap((u) => [
      { usuario_id: u.id, tipo: 'Mensaje', titulo: `Nuevo mensaje de ${b.nombres} ${b.apellidos}`, descripcion: 'La presión me salió 145/90 esta mañana.', datos: { paciente_id: b.id }, creado_en: haceMin(95) },
      { usuario_id: u.id, tipo: 'Resultado', titulo: 'Resultados de laboratorio listos', descripcion: `${c.nombres} ${c.apellidos} · Hemograma`, datos: { paciente_id: c.id }, creado_en: haceMin(41) },
      { usuario_id: u.id, tipo: 'Inventario', titulo: 'Stock bajo: Amoxicilina 500 mg', descripcion: 'Quedan 8 (mínimo 25)', creado_en: haceMin(180), leida: true },
    ]);

    await Mensaje.deleteMany({});
    await Notificacion.deleteMany({});
    // timestamps:false para respetar las fechas de ejemplo
    await Mensaje.insertMany(mensajes, { timestamps: false });
    await Notificacion.insertMany(notifs, { timestamps: false });
    console.log(`✔ ${mensajes.length} mensajes y ${notifs.length} notificaciones de ejemplo cargados en MongoDB.`);
  } catch (e) {
    console.error('✘ Error:', e.message);
    process.exitCode = 1;
  } finally {
    await mongoose.disconnect();
    await pool.end();
  }
})();
