# Clinnova API (Node.js + Express + MySQL)

Backend REST para el sistema **Clinnova**. Se conecta a la base de datos `clinnova` de MySQL.

## Requisitos
- Node.js 18 o superior
- MySQL con la base de datos `clinnova` ya creada (corre primero `clinnova.sql` en Workbench)

## Puesta en marcha

```bash
cd backend
npm install
cp .env.example .env     # luego edita .env con tu password de MySQL
npm run dev              # arranca con recarga automática (nodemon)
```

Si todo va bien verás: `Clinnova API corriendo en http://localhost:4000`

Prueba en el navegador: **http://localhost:4000/api/health**
Debe responder: `{ "api": "ok", "db": "conectada" }`

## Endpoints disponibles

| Método | Ruta | Qué hace |
|--------|------|----------|
| GET  | `/api/health` | Comprueba API + conexión a BD |
| POST | `/api/auth/register` | Crea un usuario (encripta la contraseña) |
| POST | `/api/auth/login` | Inicia sesión, devuelve token |
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
| POST | `/api/inventario/:id/movimiento` | Entrada/Salida/Ajuste |

## Primer usuario para entrar

Los usuarios de ejemplo del `.sql` tienen una contraseña falsa, así que crea uno real:

```bash
curl -X POST http://localhost:4000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"nombres":"Carlos","apellidos":"López","email":"dr@clinnova.hn","password":"123456","rol_id":3,"especialidad_id":1}'
```

Luego inicia sesión:

```bash
curl -X POST http://localhost:4000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"dr@clinnova.hn","password":"123456"}'
```

## Estructura

```
backend/
├── server.js            # servidor principal
├── db.js                # conexión a MySQL
├── .env                 # tus credenciales (NO se sube a git)
├── package.json
└── routes/
    ├── auth.js
    ├── pacientes.js
    ├── citas.js
    ├── dashboard.js
    └── inventario.js
```
