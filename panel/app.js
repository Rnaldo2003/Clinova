/* ============================================================
   Clinnova · núcleo del panel web
   - Cliente de la API (con el token de sesión)
   - Navegación por secciones (#/pacientes, #/agenda/2026-11-23 …)
   - Utilidades de interfaz: modales, avisos, formatos de fecha…
   Cada sección vive en panel/views/<nombre>.js y se registra con C.vista()
   ============================================================ */
const C = (() => {
  // Si el panel se abre desde la API (http://localhost:4000) usa la misma dirección;
  // si se abre como archivo o desde otro servidor, apunta a localhost:4000.
  const API = location.port === '4000' ? '/api' : 'http://localhost:4000/api';

  const almacen = (() => {
    try { return localStorage.getItem('clinnova_token') ? localStorage : sessionStorage; } catch (_) { return null; }
  })();
  const TOKEN = almacen ? almacen.getItem('clinnova_token') : null;

  const $ = (sel, raiz = document) => raiz.querySelector(sel);
  const $$ = (sel, raiz = document) => [...raiz.querySelectorAll(sel)];

  /* ---------------- Sesión ---------------- */
  function salir() {
    try {
      ['clinnova_token', 'clinnova_user'].forEach((k) => { localStorage.removeItem(k); sessionStorage.removeItem(k); });
    } catch (_) {}
    location.replace('login.html');
  }

  /* ---------------- API ---------------- */
  async function api(ruta, { method = 'GET', body } = {}) {
    let r;
    try {
      r = await fetch(API + ruta, {
        method,
        headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + TOKEN },
        body: body === undefined ? undefined : JSON.stringify(body),
      });
    } catch (_) {
      throw new Error('No se pudo conectar con el servidor. ¿Está corriendo la API?');
    }
    if (r.status === 401) { salir(); throw new Error('Tu sesión venció'); }
    const data = await r.json().catch(() => ({}));
    if (!r.ok) {
      const e = new Error(data.error || 'Error ' + r.status);
      e.status = r.status;
      throw e;
    }
    return data;
  }

  /* ---------------- Usuario y permisos ---------------- */
  const yo = { id: null, nombre: '', rol: '', especialidad: null };
  const es = (...roles) => roles.includes(yo.rol);
  const permisos = {
    clinico: () => es('medico', 'admin', 'superadmin'),        // consultas y recetas
    signos: () => es('medico', 'enfermeria', 'admin', 'superadmin'),
    admin: () => es('admin', 'superadmin'),
  };

  let _catalogos = null;
  async function catalogos() {
    if (!_catalogos) _catalogos = await api('/catalogos');
    return _catalogos;
  }

  /* ---------------- Formatos ---------------- */
  const esc = (v) => String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const iniciales = (n) => String(n || '?').trim().split(/\s+/).slice(0, 2).map((p) => p[0]).join('').toUpperCase();
  const COLORES = ['i-blue', 'i-green', 'i-amber', 'i-purple', 'i-red'];
  const colorDe = (s) => COLORES[[...String(s)].reduce((a, c) => a + c.charCodeAt(0), 0) % COLORES.length];
  const avatar = (nombre, extra = '') => `<span class="av ${colorDe(nombre)}" ${extra}>${esc(iniciales(nombre))}</span>`;

  const hoyISO = () => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  };
  // Convierte "2026-11-23" o "2026-11-23 10:00:00" o ISO a Date local sin desfases de zona horaria
  function aFecha(v) {
    if (!v) return null;
    if (v instanceof Date) return v;
    const s = String(v);
    const m = s.match(/^(\d{4})-(\d{2})-(\d{2})(?:[ T](\d{2}):(\d{2})(?::(\d{2}))?)?$/);
    if (m) return new Date(+m[1], +m[2] - 1, +m[3], +(m[4] || 0), +(m[5] || 0), +(m[6] || 0));
    return new Date(s);
  }
  const MESES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
  const fecha = (v) => { const d = aFecha(v); return d && !isNaN(d) ? `${d.getDate()} ${MESES[d.getMonth()]} ${d.getFullYear()}` : '—'; };
  const fechaLarga = (v) => {
    const d = aFecha(v);
    if (!d) return '—';
    const t = d.toLocaleDateString('es-HN', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
    return t.charAt(0).toUpperCase() + t.slice(1);
  };
  const hora = (v) => {
    if (!v) return '—';
    const s = String(v);
    if (/^\d{2}:\d{2}/.test(s)) return s.slice(0, 5);
    const d = aFecha(s);
    return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
  };
  const fechaHora = (v) => `${fecha(v)}, ${hora(v)}`;
  function hace(v) {
    const d = aFecha(v); if (!d) return '';
    const s = (Date.now() - d.getTime()) / 1000;
    if (s < 60) return 'ahora';
    if (s < 3600) return `hace ${Math.floor(s / 60)} min`;
    if (s < 86400) return `hace ${Math.floor(s / 3600)} h`;
    if (s < 172800) return 'ayer';
    return fecha(d);
  }
  const ROLES = { superadmin: 'Superadmin', admin: 'Administrador', medico: 'Médico', enfermeria: 'Enfermería', recepcion: 'Recepción', laboratorio: 'Laboratorio' };
  const rolNombre = (r) => ROLES[r] || r;

  const ESTADO_CLASE = {
    Pendiente: 'b-grey', Confirmada: 'b-blue', 'En espera': 'b-amber', 'En consulta': 'b-purple',
    Atendida: 'b-green', Cancelada: 'b-red', 'No asistio': 'b-red',
  };
  const estadoTexto = (e) => (e === 'No asistio' ? 'No asistió' : e);
  const badgeEstado = (e) => `<span class="badge ${ESTADO_CLASE[e] || 'b-grey'}">${esc(estadoTexto(e))}</span>`;

  /* ---------------- Interfaz ---------------- */
  const icono = (id, extra = '') => `<svg class="ic" ${extra}><use href="#${id}"/></svg>`;
  const vacio = (titulo, texto = '', ic = 'i-search') =>
    `<div class="empty">${icono(ic)}<b>${esc(titulo)}</b>${esc(texto)}</div>`;
  const cargando = () => '<div class="loading">Cargando…</div>';

  function aviso(texto, tipo = 'ok') {
    const t = document.createElement('div');
    t.className = 'toast ' + tipo;
    t.innerHTML = icono(tipo === 'bad' ? 'i-alert' : 'i-check') + esc(texto);
    $('#toasts').appendChild(t);
    setTimeout(() => t.remove(), tipo === 'bad' ? 5000 : 3000);
  }
  const fallo = (e) => aviso(e.message || String(e), 'bad');

  // Abre un modal. Devuelve { el, cerrar }. Cierra con Esc, la X o el fondo.
  function modal({ titulo, cuerpo, pie = '', tam = '', alAbrir }) {
    const bg = document.createElement('div');
    bg.className = 'modal-bg';
    bg.innerHTML = `<div class="modal ${tam}" role="dialog" aria-modal="true">
        <div class="mh"><h2>${esc(titulo)}</h2><button class="ibtn" data-x aria-label="Cerrar">${icono('i-x')}</button></div>
        <div class="mb">${cuerpo}</div>${pie ? `<div class="mf">${pie}</div>` : ''}</div>`;
    document.body.appendChild(bg);
    const cerrar = () => { bg.remove(); document.removeEventListener('keydown', esc_); };
    const esc_ = (e) => { if (e.key === 'Escape') cerrar(); };
    document.addEventListener('keydown', esc_);
    bg.addEventListener('mousedown', (e) => { if (e.target === bg) cerrar(); });
    $$('[data-x]', bg).forEach((b) => b.addEventListener('click', cerrar));
    const m = { el: bg, cerrar };
    if (alAbrir) alAbrir(m);
    const primero = bg.querySelector('input:not([type=hidden]),select,textarea');
    if (primero) setTimeout(() => primero.focus(), 30);
    return m;
  }

  function confirmar(texto, { si = 'Sí, continuar', peligro = false } = {}) {
    return new Promise((ok) => {
      const m = modal({
        titulo: 'Confirmar', tam: 'sm', cuerpo: `<p style="margin:0;font-size:14px">${esc(texto)}</p>`,
        pie: `<button class="btn" data-x>Cancelar</button><button class="btn ${peligro ? 'dan' : 'pri'}" data-si>${esc(si)}</button>`,
      });
      m.el.querySelector('[data-si]').addEventListener('click', () => { m.cerrar(); ok(true); });
      m.el.querySelectorAll('[data-x]').forEach((b) => b.addEventListener('click', () => ok(false)));
    });
  }

  // Formulario en modal: arma el HTML, valida y envía. guardar(datos) debe lanzar error si falla.
  function formulario({ titulo, campos, valores = {}, tam = '', textoBoton = 'Guardar', guardar, alAbrir }) {
    const html = campos.map((c) => campoHTML(c, valores[c.n])).join('');
    const m = modal({
      titulo, tam,
      cuerpo: `<div class="err" hidden></div><form class="form" novalidate>${html}<button type="submit" hidden></button></form>`,
      pie: `<button class="btn" data-x>Cancelar</button><button class="btn pri" data-ok>${icono('i-check')}${esc(textoBoton)}</button>`,
      alAbrir,
    });
    const form = m.el.querySelector('form');
    const errBox = m.el.querySelector('.err');
    const boton = m.el.querySelector('[data-ok]');
    async function enviar(e) {
      if (e) e.preventDefault();
      errBox.hidden = true;
      const datos = leerForm(form);
      const falta = campos.find((c) => c.req && (datos[c.n] === null || datos[c.n] === ''));
      if (falta) { errBox.textContent = `"${falta.l}" es obligatorio`; errBox.hidden = false; return; }
      boton.disabled = true;
      try { await guardar(datos, m); m.cerrar(); }
      catch (err) { errBox.textContent = err.message; errBox.hidden = false; }
      finally { boton.disabled = false; }
    }
    form.addEventListener('submit', enviar);
    boton.addEventListener('click', enviar);
    return m;
  }

  // Tipos de campo: text, email, tel, date, time, number, textarea, select, sec (subtítulo), password
  function campoHTML(c, valor) {
    if (c.t === 'sec') return `<div class="fsec">${esc(c.l)}</div>`;
    const v = valor ?? c.v ?? '';
    const cls = c.full || c.t === 'textarea' ? 'fld full' : 'fld';
    const req = c.req ? ' <span class="req">*</span>' : '';
    const attrs = `name="${c.n}" id="f_${c.n}" ${c.ph ? `placeholder="${esc(c.ph)}"` : ''} ${c.min !== undefined ? `min="${c.min}"` : ''} ${c.step ? `step="${c.step}"` : ''} ${c.dis ? 'disabled' : ''}`;
    let control;
    if (c.t === 'textarea') control = `<textarea class="inp" ${attrs}>${esc(v)}</textarea>`;
    else if (c.t === 'select') {
      const ops = (c.ops || []).map((o) => {
        const [val, txt] = Array.isArray(o) ? o : [o, o];
        return `<option value="${esc(val)}" ${String(val) === String(v) ? 'selected' : ''}>${esc(txt)}</option>`;
      }).join('');
      control = `<select class="inp" ${attrs}>${c.vacio !== undefined ? `<option value="">${esc(c.vacio)}</option>` : ''}${ops}</select>`;
    } else control = `<input class="inp" type="${c.t || 'text'}" value="${esc(v)}" ${attrs}>`;
    return `<div class="${cls}"><label for="f_${c.n}">${esc(c.l)}${req}</label>${control}${c.hint ? `<div class="hint">${esc(c.hint)}</div>` : ''}</div>`;
  }

  function leerForm(form) {
    const datos = {};
    $$('[name]', form).forEach((el) => {
      if (el.disabled) return;
      const v = el.value.trim();
      datos[el.name] = v === '' ? null : el.type === 'number' ? Number(v) : v;
    });
    return datos;
  }

  // Selector de paciente con búsqueda (para formularios). Devuelve HTML; usar con montarBuscaPaciente
  const buscaPacienteHTML = (n = 'paciente_id', etiqueta = 'Paciente') => `
    <div class="fld full"><label>${esc(etiqueta)} <span class="req">*</span></label>
      <div class="sbox">${icono('i-search')}<input class="inp" data-bp placeholder="Escribe nombre o expediente…" autocomplete="off"></div>
      <input type="hidden" name="${n}"><div class="sres" data-bpr style="position:relative;top:4px"></div></div>`;
  function montarBuscaPaciente(raiz, inicial) {
    const inp = raiz.querySelector('[data-bp]');
    const hid = inp.closest('.fld').querySelector('input[type=hidden]');
    const res = raiz.querySelector('[data-bpr]');
    if (inicial) { inp.value = inicial.nombre; hid.value = inicial.id; }
    let t;
    inp.addEventListener('input', () => {
      hid.value = '';
      clearTimeout(t);
      const q = inp.value.trim();
      if (q.length < 2) { res.classList.remove('open'); return; }
      t = setTimeout(async () => {
        const lista = await api('/pacientes?q=' + encodeURIComponent(q)).catch(() => []);
        res.innerHTML = lista.slice(0, 7).map((p) =>
          `<a href="#" data-id="${p.id}" data-n="${esc(p.nombres + ' ' + p.apellidos)}">${avatar(p.nombres + ' ' + p.apellidos)}<span><b>${esc(p.nombres + ' ' + p.apellidos)}</b><br><span class="sub">${esc(p.expediente_no || '')} · ${p.edad ?? '—'} años</span></span></a>`
        ).join('') || '<div class="empty" style="padding:14px">Sin resultados</div>';
        res.classList.add('open');
      }, 220);
    });
    res.addEventListener('click', (e) => {
      const a = e.target.closest('a'); if (!a) return;
      e.preventDefault();
      inp.value = a.dataset.n; hid.value = a.dataset.id;
      res.classList.remove('open');
      hid.dispatchEvent(new Event('change'));
    });
  }

  /* ---------------- Navegación ---------------- */
  const vistas = {};
  function vista(clave, def) { vistas[clave] = def; }
  const ir = (ruta) => { location.hash = '#/' + ruta; };
  let rutaActual = '';

  async function mostrar() {
    const partes = (location.hash.replace(/^#\/?/, '') || 'inicio').split('/');
    const clave = vistas[partes[0]] ? partes[0] : 'inicio';
    rutaActual = location.hash;
    $$('#nav a').forEach((a) => a.classList.toggle('on', a.dataset.key === clave));
    $('#app').classList.remove('open');
    const v = vistas[clave];
    document.title = `${v.titulo} · Clinnova`;
    const el = $('#view');
    el.innerHTML = cargando();
    window.scrollTo(0, 0);
    try { await v.render(el, partes.slice(1).map(decodeURIComponent)); }
    catch (e) {
      el.innerHTML = vacio('No se pudo cargar esta sección', e.message, 'i-alert');
    }
  }
  const recargar = () => mostrar();

  /* ---------------- Barra superior ---------------- */
  function barraSuperior() {
    // Menú del usuario
    const meWrap = $('#meWrap');
    $('#meBtn').addEventListener('click', (e) => { e.stopPropagation(); meWrap.classList.toggle('open'); $('#nwrap').classList.remove('open'); });
    $('#logoutBtn').addEventListener('click', salir);
    $('#profileBtn').addEventListener('click', () => { meWrap.classList.remove('open'); ir('configuracion'); });
    // Menú móvil
    $('#hamb').addEventListener('click', () => $('#app').classList.toggle('open'));
    $('#scrim').addEventListener('click', () => $('#app').classList.remove('open'));
    document.addEventListener('click', (e) => {
      if (!e.target.closest('#meWrap')) meWrap.classList.remove('open');
      if (!e.target.closest('#nwrap')) $('#nwrap').classList.remove('open');
      if (!e.target.closest('#gsearch')) $('#sres').classList.remove('open');
    });

    // Búsqueda global de pacientes
    const inp = $('#searchInput'), res = $('#sres');
    let t;
    inp.addEventListener('input', () => {
      clearTimeout(t);
      const q = inp.value.trim();
      if (q.length < 2) { res.classList.remove('open'); return; }
      t = setTimeout(async () => {
        const lista = await api('/pacientes?q=' + encodeURIComponent(q)).catch(() => []);
        res.innerHTML = lista.slice(0, 8).map((p) =>
          `<a href="#/expediente/${p.id}">${avatar(p.nombres + ' ' + p.apellidos)}<span><b>${esc(p.nombres + ' ' + p.apellidos)}</b> <span class="sub">${esc(p.expediente_no || '')} · ${p.edad ?? '—'} años</span></span></a>`
        ).join('') || '<div class="empty" style="padding:14px">Sin resultados</div>';
        res.classList.add('open');
      }, 220);
    });
    inp.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') { const a = res.querySelector('a'); if (a) { location.hash = a.getAttribute('href'); res.classList.remove('open'); inp.value = ''; } }
      if (e.key === 'Escape') { res.classList.remove('open'); inp.blur(); }
    });
    res.addEventListener('click', () => { res.classList.remove('open'); inp.value = ''; });
    document.addEventListener('keydown', (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); inp.focus(); }
    });

    // Notificaciones
    $('#nbtn').addEventListener('click', (e) => {
      e.stopPropagation();
      const w = $('#nwrap'); w.classList.toggle('open'); meWrap.classList.remove('open');
      if (w.classList.contains('open')) cargarNotificaciones();
    });
    $('#nreadall').addEventListener('click', async () => {
      await api('/notificaciones/leer-todas', { method: 'PATCH' }).catch(fallo);
      cargarNotificaciones(); contadores();
    });
    $('#nlist').addEventListener('click', async (e) => {
      const it = e.target.closest('.nitem'); if (!it) return;
      if (it.classList.contains('unread')) api(`/notificaciones/${it.dataset.id}/leida`, { method: 'PATCH' }).then(contadores).catch(() => {});
      $('#nwrap').classList.remove('open');
      if (it.dataset.go) location.hash = it.dataset.go;
    });
  }

  const ICONO_NOTI = { Cita: ['i-cal', 'i-blue'], Mensaje: ['i-msg', 'i-purple'], Inventario: ['i-box', 'i-amber'], Resultado: ['i-flask', 'i-green'], Seguimiento: ['i-follow', 'i-red'], Tarea: ['i-clip', 'i-blue'], Documento: ['i-doc', 'i-blue'] };
  function destinoNoti(n) {
    const d = n.datos || {};
    if (n.tipo === 'Mensaje' && d.paciente_id) return `#/mensajes/${d.paciente_id}`;
    if (n.tipo === 'Inventario') return '#/inventario';
    if (n.tipo === 'Cita') return '#/agenda';
    if (d.paciente_id) return `#/expediente/${d.paciente_id}`;
    return '';
  }
  async function cargarNotificaciones() {
    const box = $('#nlist');
    box.innerHTML = cargando();
    try {
      const lista = await api('/notificaciones?limite=30');
      box.innerHTML = lista.map((n) => {
        const [ic, col] = ICONO_NOTI[n.tipo] || ['i-bell', 'i-blue'];
        return `<div class="nitem ${n.leida ? '' : 'unread'}" data-id="${n._id}" data-go="${destinoNoti(n)}">
          <div class="ni ${col}">${icono(ic)}</div>
          <div><b>${esc(n.titulo)}</b><p>${esc(n.descripcion || '')}</p><time>${hace(n.creado_en)}</time></div></div>`;
      }).join('') || vacio('Sin notificaciones', '', 'i-bell');
    } catch (e) {
      box.innerHTML = vacio('Notificaciones no disponibles', e.status === 503 ? 'MongoDB no está corriendo.' : e.message, 'i-bell');
    }
  }

  function ponerContador(sel, n) {
    const el = $(sel); if (!el) return;
    el.textContent = n > 99 ? '99+' : n;
    el.hidden = !n;
  }
  async function contadores() {
    const [n, r] = await Promise.all([
      api('/notificaciones/conteo').catch(() => ({ no_leidas: 0 })),
      api('/dashboard/resumen').catch(() => ({ mensajes: 0 })),
    ]);
    ponerContador('#ncount', n.no_leidas);
    ponerContador('#mcount', r.mensajes);
    ponerContador('#navMsgCount', r.mensajes);
  }

  /* ---------------- Arranque ---------------- */
  async function iniciar() {
    if (!TOKEN) return salir();
    barraSuperior();
    try {
      Object.assign(yo, await api('/auth/me'));
    } catch (e) {
      $('#view').innerHTML = vacio('No se pudo conectar con el servidor', e.message, 'i-alert');
      return;
    }
    const titulo = yo.rol === 'medico' ? 'Dr. ' + yo.nombre : yo.nombre;
    $('#meName').textContent = titulo;
    $('#meRole').textContent = yo.especialidad || rolNombre(yo.rol);
    $('#meAv').textContent = iniciales(yo.nombre);
    window.addEventListener('hashchange', mostrar);
    mostrar();
    contadores();
    setInterval(contadores, 30000);
  }

  return {
    api, yo, es, permisos, catalogos, salir,
    $, $$, esc, iniciales, avatar, colorDe, icono, vacio, cargando, aviso, fallo,
    modal, confirmar, formulario, leerForm, campoHTML, buscaPacienteHTML, montarBuscaPaciente,
    hoyISO, aFecha, fecha, fechaLarga, hora, fechaHora, hace, rolNombre, badgeEstado, estadoTexto, ESTADO_CLASE,
    vista, ir, recargar, contadores, iniciar,
    get rutaActual() { return rutaActual; },
  };
})();
