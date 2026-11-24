# Clinnova API (Node.js + Express + MySQL + MongoDB)

Backend REST para el sistema **Clinnova**. Usa dos bases de datos:

| Base | Qué guarda | Por qué |
|---|---|---|
| **MySQL** (`clinnova`) | Usuarios, pacientes, citas, consultas, recetas, inventario | Datos estructurados con relaciones e integridad |
| **MongoDB** (`clinnova`) | `mensajes`, `notificaciones`, `bitacora` | Datos flexibles o de mucho volumen, sin relaciones complejas |

Si MongoDB no está corriendo, la API arranca igual: todo lo de MySQL funciona y las rutas de MongoDB responden **503**. Cuando MongoDB vuelve, se reconecta solo.

## Requisitos
- Node.js 18 o superior
- MySQL con la base de datos `clinnova` ya creada (corre primero `clinnova.sql` en Workbench)
- MongoDB Community Server corriendo en el puerto 27017 ([descarga](https://www.mongodb.com/try/download/community)). Para ver los datos: MongoDB Compass. La base y las colecciones se crean solas.

## Puesta en marcha

```bash
cd backend
npm install
cp .env.example .env     # luego edita .env con tu password de MySQL
npm run seed-mongo       # (opcional) mensajes y notificaciones de ejemplo en MongoDB
npm run dev              # arranca con recarga automática
```

Si todo va bien verás: `Clinnova API corriendo en http://localhost:4000`

Prueba en el navegador: **http://localhost:4000/api/health**
Debe responder: `{ "api": "ok", "db": "conectada", "mongo": "conectada" }`

## Endpoints disponibles

| Método | Ruta | Qué hace |
|--------|------|----------|
| GET  | `/api/health` | Comprueba API + conexión a BD |
| POST | `/api/auth/login` | Inicia sesión, devuelve token (pública) |
| GET  | `/api/auth/me` | Datos del usuario con sesión iniciada |
| POST | `/api/auth/register` | Crea un usuario — **solo admin/superadmin** |
| GET  | `/api/dashboard/resumen` | Tarjetas del día (pacientes, pendientes, etc.) |
| GET  | `/api/dashboard/agenda-hoy` | Citas de hoy |
| GET  | `/api/dashboard/tipos-consulta` | Datos para la gráfica de dona |
| GET  | `/api/pacientes?q=texto` | Lista/busca pacientes |
| GET  | `/api/pacientes/:id` | Un paciente |
| POST | `/api/pacientes` | Crea paciente |
| PUT  | `/api/pacientes/:id` | Actualiza paciente |
| DELETE | `/api/pacientes/:id` | Desactiva paciente |
| GET  | `/api/citas?fecha=YYYY-MM-DD` | Lista citas (agenda) |
| POST | `/api/citas` | Crea cita |
| PATCH | `/api/citas/:id/estado` | Cambia el estado de una cita |
| GET  | `/api/inventario?bajo=1` | Inventario (o solo stock bajo) |
| POST | `/api/inventario` | Crea artículo |
| POST | `/api/inventario/:id/movimiento` | Entrada/Salida/Ajuste (avisa a los admin si queda stock bajo) |
| PUT | `/api/inventario/:id` | Editar artículo |
| DELETE | `/api/inventario/:id` | Eliminar artículo (solo admin) |
| GET | `/api/inventario/:id/movimientos` | Historial de movimientos |

### Pacientes, citas y catálogos (extra)

| Método | Ruta | Qué hace |
|--------|------|----------|
| GET  | `/api/pacientes/:id/historial` | Consultas, recetas (con medicamentos), citas y signos vitales |
| POST | `/api/pacientes/:id/signos` | Registrar signos vitales (enfermería, médico o admin) |
| GET  | `/api/citas/:id` | Una cita |
| PUT  | `/api/citas/:id` | Editar o reprogramar (valida choques de horario) |
| GET  | `/api/catalogos` | Roles, especialidades, servicios, médicos, estados y tipos de cita |
| GET  | `/api/dashboard/semana` | Citas por día de los últimos 7 días |
| PATCH | `/api/auth/password` | Cambiar mi contraseña. Body: `actual`, `nueva` |

### Consultas y recetas (solo médico o admin para crear)

| Método | Ruta | Qué hace |
|--------|------|----------|
| GET  | `/api/consultas?paciente_id=&medico_id=&desde=&hasta=&q=` | Lista y búsqueda |
| GET  | `/api/consultas/:id` | Consulta completa con sus recetas |
| POST | `/api/consultas` | Registrar. Si trae `cita_id`, la cita pasa a "Atendida" |
| PUT  | `/api/consultas/:id` | Editar (solo el médico que la hizo o admin) |
| GET  | `/api/recetas?paciente_id=&medico_id=&q=` | Lista y búsqueda por paciente o medicamento |
| GET  | `/api/recetas/:id` | Receta con medicamentos y datos para imprimir |
| POST | `/api/recetas` | Crear. Body: `paciente_id`, `consulta_id?`, `notas?`, `items: [{medicamento, dosis, frecuencia, duracion, indicaciones}]` |
| DELETE | `/api/recetas/:id` | Anular (solo quien la hizo o admin) |

### Usuarios (solo admin)

| Método | Ruta | Qué hace |
|--------|------|----------|
| GET  | `/api/usuarios?q=` | Personal de la clínica |
| PUT  | `/api/usuarios/:id` | Editar datos y rol |
| PATCH | `/api/usuarios/:id/activo` | Activar / desactivar. Body: `activo` |
| PATCH | `/api/usuarios/:id/password` | Restablecer contraseña |

### MongoDB

| Método | Ruta | Qué hace |
|--------|------|----------|
| GET  | `/api/mensajes` | Conversaciones: una por paciente, con el último mensaje y los no leídos |
| GET  | `/api/mensajes/paciente/:pacienteId` | Conversación completa con un paciente |
| POST | `/api/mensajes` | La clínica envía un mensaje. Body: `paciente_id`, `texto`, `area?`, `adjunto?` |
| POST | `/api/mensajes/entrante` | Registra un mensaje que escribió el paciente y avisa al personal |
| PATCH | `/api/mensajes/paciente/:pacienteId/leidos` | Marca como leídos los mensajes del paciente |
| DELETE | `/api/mensajes/:id` | Borra un mensaje (solo su autor o un admin) |
| GET  | `/api/notificaciones?no_leidas=1` | Mis notificaciones |
| GET  | `/api/notificaciones/conteo` | Cuántas no leídas tengo |
| PATCH | `/api/notificaciones/:id/leida` | Marca una como leída |
| PATCH | `/api/notificaciones/leer-todas` | Marca todas como leídas |
| DELETE | `/api/notificaciones/:id` | Borra una |
| GET  | `/api/bitacora?usuario_id=&metodo=&desde=&hasta=` | Auditoría — **solo admin/superadmin** |

**Notificaciones automáticas:** al crear una cita (al médico), cuando el paciente pasa a "En espera" (al médico), cuando llega un mensaje de un paciente (médicos, recepción y admin) y cuando un artículo queda en stock bajo (admin).

**Bitácora:** cada POST, PUT, PATCH y DELETE queda registrado con usuario, ruta, resultado y hora. Nunca se guarda el contenido de la petición (podría tener contraseñas o datos médicos).

## Seguridad

- Todas las rutas excepto `/api/health` y `/api/auth/login` exigen el header
  `Authorization: Bearer <token>`. Sin él responden **401**.
- `/api/auth/register` solo lo puede usar un usuario con rol `admin` o `superadmin`.
- El servidor no arranca si falta `JWT_SECRET` en `.env` (mínimo 16 caracteres).

## Primer usuario para entrar

Los usuarios de ejemplo del `.sql` tienen una contraseña falsa. Crea (o reactiva) uno real desde la terminal:

```bash
npm run crear-usuario -- admin@clinnova.hn 123456 admin
```

Formato: `npm run crear-usuario -- <email> <password> [rol] [nombres] [apellidos]`
Roles: `superadmin`, `admin`, `medico`, `enfermeria`, `recepcion`, `laboratorio`.
Si el email ya existe, le cambia la contraseña y el rol.

Luego inicia sesión en `login.html`. Para crear más usuarios desde la API (con el token del admin):

```bash
curl -X POST http://localhost:4000/api/auth/register \
  -H "Content-Type: application/json" -H "Authorization: Bearer <TOKEN>" \
  -d '{"nombres":"Carlos","apellidos":"López","email":"dr@clinnova.hn","password":"123456","rol_id":3,"especialidad_id":1}'
```

## Estructura

```
backend/
├── server.js            # servidor principal
├── db.js                # conexión a MySQL
├── mongo.js             # conexión a MongoDB (Mongoose)
├── models/              # Mensaje, Notificacion, Bitacora (MongoDB)
├── services/
│   └── notificar.js     # crea notificaciones
├── middleware/
│   ├── auth.js          # requireAuth / requireRol
│   └── bitacora.js      # registra cada cambio en MongoDB
├── scripts/
│   ├── crear-usuario.js # crea el primer usuario
│   └── seed-mongo.js    # datos de ejemplo para MongoDB
├── .env                 # tus credenciales (NO se sube a git)
├── package.json
└── routes/
    ├── auth.js
    ├── pacientes.js
    ├── citas.js
    ├── dashboard.js
    ├── inventario.js
    ├── consultas.js
    ├── recetas.js
    ├── usuarios.js       # solo admin
    ├── catalogos.js      # listas para formularios
    ├── mensajes.js       # MongoDB
    ├── notificaciones.js # MongoDB
    └── bitacora.js       # MongoDB
```
