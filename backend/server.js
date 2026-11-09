// ============================================================
//  CLINNOVA API — servidor principal (Node.js + Express)
// ============================================================
const express = require('express');
const cors = require('cors');
require('dotenv').config();

const pool = require('./db');

const app = express();
app.use(cors());              // permite que el frontend llame a la API
app.use(express.json());      // entiende cuerpos JSON

// Log sencillo de cada petición
app.use((req, _res, next) => {
  console.log(`${new Date().toISOString()}  ${req.method} ${req.url}`);
  next();
});

// --- Salud / prueba de conexión ---
app.get('/api/health', async (_req, res) => {
  try {
    const [rows] = await pool.query('SELECT 1 AS ok');
    res.json({ api: 'ok', db: rows[0].ok === 1 ? 'conectada' : 'sin respuesta' });
  } catch (err) {
    res.status(500).json({ api: 'ok', db: 'error', detalle: err.message });
  }
});

// --- Rutas de la API ---
app.use('/api/auth',       require('./routes/auth'));
app.use('/api/pacientes',  require('./routes/pacientes'));
app.use('/api/citas',      require('./routes/citas'));
app.use('/api/dashboard',  require('./routes/dashboard'));
app.use('/api/inventario', require('./routes/inventario'));

// --- 404 para rutas no encontradas ---
app.use((req, res) => res.status(404).json({ error: 'Ruta no encontrada: ' + req.url }));

// --- Manejo de errores ---
app.use((err, _req, res, _next) => {
  console.error(err);
  res.status(500).json({ error: 'Error interno', detalle: err.message });
});

const PORT = process.env.PORT || 4000;
app.listen(PORT, () => {
  console.log('==============================================');
  console.log(`  Clinnova API corriendo en http://localhost:${PORT}`);
  console.log(`  Prueba:  http://localhost:${PORT}/api/health`);
  console.log('==============================================');
});
