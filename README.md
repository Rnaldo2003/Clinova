# Clinova

Sistema de gestión médica para clínicas y consultorios — proyecto de la clase de Aplicaciones de Vanguardia.

## Contenido

| Archivo / carpeta | Qué es |
|---|---|
| `login.html` | Pantalla de inicio de sesión (llama a la API) |
| `Clinnova.html` | Panel principal: dashboard, agenda, pacientes, inventario… |
| `clinnova.sql` | Script de la base de datos MySQL `clinnova` (tablas + datos de ejemplo) |
| `backend/` | API REST en Node.js + Express + MySQL + MongoDB — ver [backend/README.md](backend/README.md) |
| `Sistema_para_Doctores.docx` | Documento de presentación del producto |
| `app-movil/` | Frontend de la app móvil (prototipo navegable HTML/CSS/JS) — abrir `app-movil/index.html` |
| `mockups/` | Mockups de las pantallas de la app móvil |
| `ENTREGA_AVANCE_2.md` | Documentación del Avance 2 (frontend y mockups) |

## Cómo correrlo

1. Ejecuta `clinnova.sql` en MySQL Workbench.
2. Ten MongoDB corriendo (puerto 27017).
3. En `backend/`: `npm install`, copia `.env.example` como `.env` y pon tu contraseña de MySQL, luego `npm run dev`.
4. Abre `login.html` en el navegador.
