// ============================================================
//  Crea (o actualiza la contraseña de) un usuario desde la terminal.
//  Sirve para crear el PRIMER administrador, ya que /api/auth/register
//  solo lo puede usar un admin con sesión iniciada.
//
//  Uso:
//    npm run crear-usuario -- <email> <password> [rol] [nombres] [apellidos]
//  Ejemplos:
//    npm run crear-usuario -- admin@clinnova.hn 123456 admin
//    npm run crear-usuario -- dr@clinnova.hn 123456 medico Carlos López
//  Roles: superadmin, admin, medico, enfermeria, recepcion, laboratorio
// ============================================================
require('dotenv').config();
const bcrypt = require('bcryptjs');
const pool = require('../db');

(async () => {
  const [email, password, rol = 'admin', nombres = 'Usuario', apellidos = 'Clinnova'] = process.argv.slice(2);
  if (!email || !password) {
    console.log('Uso: npm run crear-usuario -- <email> <password> [rol] [nombres] [apellidos]');
    process.exit(1);
  }
  try {
    const [roles] = await pool.query('SELECT id FROM roles WHERE nombre = ?', [rol]);
    if (!roles.length) throw new Error(`El rol "${rol}" no existe`);
    const hash = await bcrypt.hash(password, 10);

    const [existe] = await pool.query('SELECT id FROM usuarios WHERE email = ?', [email]);
    if (existe.length) {
      await pool.query('UPDATE usuarios SET password_hash = ?, rol_id = ?, activo = 1 WHERE id = ?',
        [hash, roles[0].id, existe[0].id]);
      console.log(`✔ Usuario ${email} actualizado (rol: ${rol}). Ya puedes iniciar sesión.`);
    } else {
      await pool.query(
        `INSERT INTO usuarios (clinica_id, sede_id, rol_id, nombres, apellidos, email, password_hash)
         VALUES (1, 1, ?, ?, ?, ?, ?)`,
        [roles[0].id, nombres, apellidos, email, hash]
      );
      console.log(`✔ Usuario ${email} creado (rol: ${rol}). Ya puedes iniciar sesión.`);
    }
  } catch (e) {
    console.error('✘ Error:', e.message);
    process.exitCode = 1;
  } finally {
    await pool.end();
  }
})();
