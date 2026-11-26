/* Mensajes: conversaciones con pacientes (MongoDB) */
C.vista('mensajes', {
  titulo: 'Mensajes',
  async render(el, params) {
    const { api, esc, icono, avatar, vacio, hace, hora, fecha } = C;
    let actual = params[0] ? Number(params[0]) : null;
    let convs = [];

    el.innerHTML = `
      <div class="vhead"><div><h1>Mensajes</h1><p>Conversaciones con pacientes</p></div>
        <div class="acts"><button class="btn pri" id="nuevaM">${icono('i-plus')}Nueva conversación</button></div></div>
      <div class="card chat">
        <div class="convs" id="convs">${C.cargando()}</div>
        <div class="thread" id="thread">${vacio('Elige una conversación', 'O empieza una nueva con un paciente.', 'i-msg')}</div>
      </div>`;

    async function cargarConvs() {
      try { convs = await api('/mensajes'); }
      catch (e) {
        el.querySelector('.chat').outerHTML = `<div class="card">${vacio('Mensajes no disponibles', e.status === 503 ? 'MongoDB no está corriendo. Inícialo y recarga la página.' : e.message, 'i-msg')}</div>`;
        return false;
      }
      C.$('#convs').innerHTML = convs.length ? convs.map((c) => `
        <div class="conv ${c.paciente_id === actual ? 'on' : ''}" data-p="${c.paciente_id}">
          ${avatar(c.paciente)}
          <div class="t"><div class="r"><b>${esc(c.paciente)}</b><time>${hace(c.ultima_fecha)}</time></div>
            <p>${c.ultimo_autor === 'usuario' ? 'Tú: ' : ''}${esc(c.ultimo_texto)}</p></div>
          ${c.no_leidos ? `<span class="cnt">${c.no_leidos}</span>` : ''}
        </div>`).join('') : vacio('Sin conversaciones', '', 'i-msg');
      return true;
    }

    async function abrir(pid) {
      actual = Number(pid);
      history.replaceState(null, '', '#/mensajes/' + actual);
      C.$$('.conv').forEach((c) => c.classList.toggle('on', Number(c.dataset.p) === actual));
      const [p, msgs] = await Promise.all([api('/pacientes/' + actual), api(`/mensajes/paciente/${actual}`)]);
      const nombre = p.nombres + ' ' + p.apellidos;
      let ultimoDia = '';
      const burbujas = msgs.map((m) => {
        const dia = fecha(m.creado_en);
        const sep = dia !== ultimoDia ? `<div class="daysep">${dia}</div>` : '';
        ultimoDia = dia;
        const mio = m.autor.tipo === 'usuario';
        const puedoBorrar = (mio && m.autor.id === C.yo.id) || C.permisos.admin();
        const visto = mio && p.portal_activo && m.leido_paciente ? ' · Visto' : '';
        return `${sep}<div class="bub ${mio ? 'out' : 'in'}" ${puedoBorrar ? `data-m="${m._id}" title="Doble clic para borrar"` : ''}>
          ${mio ? `<div class="who">${esc(m.autor.nombre)}</div>` : ''}${esc(m.texto)}
          ${m.adjunto && m.adjunto.nombre ? `<div class="att">${icono('i-file')}${esc(m.adjunto.nombre)}${m.adjunto.tamano_kb ? ` · ${m.adjunto.tamano_kb} KB` : ''}</div>` : ''}
          <time>${hora(m.creado_en)}${m.area ? ' · ' + esc(m.area) : ''}${visto}</time></div>`;
      }).join('');
      C.$('#thread').innerHTML = `
        <div class="thead">${avatar(nombre)}<div><b>${esc(nombre)}</b><span class="sub">${esc(p.expediente_no || '')} · ${esc(p.telefono || 'sin teléfono')}</span></div>
          <div class="acts">
            <button class="btn sm" id="entrante" title="Registrar un mensaje que el paciente envió por teléfono, WhatsApp o en persona">${icono('i-swap')}Registrar mensaje del paciente</button>
            <a class="ibtn" href="#/expediente/${p.id}" title="Expediente">${icono('i-file')}</a>
          </div></div>
        <div class="sub" style="padding:7px 16px;border-bottom:1px solid var(--line);background:${p.portal_activo ? 'var(--good-soft)' : 'var(--warn-soft)'}">
          ${p.portal_activo ? `${icono('i-check', 'style="width:14px;height:14px;vertical-align:-2px"')} ${esc(p.nombres)} tiene portal: verá tus respuestas y puede escribir desde ahí.`
            : `${esc(p.nombres)} no tiene acceso al portal, así que no verá estos mensajes. <a href="#/expediente/${p.id}">Darle acceso</a>`}</div>
        <div class="bubbles" id="bubs">${burbujas || vacio('Sin mensajes todavía', 'Escribe el primero abajo.', 'i-msg')}</div>
        <form class="compose" id="compose">
          <textarea class="inp" id="texto" placeholder="Escribe un mensaje para ${esc(p.nombres)}… (Enter para enviar, Shift+Enter para salto de línea)" maxlength="2000"></textarea>
          <button class="btn pri" type="submit">${icono('i-send')}Enviar</button>
        </form>`;
      const b = C.$('#bubs'); b.scrollTop = b.scrollHeight;

      // Marca como leídos los mensajes del paciente
      const conv = convs.find((c) => c.paciente_id === actual);
      if (conv && conv.no_leidos) {
        await api(`/mensajes/paciente/${actual}/leidos`, { method: 'PATCH' }).catch(() => {});
        conv.no_leidos = 0;
        const cnt = C.$(`.conv[data-p="${actual}"] .cnt`); if (cnt) cnt.remove();
        C.contadores();
      }

      const ta = C.$('#texto');
      ta.focus();
      ta.addEventListener('keydown', (e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); C.$('#compose').requestSubmit(); } });
      C.$('#compose').addEventListener('submit', async (e) => {
        e.preventDefault();
        const texto = ta.value.trim(); if (!texto) return;
        ta.disabled = true;
        try { await api('/mensajes', { method: 'POST', body: { paciente_id: actual, texto } }); ta.value = ''; await cargarConvs(); await abrir(actual); }
        catch (err) { C.fallo(err); }
        finally { ta.disabled = false; }
      });
      C.$('#entrante').addEventListener('click', () => C.formulario({
        titulo: 'Mensaje recibido de ' + nombre,
        campos: [
          { n: 'texto', l: '¿Qué escribió el paciente?', t: 'textarea', req: true },
          { n: 'area', l: 'Área', t: 'select', ops: ['Clinica', 'Administrativa', 'Laboratorio', 'Recepcion'].map((a) => [a, a.replace('Clinica', 'Clínica').replace('Recepcion', 'Recepción')]) },
        ],
        textoBoton: 'Registrar',
        async guardar(d) { await api('/mensajes/entrante', { method: 'POST', body: { ...d, paciente_id: actual } }); C.aviso('Mensaje registrado; se avisó al personal'); await cargarConvs(); await abrir(actual); C.contadores(); },
      }));
      b.addEventListener('dblclick', async (e) => {
        const m = e.target.closest('[data-m]'); if (!m) return;
        if (!(await C.confirmar('¿Borrar este mensaje?', { si: 'Borrar', peligro: true }))) return;
        try { await api('/mensajes/' + m.dataset.m, { method: 'DELETE' }); await cargarConvs(); await abrir(actual); } catch (err) { C.fallo(err); }
      });
    }

    C.$('#convs').addEventListener('click', (e) => { const c = e.target.closest('.conv'); if (c) abrir(c.dataset.p).catch(C.fallo); });
    C.$('#nuevaM').addEventListener('click', () => {
      const m = C.modal({ titulo: 'Nueva conversación', tam: 'sm', cuerpo: `<div class="form">${C.buscaPacienteHTML()}</div>` });
      C.montarBuscaPaciente(m.el);
      m.el.querySelector('input[type=hidden]').addEventListener('change', (e) => { m.cerrar(); abrir(e.target.value).catch(C.fallo); });
    });

    if (!(await cargarConvs())) return;
    if (actual) await abrir(actual);

    // Revisa mensajes nuevos cada 20 s mientras esta sección esté abierta
    const timer = setInterval(async () => {
      if (!location.hash.startsWith('#/mensajes')) return clearInterval(timer);
      const antes = JSON.stringify(convs.map((c) => [c.paciente_id, c.ultima_fecha]));
      await cargarConvs();
      if (JSON.stringify(convs.map((c) => [c.paciente_id, c.ultima_fecha])) !== antes && actual && !C.$('#texto')?.value) abrir(actual).catch(() => {});
    }, 20000);
  },
});
