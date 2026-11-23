/* Clinnova Móvil — SPA sin dependencias (HTML + CSS + JS).
   Navegación por hash: #/login #/inicio #/agenda #/pacientes #/paciente/ID #/mensajes #/chat/ID #/perfil
   Los datos de demostración vienen del script clinnova.sql. El login intenta la API real
   (http://localhost:4000/api/auth/login) y, si no está disponible, entra en modo demo. */

const API = 'http://localhost:4000/api';
const $ = (s, el = document) => el.querySelector(s);

/* ---------- Datos de demostración (mismos del clinnova.sql) ---------- */
const MEDICO = { nombre: 'Dr. Carlos López', corto: 'Dr. López', rol: 'Medicina General', colegiatura: 'CM-12345', email: 'carlos.lopez@clinnova.hn', clinica: 'Clínica San Pedro · Tegucigalpa' };
const PACIENTES = [
  { id: 1, exp: 'EXP-0001', nombre: 'Juan Pérez García', nac: '1991-03-10', sexo: 'M', tel: '+504 9900-0001', sangre: 'O+', alergia: 'Ninguna conocida', color: 'info' },
  { id: 2, exp: 'EXP-0002', nombre: 'María López', nac: '1974-06-20', sexo: 'F', tel: '+504 9900-0002', sangre: 'A+', alergia: 'Penicilina', color: 'purple' },
  { id: 3, exp: 'EXP-0003', nombre: 'Carlos Reyes', nac: '1985-01-15', sexo: 'M', tel: '+504 9900-0003', sangre: 'B+', alergia: 'Ninguna conocida', color: 'good' },
  { id: 4, exp: 'EXP-0004', nombre: 'Ana Martínez', nac: '1998-09-05', sexo: 'F', tel: '+504 9900-0004', sangre: 'O-', alergia: 'Polen', color: 'warn' },
  { id: 5, exp: 'EXP-0005', nombre: 'Luis Herrera', nac: '1966-11-30', sexo: 'M', tel: '+504 9900-0005', sangre: 'AB+', alergia: 'Ninguna conocida', color: 'crit' },
  { id: 6, exp: 'EXP-0006', nombre: 'Sofía Ramírez', nac: '1993-07-22', sexo: 'F', tel: '+504 9900-0006', sangre: 'A-', alergia: 'Látex', color: 'info' },
];
const CITAS = [
  { id: 1, pac: 1, hora: '08:00', tipo: 'Consulta general', estado: 'En consulta' },
  { id: 2, pac: 2, hora: '08:30', tipo: 'Control', estado: 'En espera' },
  { id: 3, pac: 3, hora: '09:00', tipo: 'Seguimiento', estado: 'Confirmada' },
  { id: 4, pac: 4, hora: '09:30', tipo: 'Primera consulta', estado: 'Pendiente' },
  { id: 5, pac: 5, hora: '10:00', tipo: 'Control', estado: 'Confirmada' },
  { id: 6, pac: 6, hora: '10:30', tipo: 'Resultado de laboratorio', estado: 'Confirmada' },
];
const HISTORIAL = [
  { f: '12 oct 2026', t: 'Consulta general', n: 'Cuadro gripal leve. Reposo e hidratación.' },
  { f: '03 jul 2026', t: 'Control', n: 'Presión arterial 120/80. Sin cambios.' },
  { f: '21 feb 2026', t: 'Resultado de laboratorio', n: 'Hemograma dentro de parámetros normales.' },
];
const CHATS = {
  2: [{ d: 'in', t: 'Buenos días doctor, ya llegué a la clínica.' }, { d: 'out', t: 'Buen día María, la atiendo en unos minutos.' }],
  4: [{ d: 'in', t: '¿Debo ir en ayunas a la primera consulta?' }],
  5: [{ d: 'in', t: 'Gracias por la receta, doctor.' }, { d: 'out', t: 'Con gusto, cualquier duda me escribe.' }],
};
const NO_LEIDOS = { 4: 1, 2: 1 };

/* ---------- Íconos (mismo estilo de línea que el panel web) ---------- */
const P = {
  home: '<path d="M3 11l9-8 9 8"/><path d="M5 10v10h14V10"/>',
  cal: '<rect x="3" y="5" width="18" height="16" rx="3"/><path d="M8 3v4M16 3v4M3 10h18"/>',
  users: '<circle cx="9" cy="8" r="3.5"/><path d="M2.5 20c.6-3.6 3.2-5.5 6.5-5.5s5.9 1.9 6.5 5.5"/><path d="M16 4.6a3.5 3.5 0 010 6.8M18 14.8c2 .7 3.2 2.4 3.5 5.2"/>',
  msg: '<path d="M21 12a8 8 0 01-11.6 7.1L4 20l1-4.6A8 8 0 1121 12z"/>',
  user: '<circle cx="12" cy="8" r="4"/><path d="M4 21c.8-4 4-6 8-6s7.2 2 8 6"/>',
  bell: '<path d="M6 16V11a6 6 0 1112 0v5l1.5 2h-15z"/><path d="M10 21h4"/>',
  back: '<path d="M15 5l-7 7 7 7"/>',
  chev: '<path d="M9 5l7 7-7 7"/>',
  search: '<circle cx="11" cy="11" r="7"/><path d="M20 20l-3.5-3.5"/>',
  phone: '<path d="M5 4h4l2 5-2.5 1.5a11 11 0 005 5L15 13l5 2v4a2 2 0 01-2 2A16 16 0 013 6a2 2 0 012-2z"/>',
  file: '<path d="M14 3H7a2 2 0 00-2 2v14a2 2 0 002 2h10a2 2 0 002-2V8z"/><path d="M14 3v5h5M9 13h6M9 17h6"/>',
  clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
  check: '<path d="M5 13l4 4L19 7"/>',
  steth: '<path d="M6 3v6a4 4 0 008 0V3"/><path d="M10 13v2a5 5 0 0010 0v-1"/><circle cx="20" cy="12" r="2"/>',
  send: '<path d="M4 12l16-8-6 16-3-7z"/>',
  lock: '<rect x="4" y="10" width="16" height="11" rx="3"/><path d="M8 10V7a4 4 0 118 0v3"/>',
  mail: '<rect x="3" y="5" width="18" height="14" rx="3"/><path d="M4 7l8 6 8-6"/>',
  logout: '<path d="M10 4H6a2 2 0 00-2 2v12a2 2 0 002 2h4M16 8l4 4-4 4M20 12H9"/>',
  gear: '<circle cx="12" cy="12" r="3"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3M5 5l2 2M17 17l2 2M19 5l-2 2M7 17l-2 2"/>',
  shield: '<path d="M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6z"/>',
  moon: '<path d="M20 14.5A8 8 0 019.5 4a8 8 0 1010.5 10.5z"/>',
  help: '<circle cx="12" cy="12" r="9"/><path d="M9.5 9.5a2.5 2.5 0 114 2c-1 .7-1.5 1.2-1.5 2.5M12 17.5v.01"/>',
};
const ic = (n) => `<svg class="ic" viewBox="0 0 24 24">${P[n]}</svg>`;

/* ---------- Utilidades ---------- */
const iniciales = (n) => n.split(' ').slice(0, 2).map((x) => x[0]).join('');
const edad = (nac) => Math.floor((Date.now() - new Date(nac)) / 31557600000);
const badge = (e) => ({ 'En consulta': 'b-consulta', 'En espera': 'b-espera', Confirmada: 'b-conf', Pendiente: 'b-pend' }[e]);
const pac = (id) => PACIENTES.find((p) => p.id === +id);
const avatar = (p, cls = '') => `<div class="pav c-${p.color} ${cls}">${iniciales(p.nombre)}</div>`;
const hoy = () => new Date().toLocaleDateString('es-HN', { weekday: 'long', day: 'numeric', month: 'long' });
let sesion = JSON.parse(sessionStorage.getItem('clinnova_sesion') || 'null');

function toast(msg) {
  const t = $('#toast'); t.textContent = msg; t.classList.add('show');
  clearTimeout(toast.h); toast.h = setTimeout(() => t.classList.remove('show'), 2200);
}

/* ---------- Barra inferior ---------- */
function tabbar(activa) {
  const t = [['inicio', 'home', 'Inicio'], ['agenda', 'cal', 'Agenda'], ['pacientes', 'users', 'Pacientes'], ['mensajes', 'msg', 'Mensajes'], ['perfil', 'user', 'Perfil']];
  const noLeidos = Object.values(NO_LEIDOS).reduce((a, b) => a + b, 0);
  return `<nav class="tabbar">${t.map(([r, i, l]) =>
    `<a href="#/${r}" class="${activa === r ? 'on' : ''}">${ic(i)}<span>${l}</span>${r === 'mensajes' && noLeidos ? `<i class="pill">${noLeidos}</i>` : ''}</a>`).join('')}</nav>`;
}

/* ---------- Pantallas ---------- */
const V = {};

V.login = () => `
<div class="login">
  <img src="assets/logo.png" alt="Clinnova — Gestión Médica Inteligente">
  <h1>Bienvenido, doctor</h1>
  <p class="sub">Inicia sesión para ver tu agenda y tus pacientes</p>
  <form id="f">
    <div id="err"></div>
    <div class="field"><label>Correo electrónico</label><div class="in">${ic('mail')}<input id="email" type="email" value="carlos.lopez@clinnova.hn" autocomplete="username" required></div></div>
    <div class="field"><label>Contraseña</label><div class="in">${ic('lock')}<input id="pass" type="password" placeholder="••••••••" autocomplete="current-password" required></div></div>
    <button class="btn block" id="go" type="submit" style="margin-top:8px">Iniciar sesión</button>
  </form>
  <div class="hint">¿Sin conexión al servidor? Usa cualquier contraseña para entrar en <b>modo demo</b>.</div>
</div>`;

V.inicio = () => {
  const en = CITAS.filter((c) => c.estado === 'En espera').length;
  const sig = CITAS.find((c) => c.estado === 'En espera') || CITAS[0];
  const p = pac(sig.pac);
  return `<div class="screen">
  <div class="hero">
    <div class="row"><div class="avatar">CL</div><a class="iconbtn" href="#/mensajes">${ic('bell')}<i class="dot"></i></a></div>
    <h1>Hola, ${MEDICO.corto} 👋</h1><p class="fecha">${hoy()}</p>
  </div>
  <div class="stats">
    <div class="stat"><div class="ico c-info">${ic('users')}</div><b>${CITAS.length}</b><span>Pacientes hoy</span></div>
    <div class="stat"><div class="ico c-warn">${ic('clock')}</div><b>${en}</b><span>En sala de espera</span></div>
    <div class="stat"><div class="ico c-good">${ic('check')}</div><b>${CITAS.filter((c) => c.estado === 'Confirmada').length}</b><span>Confirmadas</span></div>
    <div class="stat"><div class="ico c-purple">${ic('msg')}</div><b>${Object.values(NO_LEIDOS).reduce((a, b) => a + b, 0)}</b><span>Mensajes nuevos</span></div>
  </div>
  <h2 class="sec">Siguiente paciente</h2>
  <div class="next">
    <small>${sig.hora} · ${sig.tipo}</small>
    <h3>${p.nombre}</h3>
    <span class="muted" style="color:var(--ink-2)">${edad(p.nac)} años · ${p.exp}</span>
    <div style="display:flex;gap:10px;margin-top:12px">
      <a class="btn sm" href="#/paciente/${p.id}">Ver expediente</a>
      <button class="btn sm ghost" data-llamar="${p.id}">${ic('phone')} Llamar</button>
    </div>
  </div>
  <h2 class="sec">Agenda de hoy <a href="#/agenda">Ver todo</a></h2>
  ${CITAS.slice(0, 4).map(filaCita).join('')}
  </div>${tabbar('inicio')}`;
};

function filaCita(c) {
  const p = pac(c.pac);
  return `<div class="card item" onclick="location.hash='#/paciente/${p.id}'">
    <div class="time">${c.hora}<small>a.m.</small></div>
    <div class="mid"><b>${p.nombre}</b><span>${c.tipo}</span></div>
    <span class="badge ${badge(c.estado)}">${c.estado}</span></div>`;
}

V.agenda = () => {
  const d = new Date(), base = new Date(d); base.setDate(d.getDate() - ((d.getDay() + 6) % 7));
  const dias = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'];
  const sem = dias.map((n, i) => { const x = new Date(base); x.setDate(base.getDate() + i); return `<div class="day ${x.toDateString() === d.toDateString() ? 'on' : ''}"><small>${n}</small><b>${x.getDate()}</b></div>`; }).join('');
  return `<div class="screen">
  <div class="top"><h1>Agenda</h1><a class="iconbtn" style="background:#fff;color:var(--brand-ink);box-shadow:var(--shadow)" href="#/mensajes">${ic('bell')}</a></div>
  <div class="week">${sem}</div>
  <div class="chips" id="chips">${['Todas', 'En consulta', 'En espera', 'Confirmada', 'Pendiente'].map((x, i) => `<button class="chip ${i ? '' : 'on'}" data-f="${x}">${x}</button>`).join('')}</div>
  <div id="lista" style="margin-top:6px">${CITAS.map(filaCita).join('')}</div>
  </div>${tabbar('agenda')}`;
};

V.pacientes = () => `<div class="screen">
  <div class="top"><h1>Pacientes</h1></div>
  <div class="search">${ic('search')}<input id="q" placeholder="Buscar por nombre o expediente" autocomplete="off"></div>
  <div id="lista" style="margin-top:10px">${PACIENTES.map(filaPaciente).join('')}</div>
  </div>${tabbar('pacientes')}`;

function filaPaciente(p) {
  return `<div class="card item" onclick="location.hash='#/paciente/${p.id}'">${avatar(p)}
    <div class="mid"><b>${p.nombre}</b><span>${p.exp} · ${edad(p.nac)} años</span></div>${ic('chev')}</div>`;
}

V.paciente = (id) => {
  const p = pac(id); if (!p) return V.pacientes();
  return `<div class="screen">
  <div class="top"><a class="back" href="#/pacientes">${ic('back')}</a><h1>Expediente</h1></div>
  <div class="profile">${avatar(p, 'big')}<h2>${p.nombre}</h2><p>${p.exp} · ${p.sexo === 'F' ? 'Femenino' : 'Masculino'} · ${edad(p.nac)} años</p></div>
  <div class="actions"><button class="btn" data-llamar="${p.id}">${ic('phone')} Llamar</button><a class="btn ghost" href="#/chat/${p.id}">${ic('msg')} Mensaje</a></div>
  <div class="card"><div class="kv">
    <div><small>Teléfono</small><b>${p.tel}</b></div><div><small>Tipo de sangre</small><b>${p.sangre}</b></div>
    <div><small>Nacimiento</small><b>${new Date(p.nac).toLocaleDateString('es-HN', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' })}</b></div>
    <div><small>Alergias</small><b style="color:${p.alergia.startsWith('Ninguna') ? 'inherit' : 'var(--crit)'}">${p.alergia}</b></div>
  </div></div>
  <h2 class="sec">Historial clínico</h2>
  <div class="card">${HISTORIAL.map((h) => `<div class="hist"><i class="dot"></i><div><b>${h.t}</b> <small>· ${h.f}</small><div style="color:var(--ink-2);font-size:13px;margin-top:2px">${h.n}</div></div></div>`).join('')}</div>
  <div class="pad" style="margin-top:6px"><button class="btn block" id="nueva-nota">${ic('file')} Nueva nota de consulta</button></div>
  </div>${tabbar('pacientes')}`;
};

V.mensajes = () => `<div class="screen">
  <div class="top"><h1>Mensajes</h1></div>
  ${Object.keys(CHATS).map((id) => {
    const p = pac(id), m = CHATS[id].at(-1), n = NO_LEIDOS[id];
    return `<div class="card msg item" onclick="location.hash='#/chat/${id}'">${avatar(p)}
      <div class="mid"><b>${p.nombre}</b><span>${m.d === 'out' ? 'Tú: ' : ''}${m.t}</span></div>${n ? `<i class="un">${n}</i>` : ''}</div>`;
  }).join('')}
  </div>${tabbar('mensajes')}`;

V.chat = (id) => {
  const p = pac(id); if (!p) return V.mensajes();
  delete NO_LEIDOS[id]; CHATS[id] = CHATS[id] || [];
  return `<div class="screen" style="padding-bottom:80px">
  <div class="top"><a class="back" href="#/mensajes">${ic('back')}</a>${avatar(p)}<h1 style="font-size:17px">${p.nombre}</h1></div>
  <div class="chat" id="chat">${CHATS[id].map((m) => `<div class="bub ${m.d}">${m.t}</div>`).join('') || '<div class="empty">Aún no hay mensajes</div>'}</div></div>
  <form class="compose" id="envio"><input id="txt" placeholder="Escribe un mensaje…" autocomplete="off"><button aria-label="Enviar">${ic('send')}</button></form>`;
};

V.perfil = () => `<div class="screen">
  <div class="hero" style="padding-bottom:30px;text-align:center">
    <div class="avatar" style="width:76px;height:76px;margin:6px auto 0;font-size:26px">CL</div>
    <h1>${MEDICO.nombre}</h1><p>${MEDICO.rol} · ${MEDICO.colegiatura}</p>
  </div>
  <div class="card menu" style="margin-top:16px">
    <div class="row">${'<span class="ico c-info">' + ic('mail') + '</span>'}<b>${MEDICO.email}</b></div>
    <div class="row"><span class="ico c-good">${ic('steth')}</span><b>${MEDICO.clinica}</b></div>
  </div>
  <div class="card menu">
    <div class="row" id="sw-notif"><span class="ico c-warn">${ic('bell')}</span><b>Notificaciones</b><i class="switch on"></i></div>
    <div class="row" id="sw-oscuro"><span class="ico c-purple">${ic('moon')}</span><b>Modo oscuro</b><i class="switch"></i></div>
    <div class="row"><span class="ico c-info">${ic('shield')}</span><b>Seguridad y privacidad</b>${ic('chev')}</div>
    <div class="row"><span class="ico c-good">${ic('help')}</span><b>Ayuda y soporte</b>${ic('chev')}</div>
  </div>
  <div class="pad"><button class="btn block ghost" id="salir" style="color:var(--crit);background:var(--crit-soft)">${ic('logout')} Cerrar sesión</button></div>
  <p style="text-align:center;color:var(--ink-3);font-size:12px;margin-top:16px">Clinnova Móvil v0.1 · Primer avance</p>
  </div>${tabbar('perfil')}`;

/* ---------- Eventos por pantalla ---------- */
const E = {};
E.login = () => {
  $('#f').onsubmit = async (e) => {
    e.preventDefault();
    const email = $('#email').value.trim(), password = $('#pass').value, btn = $('#go');
    btn.disabled = true; btn.textContent = 'Entrando…';
    try {
      const r = await fetch(API + '/auth/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email, password }), signal: AbortSignal.timeout(3000) });
      const d = await r.json();
      if (!r.ok) { $('#err').innerHTML = `<div class="err">${d.error || d.mensaje || 'Credenciales incorrectas'}</div>`; btn.disabled = false; btn.textContent = 'Iniciar sesión'; return; }
      sesion = { token: d.token, demo: false };
    } catch { sesion = { demo: true }; } // sin servidor → modo demo
    sessionStorage.setItem('clinnova_sesion', JSON.stringify(sesion));
    location.hash = '#/inicio';
  };
};
E.agenda = () => {
  $('#chips').onclick = (e) => {
    const b = e.target.closest('.chip'); if (!b) return;
    document.querySelectorAll('.chip').forEach((c) => c.classList.toggle('on', c === b));
    const f = b.dataset.f, l = CITAS.filter((c) => f === 'Todas' || c.estado === f);
    $('#lista').innerHTML = l.map(filaCita).join('') || '<div class="empty">Sin citas con este estado</div>';
  };
};
E.pacientes = () => {
  $('#q').oninput = (e) => {
    const sa = (t) => t.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
    const q = sa(e.target.value);
    const l = PACIENTES.filter((p) => sa(p.nombre + p.exp).includes(q));
    $('#lista').innerHTML = l.map(filaPaciente).join('') || '<div class="empty">No se encontraron pacientes</div>';
  };
};
E.paciente = () => { const b = $('#nueva-nota'); if (b) b.onclick = () => toast('Nota guardada (demo) ✓'); };
E.chat = (id) => {
  const box = $('#chat'); box.parentElement.scrollTop = 1e6;
  $('#envio').onsubmit = (e) => {
    e.preventDefault(); const t = $('#txt').value.trim(); if (!t) return;
    CHATS[id].push({ d: 'out', t }); $('#txt').value = '';
    box.insertAdjacentHTML('beforeend', `<div class="bub out">${t.replace(/</g, '&lt;')}</div>`);
    box.parentElement.scrollTop = 1e6;
  };
};
E.perfil = () => {
  $('#sw-notif').onclick = (e) => e.currentTarget.querySelector('.switch').classList.toggle('on');
  $('#sw-oscuro').onclick = (e) => { e.currentTarget.querySelector('.switch').classList.toggle('on'); toast('Modo oscuro: próximamente'); };
  $('#salir').onclick = () => { sessionStorage.removeItem('clinnova_sesion'); sesion = null; location.hash = '#/login'; };
};

/* ---------- Router ---------- */
const MOCK = new URLSearchParams(location.search).has('mock'); // para generar los mockups sin iniciar sesión
if (MOCK) document.body.classList.add('embed');

function render() {
  const [, ruta = 'login', arg] = location.hash.split('/');
  if (!sesion && !MOCK && ruta !== 'login') return (location.hash = '#/login');
  if (sesion && ruta === 'login') return (location.hash = '#/inicio');
  const vista = V[ruta] || V.inicio;
  $('#app').innerHTML = vista(arg);
  if (E[ruta]) E[ruta](arg);
  document.querySelectorAll('[data-llamar]').forEach((b) => (b.onclick = () => toast('Llamando a ' + pac(b.dataset.llamar).nombre + '…')));
}
addEventListener('hashchange', render);
render();
