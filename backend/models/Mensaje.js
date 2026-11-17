// Colección "mensajes" (MongoDB): chat entre la clínica y cada paciente.
const { Schema, model } = require('mongoose');

const mensajeSchema = new Schema(
  {
    paciente_id: { type: Number, required: true, index: true }, // id del paciente en MySQL
    autor: {
      tipo:   { type: String, enum: ['usuario', 'paciente'], required: true },
      id:     { type: Number, required: true },  // id en MySQL (usuarios o pacientes)
      nombre: { type: String, required: true },
    },
    texto: { type: String, required: true, trim: true, maxlength: 2000 },
    // Adjunto opcional (por ahora solo los datos; el archivo se guardaría aparte)
    adjunto: {
      nombre: String,
      url: String,
      tamano_kb: Number,
    },
    area: { type: String, enum: ['Administrativa', 'Clinica', 'Laboratorio', 'Recepcion'], default: 'Clinica' },
    leido: { type: Boolean, default: false },
  },
  { timestamps: { createdAt: 'creado_en', updatedAt: 'actualizado_en' } }
);

mensajeSchema.index({ paciente_id: 1, creado_en: -1 });

module.exports = model('Mensaje', mensajeSchema, 'mensajes');
