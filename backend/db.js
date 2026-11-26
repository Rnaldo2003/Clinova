// Conexión (pool) a MySQL con mysql2
const mysql = require('mysql2/promise');
require('dotenv').config();

const pool = mysql.createPool({
  // 127.0.0.1 en vez de localhost: en Windows, localhost puede ir por IPv6 (::1) y MySQL no responder
  host: process.env.DB_HOST || '127.0.0.1',
  port: Number(process.env.DB_PORT) || 3306,
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'clinnova',
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
  dateStrings: true, // devuelve fechas como texto 'YYYY-MM-DD' en vez de objetos Date
});

// Traduce los errores de conexión más comunes a un mensaje claro
function explicarErrorMySQL(e) {
  const code = e.code || (e.errors && e.errors[0] && e.errors[0].code);
  const msgs = {
    ECONNREFUSED: 'MySQL no responde. Revisa que el servicio MySQL esté iniciado y que DB_HOST en .env sea 127.0.0.1',
    ER_ACCESS_DENIED_ERROR: 'MySQL rechazó el usuario o la contraseña. Revisa DB_USER y DB_PASSWORD en .env',
    ER_BAD_DB_ERROR: 'La base de datos "clinnova" no existe. Ejecuta clinnova.sql en MySQL Workbench',
    ER_NO_SUCH_TABLE: 'Faltan tablas. Vuelve a ejecutar clinnova.sql en MySQL Workbench',
    ENOTFOUND: 'No se encontró el servidor de MySQL. Revisa DB_HOST en .env',
  };
  return msgs[code] || e.message || code || String(e);
}

module.exports = pool;
module.exports.explicarErrorMySQL = explicarErrorMySQL;
