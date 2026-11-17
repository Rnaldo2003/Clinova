// Colección "notificaciones" (MongoDB): avisos para cada usuario del personal.
const { Schema, model } = require('mongoose');

const notificacionSchema = new Schema(
  {
    usuario_id: { type: Number, required: true, index: true }, // id del usuario en MySQL
    tipo: {
      type: String,
      enum: ['Cita', 'Resultado', 'Seguimiento', 'Tarea', 'Inventario', 'Documento', 'Mensaje'],
      required: true,
    },
    titulo: { type: String, required: true, maxlength: 160 },
    descripcion: { type: String, maxlength: 255 },
    // Datos extra que la app puede usar para abrir la pantalla correcta (ej. { cita_id: 5 })
    datos: { type: Schema.Types.Mixed, default: {} },
    leida: { type: Boolean, default: false },
  },
  { timestamps: { createdAt: 'creado_en', updatedAt: false } }
);

notificacionSchema.index({ usuario_id: 1, leida: 1, creado_en: -1 });

module.exports = model('Notificacion', notificacionSchema, 'notificaciones');
