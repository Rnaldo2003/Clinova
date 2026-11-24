// ============================================================
//  CLINNOVA API — servidor principal (Node.js + Express)
// ============================================================
const express = require('express');
const cors = require('cors');
require('dotenv').config();

// La clave de los tokens es obligatoria: sin ella cualquiera podría fabricar un token válido
if (!process.env.JWT_SECRET || process.env.JWT_SECRET.length < 16) {
  console.error('✘ Falta JWT_SECRET en .env (pon un texto largo, de al menos 16 caracteres).');
  process.exit(1);
}

const pool = require('./db');
const { conectarMongo, mongoListo, requireMongo } = require('./mongo');
const { requireAuth, requireRol } = require('./middleware/auth');
const bitacora = require('./middleware/bitacora');

const app = express();
app.use(cors());              // permite que el frontend llame a la API
app.use(express.json());      // entiende cuerpos JSON

// Bitácora de auditoría en MongoDB (POST, PUT, PATCH, DELETE)
app.use(bitacora);

// Log sencillo de cada petición
app.use((req, _res, next) => {
  console.log(`${new Date().toISOString()}  ${req.method} ${req.url}`);
  next();
});

// --- Salud / prueba de conexión ---
app.get('/api/health', async (_req, res) => {
  try {
    const [rows] = await pool.query('SELECT 1 AS ok');
    res.json({
      api: 'ok',
      db: rows[0].ok === 1 ? 'conectada' : 'sin respuesta',
      mongo: mongoListo() ? 'conectada' : 'desconectada',
    });
  } catch (err) {
    res.status(500).json({ api: 'ok', db: 'error', mongo: mongoListo() ? 'conectada' : 'desconectada', detalle: err.message });
  }
});

// --- Panel web: se sirve desde la misma API (http://localhost:4000) ---
// Solo se publican los archivos del panel; nunca el backend, el .env ni el .sql.
const path = require('path');
const RAIZ = path.join(__dirname, '..');
app.get('/', (_req, res) => res.redirect('/login.html'));
app.get(['/login.html', '/Clinnova.html'], (req, res) => res.sendFile(path.join(RAIZ, req.path)));
app.use('/img', express.static(path.join(RAIZ, 'img')));
app.use('/panel', express.static(path.join(RAIZ, 'panel')));
app.use('/app-movil', express.static(path.join(RAIZ, 'app-movil')));

// --- Rutas de la API ---
// /api/auth es pública (login). Todas las demás exigen haber iniciado sesión.
app.use('/api/auth',       require('./routes/auth'));
app.use('/api/pacientes',  requireAuth, require('./routes/pacientes'));
app.use('/api/citas',      requireAuth, require('./routes/citas'));
app.use('/api/dashboard',  requireAuth, require('./routes/dashboard'));
app.use('/api/inventario', requireAuth, require('./routes/inventario'));
app.use('/api/consultas',  requireAuth, require('./routes/consultas'));
app.use('/api/recetas',    requireAuth, require('./routes/recetas'));
app.use('/api/catalogos',  requireAuth, require('./routes/catalogos'));
app.use('/api/usuarios',   requireAuth, requireRol('admin', 'superadmin'), require('./routes/usuarios'));
// Rutas que usan MongoDB
app.use('/api/mensajes',       requireAuth, requireMongo, require('./routes/mensajes'));
app.use('/api/notificaciones', requireAuth, requireMongo, require('./routes/notificaciones'));
app.use('/api/bitacora',       requireAuth, requireRol('admin', 'superadmin'), requireMongo, require('./routes/bitacora'));

// --- 404 para rutas no encontradas ---
app.use((req, res) => res.status(404).json({ error: 'Ruta no encontrada: ' + req.url }));

// --- Manejo de errores ---
app.use((err, _req, res, _next) => {
  console.error(err);
  res.status(500).json({ error: 'Error interno', detalle: err.message });
});

const PORT = process.env.PORT || 4000;
conectarMongo(); // no bloquea: si MongoDB no está, la API arranca igual con MySQL
app.listen(PORT, () => {
  console.log('==============================================');
  console.log(`  Clinnova API corriendo en http://localhost:${PORT}`);
  console.log(`  Prueba:  http://localhost:${PORT}/api/health`);
  console.log('==============================================');
});
