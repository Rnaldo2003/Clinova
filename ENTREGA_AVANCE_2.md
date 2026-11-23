# Clinnova Móvil — Avance 2: primer avance del frontend y mockups

Proyecto: **Clinnova**, sistema de gestión médica · 415 Desarrollo de Aplicaciones de Vanguardia · Grupo 8
Integrantes: Ronaldo Alfaro, Kriss Dimarco · Docente: Ing. Reynaldo Cruz

## 1. Qué se entrega

| Entregable | Ubicación |
|---|---|
| Frontend de la app móvil (funcional) | [`app-movil/`](app-movil/) — abrir `app-movil/index.html` |
| Mockups de las pantallas | [`mockups/mockups.html`](mockups/mockups.html) + capturas PNG: [`mockups/todas-las-pantallas.png`](mockups/todas-las-pantallas.png), [`mockups/mockups-completo.png`](mockups/mockups-completo.png) y una por pantalla (`mockups/pantalla-*.png`) |
| Esta documentación | `ENTREGA_AVANCE_2.md` |

## 2. Tecnología

HTML5 + CSS3 + JavaScript puro (sin build ni dependencias), como **SPA con navegación por hash** y diseño *mobile-first* instalable como PWA (`manifest.json`). Se eligió esta tecnología porque el panel web del proyecto ya está hecho así: comparte colores, tipografía e íconos y se conecta a la misma API (Node + Express + MySQL + MongoDB) sin cambiar el backend.

## 3. Funcionalidades implementadas

1. **Login** — llama a `POST /api/auth/login` del backend. Si el servidor no está disponible entra en *modo demo* para poder revisar la app.
2. **Inicio** — saludo, tarjetas del día (pacientes, en espera, confirmadas, mensajes), siguiente paciente y agenda corta.
3. **Agenda** — semana actual y filtros por estado (En consulta, En espera, Confirmada, Pendiente).
4. **Pacientes** — lista con búsqueda en vivo por nombre o expediente.
5. **Expediente** — datos, tipo de sangre, alergias, historial clínico y acciones rápidas (llamar, mensaje, nueva nota).
6. **Mensajes** — bandeja con no leídos y chat con el paciente.
7. **Perfil** — datos del médico, ajustes y cerrar sesión.
8. **Navegación** — barra inferior de 5 pestañas, botón atrás y rutas protegidas (sin sesión redirige al login).

Los datos de la demo son los mismos de `clinnova.sql`.

## 4. Justificación del diseño

- **Identidad coherente con el panel web:** gradiente azul del menú lateral como encabezado, tarjetas blancas con esquinas redondeadas y tipografía Inter.
- **Pensado para el médico en movimiento:** lo primero que ve es *el siguiente paciente* y cuántos esperan; el resto está a un toque.
- **Barra inferior** con 5 destinos (patrón estándar de móvil, accesible con el pulgar).
- **Color con significado:** azul = acción, verde = confirmado, ámbar = en espera, rojo = alerta (alergias), igual que en el panel.
- **Áreas táctiles de 44 px o más**, contraste alto y `viewport-fit` para pantallas con notch.

## 5. Mockups

`mockups/mockups.html` muestra las 7 pantallas dentro de marcos de teléfono, junto con la paleta y el flujo de navegación. Son renderizados del propio frontend, así que siempre coinciden con lo implementado.

> Nota: si el docente exige Figma/Adobe XD, estas pantallas sirven de referencia directa para recrearlas allí; los colores y medidas están en `app-movil/css/styles.css`.

## 6. Cómo probarlo

- **Rápido:** abrir `app-movil/index.html` en el navegador (en pantalla grande se ve dentro de un marco de teléfono; en F12 → modo móvil se ve completo). Contraseña: cualquiera (modo demo).
- **Con backend real:** seguir el README principal (MySQL + MongoDB + `npm run dev`) y entrar con un usuario creado con `npm run crear-usuario`.

## 7. Próximos pasos

- **Pasar la app a Flutter**, como se definió en el Avance 1. Este frontend funciona como prototipo navegable: las pantallas, los colores y el flujo ya están validados, y se trasladan directamente a widgets de Flutter.
- Conectar agenda, pacientes y mensajes a los endpoints reales (`/api/citas`, `/api/pacientes`, `/api/mensajes`).
- Notificaciones push y modo oscuro.
