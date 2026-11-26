# Clinova

Sistema de gestión médica para clínicas y consultorios — proyecto de la clase de Aplicaciones de Vanguardia.

## Contenido

| Archivo / carpeta | Qué es |
|---|---|
| `login.html` | Pantalla de inicio de sesión (llama a la API) |
| `portal.html` + `portal/` | **Portal de pacientes** (pensado para celular): citas, recetas, mensajes con la clínica y perfil |
| `Clinnova.html` + `panel/` | Panel web completo (ver abajo). `panel/app.js` es el núcleo y `panel/views/` tiene una sección por archivo |
| `clinnova.sql` | Script de la base de datos MySQL `clinnova` (tablas + datos de ejemplo) |
| `backend/` | API REST en Node.js + Express + MySQL + MongoDB — ver [backend/README.md](backend/README.md) |
| `Sistema_para_Doctores.docx` | Documento de presentación del producto |
| `app-movil/` | Frontend de la app móvil (prototipo navegable HTML/CSS/JS) — abrir `app-movil/index.html` |
| `mockups/` | Mockups de las pantallas de la app móvil |
| `ENTREGA_AVANCE_2.md` | Documentación del Avance 2 (frontend y mockups) |

## Panel web

| Sección | Qué se puede hacer |
|---|---|
| **Inicio** | Citas de hoy, sala de espera, atendidas, mensajes sin leer, stock bajo, siguiente paciente y gráficas |
| **Pacientes** | Buscar, registrar (con expediente automático), editar y desactivar |
| **Agenda** | Citas por día y médico, cambiar estado, agendar, reprogramar, cancelar, signos vitales y "Atender" |
| **Expediente** | Ficha completa con alergias, consultas, recetas, citas y signos vitales |
| **Consultas** | Atender (motivo, exploración, diagnóstico CIE-10, tratamiento y receta en una sola pantalla), ver y editar |
| **Recetas** | Lista, nueva receta, imprimir / guardar PDF y anular |
| **Mensajes** | Chat con cada paciente y registro de mensajes recibidos (MongoDB) |
| **Inventario** | Existencias, entradas/salidas/ajustes, historial, alertas de stock bajo y vencimiento |
| **Configuración** | Mi perfil y contraseña; usuarios del personal y bitácora (solo admin) |

Arriba: búsqueda de pacientes (**Ctrl + K**) y campana de notificaciones.
Cada rol ve lo suyo: consultas y recetas solo médicos y admin; signos vitales también enfermería; usuarios y bitácora solo admin.

## Portal de pacientes

Abre **http://localhost:4000/portal.html** (o el botón "¿Eres paciente?" del login).
Paciente de prueba: `maria.lopez@correo.hn` / `123456`.

- **Inicio:** próxima cita, mensajes nuevos, recetas y alergias registradas.
- **Citas:** ver próximas y anteriores, **solicitar** (elige médico, día y una hora libre) y cancelar. La clínica recibe el aviso y la cita queda "Por confirmar".
- **Mensajes:** chat con la clínica. Lo que escribe el paciente le llega al personal en Mensajes (con notificación), y las respuestas del personal le llegan aquí. El personal ve "Visto" cuando el paciente las leyó.
- **Recetas:** sus recetas con opción de imprimir.
- **Perfil:** sus datos, editar contacto, cambiar contraseña y resumen de consultas.

Para darle acceso a un paciente: **Expediente → "Dar acceso al portal"** (correo y contraseña inicial).
El token del paciente solo sirve para `/api/portal`: no puede ver nada del personal ni de otros pacientes.

## Recuperar contraseña

En el login (personal) y en el portal (pacientes): **"¿Olvidaste tu contraseña?"** → se envía un enlace que vence en 30 minutos.
- Si en `backend/.env` configuras `SMTP_*` (por ejemplo un Gmail con contraseña de aplicación), llega por correo.
- Si no, **el enlace aparece en la terminal** donde corre `npm run dev`.

Los enlaces se guardan en MongoDB (colección `recuperaciones`) y MongoDB los borra solo al vencer (índice TTL).

## Cómo correrlo

1. Ejecuta `clinnova.sql` en MySQL Workbench.
2. Ten MongoDB corriendo (puerto 27017).
3. En `backend/`: `npm install`, copia `.env.example` como `.env` y pon tu contraseña de MySQL.
4. Crea los usuarios de prueba (los del `.sql` no tienen contraseña real):
   ```bash
   npm run crear-usuario -- admin@clinnova.hn 123456 admin
   npm run crear-usuario -- carlos.lopez@clinnova.hn 123456 medico
   npm run crear-usuario -- laura.mejia@clinnova.hn 123456 enfermeria
   npm run seed-mongo
   ```
5. `npm run dev` y abre **http://localhost:4000** (la API también sirve el panel y el portal).

Si ya tenías la base de una versión anterior, no hace falta volver a correr el `.sql`: al arrancar, la API agrega sola las columnas nuevas.
