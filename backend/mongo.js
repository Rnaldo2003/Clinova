// Conexión a MongoDB con Mongoose.
// MongoDB guarda la información flexible o de mucho volumen: mensajes, notificaciones y bitácora.
// MySQL sigue guardando lo estructurado (usuarios, pacientes, citas, inventario...).
const mongoose = require('mongoose');
require('dotenv').config();

const MONGO_URI = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/clinnova';

// Sin conexión, las consultas fallan de inmediato en vez de quedarse esperando.
mongoose.set('bufferCommands', false);
// Rechaza filtros con campos que no existen en el esquema (ayuda contra inyección NoSQL).
mongoose.set('strictQuery', true);

async function conectarMongo() {
  try {
    await mongoose.connect(MONGO_URI, { serverSelectionTimeoutMS: 5000 });
    console.log('  MongoDB conectado');
  } catch (err) {
    // La API sigue funcionando con MySQL; las rutas de Mongo responden 503 hasta que vuelva.
    console.error('  ✘ No se pudo conectar a MongoDB:', err.message);
    console.error('    Revisa que MongoDB esté corriendo y MONGO_URI en .env');
  }
}

const mongoListo = () => mongoose.connection.readyState === 1;

// Middleware: corta con 503 si MongoDB no está disponible
function requireMongo(_req, res, next) {
  if (!mongoListo()) return res.status(503).json({ error: 'MongoDB no está disponible. Intenta más tarde.' });
  next();
}

module.exports = { conectarMongo, mongoListo, requireMongo };
