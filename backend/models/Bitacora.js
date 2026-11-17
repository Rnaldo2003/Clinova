// Colección "bitacora" (MongoDB): registro de auditoría. Quién hizo qué y cuándo.
// Nunca guarda el cuerpo de la petición (podría tener contraseñas o datos médicos).
const { Schema, model } = require('mongoose');

const bitacoraSchema = new Schema({
  fecha:      { type: Date, default: Date.now, index: true },
  usuario_id: { type: Number, default: null, index: true },
  rol:        { type: String, default: null },
  metodo:     { type: String, required: true },
  ruta:       { type: String, required: true },
  status:     { type: Number, required: true },
  ip:         String,
  duracion_ms: Number,
});

module.exports = model('Bitacora', bitacoraSchema, 'bitacora');
