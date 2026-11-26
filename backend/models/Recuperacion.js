// Colección "recuperaciones" (MongoDB): enlaces para restablecer contraseña.
// Se guarda solo el hash del token (nunca el token) y MongoDB borra el
// documento automáticamente cuando vence, gracias al índice TTL.
const { Schema, model } = require('mongoose');

const recuperacionSchema = new Schema({
  tipo:       { type: String, enum: ['usuario', 'paciente'], required: true },
  ref_id:     { type: Number, required: true },           // id en MySQL (usuarios o pacientes)
  token_hash: { type: String, required: true, unique: true },
  expira:     { type: Date, required: true },
  usado:      { type: Boolean, default: false },
  creado_en:  { type: Date, default: Date.now },
});

// TTL: MongoDB elimina el documento en cuanto pasa la fecha "expira"
recuperacionSchema.index({ expira: 1 }, { expireAfterSeconds: 0 });

module.exports = model('Recuperacion', recuperacionSchema, 'recuperaciones');
