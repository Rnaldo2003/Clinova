// ============================================================
//  Migraciones automáticas: al arrancar, agrega a MySQL las columnas
//  nuevas si tu base es anterior a ellas. Así no hace falta volver a
//  correr clinnova.sql (y no pierdes tus datos).
// ============================================================
const pool = require('./db');

const COLUMNAS = [
  ['pacientes', 'portal_activo', 'TINYINT(1) NOT NULL DEFAULT 0'],
  ['pacientes', 'password_hash', 'VARCHAR(255) NULL'],
  ['pacientes', 'portal_ultimo_acceso', 'DATETIME NULL'],
];

async function migrar() {
  for (const [tabla, col, def] of COLUMNAS) {
    const [rows] = await pool.query(
      `SELECT 1 FROM information_schema.COLUMNS
        WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND COLUMN_NAME = ?`, [tabla, col]);
    if (!rows.length) {
      await pool.query(`ALTER TABLE \`${tabla}\` ADD COLUMN \`${col}\` ${def}`);
      console.log(`  Migración: columna ${tabla}.${col} agregada`);
    }
  }
}

module.exports = { migrar };
