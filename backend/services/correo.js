// Envío de correos. Si en .env están los datos SMTP, envía de verdad con nodemailer.
// Si no, muestra el contenido en la terminal (útil para pruebas y para la demo).
const nodemailer = require('nodemailer');

let transporte = null;
if (process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS) {
  transporte = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT) || 587,
    secure: Number(process.env.SMTP_PORT) === 465,
    auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
  });
}

const correoConfigurado = () => Boolean(transporte);

async function enviarCorreo({ para, asunto, texto, html }) {
  if (!transporte) {
    console.log('\n────────── CORREO (SMTP no configurado: se muestra aquí) ──────────');
    console.log(`Para:    ${para}\nAsunto:  ${asunto}\n\n${texto}`);
    console.log('───────────────────────────────────────────────────────────────────\n');
    return;
  }
  await transporte.sendMail({
    from: process.env.SMTP_FROM || `Clinnova <${process.env.SMTP_USER}>`,
    to: para, subject: asunto, text: texto, html,
  });
}

module.exports = { enviarCorreo, correoConfigurado };
