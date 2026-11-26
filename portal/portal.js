/* ============================================================
   Clinnova · Portal de pacientes
   Pantallas: Inicio, Citas, Mensajes, Recetas y Perfil.
   Usa /api/portal/* con un token de paciente (separado del personal).
   ============================================================ */
(() => {
  const API = location.port === '4000' ? '/api' : 'http://localhost:4000/api';
  const CLAVE = 'clinnova_portal_token';
  const $ = (s, r = document) => r.querySelector(s);
  const esc = (v) => String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const ic = (id) => `<svg class="ic"><use href="#${id}"/></svg>`;

  let token = null;
  try { token = localStorage.getItem(CLAVE) || sessionStorage.getItem(CLAVE); } catch (_) {}
  let yo = null;

  /* ---------------- API ---------------- */
  async function api(ruta, { method = 'GET', body, publico = false } = {}) {
    let r;
    try {
      r = await fetch(API + ruta, {
        method,
        headers: { 'Content-Type': 'application/json', ...(publico ? {} : { Authorization: 'Bearer ' + token }) },
        body: body === undefined ? undefined : JSON.stringify(body),
      });
    } catch (_) { throw new Error('No se pudo conectar con la clínica. Intenta de nuevo en un momento.'); }
    const data = await r.json().catch(() => ({}));
    if (r.status === 401 && !publico) { salir(); throw new Error(data.error || 'Tu sesión venció'); }
    if (!r.ok) { const e = new Error(data.error || 'Error ' + r.status); e.status = r.status; throw e; }
    return data;
  }
  function salir() {
    try { localStorage.removeItem(CLAVE); sessionStorage.removeItem(CLAVE); } catch (_) {}
    token = null; yo = null;
    $('#app').hidden = true; mostrarAcceso('login');
  }

  /* ---------------- Formatos ---------------- */
  const MES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
  function aFecha(v) {
    const m = String(v || '').match(/^(\d{4})-(\d{2})-(\d{2})(?:[ T](\d{2}):(\d{2}))?/);
    return m && !/Z$|[+-]\d\d:?\d\d$/.test(String(v)) ? new Date(+m[1], +m[2] - 1, +m[3], +(m[4] || 0), +(m[5] || 0)) : new Date(v);
  }
  const fecha = (v) => { const d = aFecha(v); return `${d.getDate()} ${MES[d.getMonth()]} ${d.getFullYear()}`; };
  const fechaLarga = (v) => { const t = aFecha(v).toLocaleDateString('es-HN', { weekday: 'long', day: 'numeric', month: 'long' }); return t[0].toUpperCase() + t.slice(1); };
  const hora = (v) => { const s = String(v || ''); if (/^\d{2}:\d{2}/.test(s)) return s.slice(0, 5); const d = aFecha(s); return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`; };
  const hoyISO = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };
  const ESTADO = { Pendiente: ['b-amber', 'Por confirmar'], Confirmada: ['b-blue', 'Confirmada'], 'En espera': ['b-purple', 'En espera'], 'En consulta': ['b-purple', 'En consulta'], Atendida: ['b-green', 'Atendida'], Cancelada: ['b-red', 'Cancelada'], 'No asistio': ['b-grey', 'No asistió'] };
  const badge = (e) => { const [c, t] = ESTADO[e] || ['b-grey', e]; return `<span class="badge ${c}">${esc(t)}</span>`; };
  const vacio = (txt, i = 'i-file') => `<div class="vacio">${ic(i)}${esc(txt)}</div>`;

  function aviso(t, tipo = 'ok') {
    const el = document.createElement('div');
    el.className = 'toast ' + tipo; el.textContent = t;
    $('#toasts').appendChild(el);
    setTimeout(() => el.remove(), tipo === 'bad' ? 5000 : 3000);
  }
  function modal(titulo, html) {
    const bg = document.createElement('div');
    bg.className = 'mbg';
    bg.innerHTML = `<div class="modal" role="dialog" aria-modal="true"><div class="mh"><h2>${esc(titulo)}</h2><button data-x aria-label="Cerrar">${ic('i-x')}</button></div>${html}</div>`;
    document.body.appendChild(bg);
    const cerrar = () => bg.remove();
    bg.addEventListener('mousedown', (e) => { if (e.target === bg) cerrar(); });
    bg.querySelector('[data-x]').addEventListener('click', cerrar);
    return { el: bg, cerrar };
  }
  const msg = (el, t, tipo) => { el.textContent = t; el.className = 'msg show ' + tipo; };

  /* ---------------- Acceso ---------------- */
  const resetToken = new URLSearchParams(location.search).get('reset');
  function mostrarAcceso(cual) {
    $('#auth').hidden = false;
    ['fLogin', 'fRec', 'fReset'].forEach((id) => { $('#' + id).hidden = id !== { login: 'fLogin', rec: 'fRec', reset: 'fReset' }[cual]; });
  }
  $('#goRec').addEventListener('click', (e) => { e.preventDefault(); $('#rEmail').value = $('#lEmail').value; mostrarAcceso('rec'); });
  document.querySelectorAll('[data-volver]').forEach((a) => a.addEventListener('click', (e) => { e.preventDefault(); history.replaceState(null, '', 'portal.html'); mostrarAcceso('login'); }));

  $('#fLogin').addEventListener('submit', async (e) => {
    e.preventDefault();
    const m = $('#mLogin'), b = e.target.querySelector('button[type=submit]');
    const email = $('#lEmail').value.trim(), password = $('#lPass').value;
    if (!email || !password) return msg(m, 'Escribe tu correo y contraseña.', 'err');
    b.disabled = true;
    try {
      const r = await api('/portal/login', { method: 'POST', body: { email, password }, publico: true });
      token = r.token;
      try { ($('#lRem').checked ? localStorage : sessionStorage).setItem(CLAVE, token); } catch (_) {}
      $('#lPass').value = ''; m.className = 'msg';
      iniciarApp();
    } catch (err) { msg(m, err.message, 'err'); }
    finally { b.disabled = false; }
  });
  $('#fRec').addEventListener('submit', async (e) => {
    e.preventDefault();
    const m = $('#mRec'), email = $('#rEmail').value.trim();
    if (!email) return msg(m, 'Escribe tu correo.', 'err');
    try { const r = await api('/auth/recuperar', { method: 'POST', body: { email, tipo: 'paciente' }, publico: true }); msg(m, r.mensaje, 'ok'); }
    catch (err) { msg(m, err.message, 'err'); }
  });
  $('#fReset').addEventListener('submit', async (e) => {
    e.preventDefault();
    const m = $('#mReset'), a = $('#nPass').value, b = $('#nPass2').value;
    if (a.length < 6) return msg(m, 'La contraseña debe tener al menos 6 caracteres.', 'err');
    if (a !== b) return msg(m, 'Las contraseñas no coinciden.', 'err');
    try {
      const r = await api('/auth/restablecer', { method: 'POST', body: { token: resetToken, nueva: a }, publico: true });
      msg(m, r.mensaje, 'ok');
      history.replaceState(null, '', 'portal.html');
      setTimeout(() => mostrarAcceso('login'), 1800);
    } catch (err) { msg(m, err.message, 'err'); }
  });

  /* ---------------- Navegación ---------------- */
  const SECCIONES = [
    ['inicio', 'i-home', 'Inicio'], ['citas', 'i-cal', 'Citas'], ['mensajes', 'i-msg', 'Mensajes'],
    ['recetas', 'i-pill', 'Recetas'], ['perfil', 'i-user', 'Perfil'],
  ];
  const enlaces = SECCIONES.map(([k, i, t]) => `<a href="#/${k}" data-k="${k}">${ic(i)}<span>${t}</span>${k === 'mensajes' ? '<span class="cnt" data-cnt hidden></span>' : ''}</a>`).join('');
  $('#tabs').innerHTML = enlaces;
  $('#tnavDesk').innerHTML = enlaces;
  $('#avBtn').addEventListener('click', () => { location.hash = '#/perfil'; });

  async function contador() {
    try {
      const r = await api('/portal/resumen');
      document.querySelectorAll('[data-cnt]').forEach((c) => { c.textContent = r.mensajes_sin_leer; c.hidden = !r.mensajes_sin_leer; });
      return r;
    } catch (_) { return null; }
  }

  const VISTAS = {};
  let timerChat = null;
  async function mostrar() {
    clearInterval(timerChat);
    const [k, ...params] = (location.hash.replace(/^#\/?/, '') || 'inicio').split('/');
    const clave = VISTAS[k] ? k : 'inicio';
    document.querySelectorAll('[data-k]').forEach((a) => a.classList.toggle('on', a.dataset.k === clave));
    const v = $('#view');
    v.innerHTML = '<div class="cargando">Cargando…</div>';
    window.scrollTo(0, 0);
    try { await VISTAS[clave](v, params); } catch (e) { v.innerHTML = vacio(e.message, 'i-alert'); }
  }

  async function iniciarApp() {
    try { yo = await api('/portal/yo'); } catch (_) { return; }
    $('#auth').hidden = true;
    $('#app').hidden = false;
    $('#avBtn').textContent = (yo.nombres[0] + yo.apellidos[0]).toUpperCase();
    if (!location.hash) location.hash = '#/inicio';
    window.removeEventListener('hashchange', mostrar);
    window.addEventListener('hashchange', mostrar);
    mostrar();
    contador();
  }

  /* ---------------- Inicio ---------------- */
  VISTAS.inicio = async (v) => {
    const [r, citas] = await Promise.all([contador(), api('/portal/citas')]);
    const h = new Date().getHours();
    const saludo = h < 12 ? 'Buenos días' : h < 19 ? 'Buenas tardes' : 'Buenas noches';
    const c = r && r.proxima_cita;
    const proximas = citas.filter((x) => ['Pendiente', 'Confirmada'].includes(x.estado) && x.fecha >= hoyISO()).length;
    v.innerHTML = `
      <h1>${saludo}, ${esc(yo.nombres)}</h1>
      <p class="muted">${fechaLarga(new Date())}</p>
      ${c ? `<div class="hero">
          <div class="k">Tu próxima cita · <span class="badge" style="background:rgba(255,255,255,.22);color:#fff">${esc((ESTADO[c.estado] || [0, c.estado])[1])}</span></div>
          <div class="v">${fechaLarga(c.fecha)}, ${hora(c.hora_inicio)}</div>
          <div class="s">${esc(c.medico)}${c.motivo ? ' · ' + esc(c.motivo) : ''}</div>
          <a class="btn sm" href="#/citas">Ver mis citas ${ic('i-chev')}</a></div>`
        : `<div class="hero"><div class="k">No tienes citas próximas</div><div class="v">¿Necesitas una consulta?</div>
          <button class="btn sm" id="hSol">${ic('i-plus')}Solicitar cita</button></div>`}
      <div class="quick">
        <a href="#/citas"><div class="qi c-blue">${ic('i-cal')}</div>Citas próximas<b>${proximas}</b></a>
        <a href="#/mensajes"><div class="qi c-purple">${ic('i-msg')}</div>Mensajes nuevos<b>${r ? r.mensajes_sin_leer : 0}</b></a>
        <a href="#/recetas"><div class="qi c-green">${ic('i-pill')}</div>Recetas<b>${r ? r.recetas : 0}</b></a>
      </div>
      ${yo.alergias ? `<div class="alerta">${ic('i-alert')}<div><b>Alergias registradas:</b> ${esc(yo.alergias)}<br><span style="opacity:.8">Si algo cambió, avísale a tu médico.</span></div></div>` : ''}
      <div class="card"><div class="ch"><h2>¿Tienes una duda?</h2></div>
        <div class="cb"><p class="muted" style="margin:0 0 12px">Escríbele a la clínica. Te responderán por aquí mismo.</p>
        <a class="btn pri" href="#/mensajes">${ic('i-msg')}Enviar un mensaje</a></div></div>`;
    const hs = $('#hSol'); if (hs) hs.addEventListener('click', () => solicitarCita());
  };

  /* ---------------- Citas ---------------- */
  VISTAS.citas = async (v) => {
    const citas = await api('/portal/citas');
    let ver = 'proximas';
    const pintar = () => {
      const hoy = hoyISO();
      const lista = ver === 'proximas'
        ? citas.filter((c) => c.fecha >= hoy && !['Atendida', 'Cancelada', 'No asistio'].includes(c.estado)).reverse()
        : citas.filter((c) => c.fecha < hoy || ['Atendida', 'Cancelada', 'No asistio'].includes(c.estado));
      $('#clist').innerHTML = lista.length ? lista.map((c) => {
        const d = aFecha(c.fecha);
        const cancelable = ['Pendiente', 'Confirmada'].includes(c.estado) && aFecha(`${c.fecha} ${hora(c.hora_inicio)}`) > new Date();
        return `<div class="li"><div class="dt"><b>${d.getDate()}</b><span>${MES[d.getMonth()]}</span></div>
          <div class="tx"><b>${hora(c.hora_inicio)} · ${esc(c.medico)}</b><span>${esc(c.especialidad || c.tipo)}${c.motivo ? ' · ' + esc(c.motivo) : ''}</span>
            ${cancelable ? `<div style="margin-top:6px"><button class="btn sm dan" data-cancel="${c.id}">Cancelar</button></div>` : ''}</div>
          ${badge(c.estado)}</div>`;
      }).join('') : vacio(ver === 'proximas' ? 'No tienes citas próximas' : 'Aún no hay citas anteriores', 'i-cal');
      document.querySelectorAll('.seg button').forEach((b) => b.classList.toggle('on', b.dataset.v === ver));
    };
    v.innerHTML = `<div class="vhead"><h1>Mis citas</h1><button class="btn pri" id="sol">${ic('i-plus')}Solicitar</button></div>
      <div class="seg"><button data-v="proximas">Próximas</button><button data-v="anteriores">Anteriores</button></div>
      <div class="card"><div class="cb" id="clist"></div></div>
      <p class="muted small center">Las citas que solicitas aparecen como <b>Por confirmar</b> hasta que la clínica las confirme.</p>`;
    $('.seg').addEventListener('click', (e) => { const b = e.target.closest('button'); if (b) { ver = b.dataset.v; pintar(); } });
    $('#sol').addEventListener('click', () => solicitarCita());
    $('#clist').addEventListener('click', async (e) => {
      const b = e.target.closest('[data-cancel]'); if (!b) return;
      if (!confirm('¿Seguro que quieres cancelar esta cita?')) return;
      try { await api(`/portal/citas/${b.dataset.cancel}/cancelar`, { method: 'PATCH' }); aviso('Cita cancelada'); mostrar(); }
      catch (err) { aviso(err.message, 'bad'); }
    });
    pintar();
  };

  async function solicitarCita() {
    let medicos;
    try { medicos = await api('/portal/medicos'); } catch (e) { return aviso(e.message, 'bad'); }
    const man = new Date(); man.setDate(man.getDate() + 1);
    const minF = `${man.getFullYear()}-${String(man.getMonth() + 1).padStart(2, '0')}-${String(man.getDate()).padStart(2, '0')}`;
    const m = modal('Solicitar cita', `
      <div class="msg" id="sm"></div>
      <div class="fl"><label>Médico</label><select class="inp" id="sMed">${medicos.map((x) => `<option value="${x.id}">${esc(x.nombre)}${x.especialidad ? ' · ' + esc(x.especialidad) : ''}</option>`).join('')}</select></div>
      <div class="fl"><label>Día</label><input class="inp" type="date" id="sFecha" min="${hoyISO()}" value="${minF}"></div>
      <div class="fl"><label>Hora disponible</label><div class="slots" id="sSlots"></div></div>
      <div class="fl"><label>Motivo (opcional)</label><input class="inp" id="sMot" maxlength="200" placeholder="Ej. Control de presión"></div>
      <button class="btn pri big" id="sOk">Enviar solicitud</button>`);
    let horaSel = null;
    const cargarSlots = async () => {
      horaSel = null;
      const box = m.el.querySelector('#sSlots');
      box.innerHTML = '<span class="muted small">Buscando horarios…</span>';
      try {
        const r = await api(`/portal/disponibilidad?medico_id=${m.el.querySelector('#sMed').value}&fecha=${m.el.querySelector('#sFecha').value}`);
        box.innerHTML = r.horarios.length ? r.horarios.map((h) => `<button type="button" class="slot" data-h="${h}">${h}</button>`).join('')
          : '<span class="muted small">No hay horarios libres ese día. Prueba otro.</span>';
      } catch (e) { box.innerHTML = `<span class="muted small">${esc(e.message)}</span>`; }
    };
    m.el.querySelector('#sSlots').addEventListener('click', (e) => {
      const b = e.target.closest('.slot'); if (!b) return;
      m.el.querySelectorAll('.slot').forEach((x) => x.classList.toggle('on', x === b));
      horaSel = b.dataset.h;
      m.el.querySelector('#sm').className = 'msg';
    });
    m.el.querySelector('#sMed').addEventListener('change', cargarSlots);
    m.el.querySelector('#sFecha').addEventListener('change', cargarSlots);
    m.el.querySelector('#sOk').addEventListener('click', async (e) => {
      const sm = m.el.querySelector('#sm');
      if (!horaSel) return msg(sm, 'Elige una hora.', 'err');
      e.target.disabled = true;
      try {
        const r = await api('/portal/citas', { method: 'POST', body: { medico_id: m.el.querySelector('#sMed').value, fecha: m.el.querySelector('#sFecha').value, hora_inicio: horaSel, motivo: m.el.querySelector('#sMot').value.trim() } });
        m.cerrar(); aviso(r.mensaje);
        if (location.hash === '#/citas') mostrar(); else location.hash = '#/citas';
      } catch (err) { msg(sm, err.message, 'err'); if (err.status === 409) cargarSlots(); }
      finally { e.target.disabled = false; }
    });
    cargarSlots();
  }

  /* ---------------- Mensajes ---------------- */
  VISTAS.mensajes = async (v) => {
    v.innerHTML = `<div class="vhead"><h1>Mensajes</h1></div>
      <div class="card chat"><div class="bubs" id="bubs"><div class="cargando">Cargando…</div></div>
        <form class="compose" id="comp"><textarea class="inp" id="txt" placeholder="Escribe tu mensaje para la clínica…" maxlength="2000"></textarea>
        <button class="btn pri" type="submit" aria-label="Enviar">${ic('i-send')}</button></form></div>`;
    let ultimo = '';
    const pintar = async () => {
      let msgs;
      try { msgs = await api('/portal/mensajes'); }
      catch (e) { $('#bubs').innerHTML = vacio(e.message, 'i-msg'); return; }
      const firma = msgs.map((m) => m._id).join();
      if (firma === ultimo) return;
      ultimo = firma;
      let dia = '';
      $('#bubs').innerHTML = msgs.length ? msgs.map((m) => {
        const d = fecha(m.creado_en); const sep = d !== dia ? `<div class="dsep">${d}</div>` : ''; dia = d;
        const mio = m.autor.tipo === 'paciente';
        return `${sep}<div class="bub ${mio ? 'yo' : 'cl'}">${mio ? '' : `<div class="who">${esc(m.autor.nombre)} · Clínica</div>`}${esc(m.texto)}
          ${m.adjunto && m.adjunto.nombre ? `<div class="att">${ic('i-file')}${esc(m.adjunto.nombre)}</div>` : ''}<time>${hora(m.creado_en)}</time></div>`;
      }).join('') : vacio('Aún no hay mensajes. Escribe el primero: el personal de la clínica te responderá aquí.', 'i-msg');
      const b = $('#bubs'); b.scrollTop = b.scrollHeight;
      contador();
    };
    const txt = $('#txt');
    txt.addEventListener('keydown', (e) => { if (e.key === 'Enter' && !e.shiftKey && window.innerWidth > 860) { e.preventDefault(); $('#comp').requestSubmit(); } });
    $('#comp').addEventListener('submit', async (e) => {
      e.preventDefault();
      const t = txt.value.trim(); if (!t) return;
      txt.disabled = true;
      try { await api('/portal/mensajes', { method: 'POST', body: { texto: t } }); txt.value = ''; await pintar(); }
      catch (err) { aviso(err.message, 'bad'); }
      finally { txt.disabled = false; txt.focus(); }
    });
    await pintar();
    timerChat = setInterval(() => { if (!txt.value) pintar(); }, 15000);
  };

  /* ---------------- Recetas ---------------- */
  VISTAS.recetas = async (v) => {
    const recetas = await api('/portal/recetas');
    v.innerHTML = `<div class="vhead"><h1>Mis recetas</h1></div>` + (recetas.length ? recetas.map((r) => `
      <div class="card"><div class="ch"><h2>${fecha(r.fecha)}</h2><button class="btn sm" data-print="${r.id}">${ic('i-print')}Imprimir</button></div>
        <div class="cb"><p class="muted small" style="margin:0 0 6px">${esc(r.medico)}</p>
          ${r.items.map((i) => `<div class="med"><b>${esc(i.medicamento)}</b>${i.dosis ? ' · ' + esc(i.dosis) : ''}
            <div>${esc([i.frecuencia, i.duracion && 'durante ' + i.duracion].filter(Boolean).join(', '))}</div>${i.indicaciones ? `<div><i>${esc(i.indicaciones)}</i></div>` : ''}</div>`).join('')}
          ${r.notas ? `<p class="muted small" style="margin:8px 0 0"><b>Notas:</b> ${esc(r.notas)}</p>` : ''}</div></div>`).join('')
      : `<div class="card">${vacio('Aún no tienes recetas', 'i-pill')}</div>`);
    v.addEventListener('click', (e) => { const b = e.target.closest('[data-print]'); if (b) imprimir(b.dataset.print); });
  };

  async function imprimir(id) {
    const w = window.open('', '_blank');
    if (!w) return aviso('Permite las ventanas emergentes para imprimir', 'bad');
    w.document.write('<p style="font-family:sans-serif;padding:20px">Cargando receta…</p>');
    try {
      const r = await api('/portal/recetas/' + id);
      const logo = new URL('img/logo-clinnova.png', location.href).href;
      w.document.open();
      w.document.write(`<!doctype html><html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Receta · ${esc(r.paciente)}</title>
        <style>body{font-family:Inter,Arial,sans-serif;color:#17212c;margin:0;padding:28px 32px;font-size:14px}.top{display:flex;align-items:center;border-bottom:3px solid #0f72b8;padding-bottom:12px;gap:12px;flex-wrap:wrap}
        .top img{height:48px}.dr{margin-left:auto;text-align:right}.dr b{display:block;font-size:15px}.dr span{display:block;color:#5a6b7d;font-size:12.5px}
        .pac{background:#f4f9fd;border-radius:10px;padding:12px 14px;margin:16px 0;line-height:1.6}.rx{font-size:32px;font-weight:800;color:#0f72b8;font-family:Georgia,serif}
        .it{padding:10px 0;border-bottom:1px solid #e4ecf4}.it b{font-size:15px}.d{color:#3b4a5a}.firma{margin-top:60px;text-align:right}.firma div{display:inline-block;border-top:1px solid #17212c;padding-top:6px;width:240px;text-align:center;font-size:12.5px}
        .noprint{position:fixed;bottom:16px;right:16px;background:#0f72b8;color:#fff;border:0;border-radius:10px;padding:11px 16px;font-size:14px;font-weight:600}@media print{.noprint{display:none}}</style></head><body>
        <button class="noprint" onclick="window.print()">Imprimir / Guardar PDF</button>
        <div class="top"><img src="${logo}" alt="Clinnova"><div class="dr"><b>Dr. ${esc(r.medico)}</b><span>${esc(r.especialidad || '')}</span>${r.colegiatura ? `<span>Colegiación ${esc(r.colegiatura)}</span>` : ''}<span>${esc(r.clinica || '')}</span></div></div>
        <div class="pac"><b>${esc(r.paciente)}</b> · ${r.edad != null ? r.edad + ' años' : ''} · ${esc(r.expediente_no || '')}<br>Fecha: ${fecha(r.fecha)}<br>Alergias: <b style="color:${r.alergias ? '#a8322b' : 'inherit'}">${esc(r.alergias || 'Ninguna conocida')}</b></div>
        <div class="rx">Rx</div>${r.items.map((i, n) => `<div class="it"><b>${n + 1}. ${esc(i.medicamento)}</b>${i.dosis ? ' — ' + esc(i.dosis) : ''}<div class="d">${esc([i.frecuencia, i.duracion && 'durante ' + i.duracion].filter(Boolean).join(', '))}</div>${i.indicaciones ? `<div class="d"><i>${esc(i.indicaciones)}</i></div>` : ''}</div>`).join('')}
        ${r.notas ? `<p><b>Notas:</b> ${esc(r.notas)}</p>` : ''}<div class="firma"><div>Firma y sello<br><b>Dr. ${esc(r.medico)}</b></div></div></body></html>`);
      w.document.close();
    } catch (e) { w.close(); aviso(e.message, 'bad'); }
  }

  /* ---------------- Perfil ---------------- */
  VISTAS.perfil = async (v) => {
    yo = await api('/portal/yo');
    const consultas = await api('/portal/consultas').catch(() => []);
    const SEXO = { M: 'Masculino', F: 'Femenino', O: 'Otro' };
    v.innerHTML = `
      <div class="card"><div class="ptop"><div class="pav">${esc((yo.nombres[0] + yo.apellidos[0]).toUpperCase())}</div>
        <div><h2>${esc(yo.nombres + ' ' + yo.apellidos)}</h2><div class="muted small" style="margin:2px 0 0">${esc(yo.expediente_no || '')} · ${esc(yo.email || '')}</div></div></div>
        <div class="kv">
          <div><span>Edad</span><b>${yo.edad != null ? yo.edad + ' años' : '—'}</b></div>
          <div><span>Sexo</span><b>${SEXO[yo.sexo] || '—'}</b></div>
          <div><span>Tipo de sangre</span><b>${esc(yo.tipo_sangre || '—')}</b></div>
          <div><span>Teléfono</span><b>${esc(yo.telefono || '—')}</b></div>
          <div style="grid-column:1/-1"><span>Dirección</span><b>${esc(yo.direccion || '—')}</b></div>
          <div style="grid-column:1/-1"><span>Contacto de emergencia</span><b>${esc(yo.contacto_emerg_nombre || '—')}${yo.contacto_emerg_telefono ? ' · ' + esc(yo.contacto_emerg_telefono) : ''}</b></div>
          <div style="grid-column:1/-1"><span>Alergias</span><b style="color:${yo.alergias ? 'var(--crit)' : 'inherit'}">${esc(yo.alergias || 'Ninguna registrada')}</b></div>
        </div>
        <div class="cb" style="display:flex;gap:8px;flex-wrap:wrap;padding-top:14px">
          <button class="btn" id="pEdit">Editar mis datos</button><button class="btn" id="pPass">${ic('i-lock')}Cambiar contraseña</button>
          <button class="btn dan" id="pSalir" style="margin-left:auto">${ic('i-logout')}Cerrar sesión</button></div></div>
      <div class="card"><div class="ch"><h2>Mis consultas</h2></div><div class="cb">
        ${consultas.length ? consultas.map((c) => `<div class="li"><div class="tx"><b>${esc(c.diagnostico || c.motivo || 'Consulta')}</b>
          <span>${fecha(c.fecha)} · ${esc(c.medico)}</span>${c.indicaciones ? `<div class="muted small" style="margin:4px 0 0"><b>Indicaciones:</b> ${esc(c.indicaciones)}</div>` : ''}</div></div>`).join('') : vacio('Aún no hay consultas', 'i-steth')}
      </div></div>
      <p class="muted small center">Tus alergias y antecedentes los actualiza tu médico. Si algo no es correcto, escríbele por Mensajes.</p>`;
    $('#pSalir').addEventListener('click', salir);
    $('#pEdit').addEventListener('click', () => {
      const m = modal('Editar mis datos', `<div class="msg" id="em"></div>
        <div class="fl"><label>Teléfono</label><input class="inp" id="eTel" value="${esc(yo.telefono || '')}"></div>
        <div class="fl"><label>Dirección</label><input class="inp" id="eDir" value="${esc(yo.direccion || '')}"></div>
        <div class="fl"><label>Contacto de emergencia</label><input class="inp" id="eCn" value="${esc(yo.contacto_emerg_nombre || '')}"></div>
        <div class="fl"><label>Teléfono de emergencia</label><input class="inp" id="eCt" value="${esc(yo.contacto_emerg_telefono || '')}"></div>
        <button class="btn pri big" id="eOk">Guardar</button>`);
      m.el.querySelector('#eOk').addEventListener('click', async () => {
        try {
          await api('/portal/yo', { method: 'PUT', body: { telefono: m.el.querySelector('#eTel').value.trim(), direccion: m.el.querySelector('#eDir').value.trim(), contacto_emerg_nombre: m.el.querySelector('#eCn').value.trim(), contacto_emerg_telefono: m.el.querySelector('#eCt').value.trim() } });
          m.cerrar(); aviso('Datos actualizados'); mostrar();
        } catch (e) { msg(m.el.querySelector('#em'), e.message, 'err'); }
      });
    });
    $('#pPass').addEventListener('click', () => {
      const m = modal('Cambiar contraseña', `<div class="msg" id="pm"></div>
        <div class="fl"><label>Contraseña actual</label><input class="inp" type="password" id="pA"></div>
        <div class="fl"><label>Nueva contraseña</label><input class="inp" type="password" id="pN"></div>
        <div class="fl"><label>Repite la nueva</label><input class="inp" type="password" id="pN2"></div>
        <button class="btn pri big" id="pOk">Cambiar</button>`);
      m.el.querySelector('#pOk').addEventListener('click', async () => {
        const a = m.el.querySelector('#pA').value, n = m.el.querySelector('#pN').value, n2 = m.el.querySelector('#pN2').value;
        const pm = m.el.querySelector('#pm');
        if (n !== n2) return msg(pm, 'Las contraseñas nuevas no coinciden.', 'err');
        try { await api('/portal/password', { method: 'PATCH', body: { actual: a, nueva: n } }); m.cerrar(); aviso('Contraseña actualizada'); }
        catch (e) { msg(pm, e.message, 'err'); }
      });
    });
  };

  /* ---------------- Arranque ---------------- */
  if (resetToken) mostrarAcceso('reset');
  else if (token) iniciarApp().then(() => { if (!yo) mostrarAcceso('login'); });
  else mostrarAcceso('login');
})();
