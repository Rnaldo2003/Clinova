/* Agenda: citas por día, cambiar estado, crear, reprogramar y cancelar */

// Formulario de cita (nueva o editar). paciente = {id, nombre} opcional
C.formCita = async function ({ cita, paciente, fecha, alGuardar } = {}) {
  const cat = await C.catalogos();
  const nueva = !cita;
  const c = cita || {};
  const medicoDefecto = c.medico_id || (C.yo.rol === 'medico' ? C.yo.id : cat.medicos[0] && cat.medicos[0].id);
  C.formulario({
    titulo: nueva ? 'Nueva cita' : 'Editar / reprogramar cita',
    valores: {
      ...c,
      medico_id: medicoDefecto,
      fecha: c.fecha || fecha || C.hoyISO(),
      hora_inicio: c.hora_inicio ? String(c.hora_inicio).slice(0, 5) : '',
      hora_fin: c.hora_fin ? String(c.hora_fin).slice(0, 5) : '',
    },
    campos: [
      { n: 'medico_id', l: 'Médico', t: 'select', req: true, ops: cat.medicos.map((m) => [m.id, m.nombre + (m.especialidad ? ' · ' + m.especialidad : '')]) },
      { n: 'tipo', l: 'Tipo de cita', t: 'select', ops: cat.tipos_cita },
      { n: 'fecha', l: 'Fecha', t: 'date', req: true },
      { n: 'hora_inicio', l: 'Hora', t: 'time', req: true, step: 300 },
      { n: 'servicio_id', l: 'Servicio', t: 'select', vacio: 'Sin servicio', ops: cat.servicios.map((s) => [s.id, `${s.nombre} (${s.duracion_min} min)`]) },
      { n: 'hora_fin', l: 'Hora de fin', t: 'time', step: 300, hint: 'Opcional' },
      { n: 'motivo', l: 'Motivo', full: true, ph: 'Ej. Control de presión' },
      { n: 'notas', l: 'Notas internas', t: 'textarea' },
    ],
    textoBoton: nueva ? 'Agendar cita' : 'Guardar cambios',
    alAbrir(m) {
      // Se inserta el buscador de paciente como primer campo
      const form = m.el.querySelector('form');
      form.insertAdjacentHTML('afterbegin', C.buscaPacienteHTML());
      C.montarBuscaPaciente(form, nueva ? paciente : { id: c.paciente_id, nombre: c.paciente });
      // Al elegir servicio, calcula la hora de fin
      const serv = form.querySelector('[name=servicio_id]'), ini = form.querySelector('[name=hora_inicio]'), fin = form.querySelector('[name=hora_fin]');
      const calc = () => {
        const s = cat.servicios.find((x) => String(x.id) === serv.value);
        if (!s || !ini.value) return;
        const [h, mi] = ini.value.split(':').map(Number);
        const t = h * 60 + mi + s.duracion_min;
        fin.value = `${String(Math.floor(t / 60) % 24).padStart(2, '0')}:${String(t % 60).padStart(2, '0')}`;
      };
      serv.addEventListener('change', calc); ini.addEventListener('change', calc);
    },
    async guardar(d) {
      if (!d.paciente_id) throw new Error('Elige un paciente de la lista');
      if (d.hora_fin && d.hora_fin <= d.hora_inicio) throw new Error('La hora de fin debe ser después de la hora de inicio');
      if (nueva) await C.api('/citas', { method: 'POST', body: d });
      else await C.api('/citas/' + c.id, { method: 'PUT', body: d });
      C.aviso(nueva ? 'Cita agendada' : 'Cita actualizada');
      if (alGuardar) alGuardar(d.fecha);
    },
  });
};

C.cambiarEstadoCita = async function (id, estado) {
  await C.api(`/citas/${id}/estado`, { method: 'PATCH', body: { estado } });
  C.aviso(`Cita marcada como "${C.estadoTexto(estado)}"`);
  C.contadores();
};

C.vista('agenda', {
  titulo: 'Agenda',
  async render(el, params) {
    const { api, esc, icono, avatar, hora, vacio, ESTADO_CLASE, estadoTexto } = C;
    const cat = await C.catalogos();
    // Rutas: #/agenda  ·  #/agenda/2026-11-23  ·  #/agenda/nueva/<pacienteId>
    let dia = /^\d{4}-\d{2}-\d{2}$/.test(params[0] || '') ? params[0] : C.hoyISO();
    let filtro = '';
    const verTodos = C.permisos.admin() || C.yo.rol !== 'medico';
    let medico = C.yo.rol === 'medico' ? String(C.yo.id) : '';

    el.innerHTML = `
      <div class="vhead"><div><h1>Agenda</h1><p id="adia"></p></div>
        <div class="acts"><button class="btn pri" id="nuevaC">${icono('i-plus')}Nueva cita</button></div></div>
      <div class="card">
        <div class="toolbar">
          <div class="daynav">
            <button class="ibtn" id="prev" title="Día anterior">${icono('i-left')}</button>
            <input class="inp" type="date" id="fdia" value="${dia}">
            <button class="ibtn" id="next" title="Día siguiente">${icono('i-chev')}</button>
            <button class="btn sm" id="hoy">Hoy</button>
          </div>
          <select class="inp" id="fmed" style="width:auto">
            <option value="">Todos los médicos</option>
            ${cat.medicos.map((m) => `<option value="${m.id}" ${String(m.id) === medico ? 'selected' : ''}>${esc(m.nombre)}</option>`).join('')}
          </select>
          <div class="chips" id="chips">
            <button class="chip on" data-e="">Todas</button>
            ${['Pendiente', 'Confirmada', 'En espera', 'En consulta', 'Atendida', 'Cancelada'].map((e) => `<button class="chip" data-e="${e}">${e}</button>`).join('')}
          </div>
        </div>
        <div class="tbl-wrap" id="alist">${C.cargando()}</div>
      </div>`;
    if (!verTodos) C.$('#fmed').value = medico;

    const COLOR_SEL = { 'b-grey': ['var(--neutral-soft)', 'var(--ink-2)'], 'b-blue': ['var(--info-soft)', 'var(--info)'], 'b-amber': ['var(--warn-soft)', 'var(--warn)'], 'b-purple': ['var(--purple-soft)', 'var(--purple)'], 'b-green': ['var(--good-soft)', 'var(--good)'], 'b-red': ['var(--crit-soft)', 'var(--crit)'] };
    const selEstado = (c) => {
      const [bg, fg] = COLOR_SEL[ESTADO_CLASE[c.estado]] || COLOR_SEL['b-grey'];
      return `<select class="estado-sel" data-estado="${c.id}" style="background:${bg};color:${fg}" title="Cambiar estado">
        ${cat.estados_cita.map((e) => `<option value="${e}" ${e === c.estado ? 'selected' : ''}>${estadoTexto(e)}</option>`).join('')}</select>`;
    };

    async function cargar() {
      C.$('#adia').textContent = C.fechaLarga(dia);
      C.$('#fdia').value = dia;
      const qs = new URLSearchParams({ fecha: dia });
      if (filtro) qs.set('estado', filtro);
      if (C.$('#fmed').value) qs.set('medico_id', C.$('#fmed').value);
      const citas = await api('/citas?' + qs);
      C.$('#alist').innerHTML = citas.length ? `<table class="tbl"><thead><tr>
        <th>Hora</th><th>Paciente</th><th>Tipo</th><th>Médico</th><th>Estado</th><th></th></tr></thead><tbody>
        ${citas.map((c) => `<tr>
          <td style="font-weight:700;font-variant-numeric:tabular-nums">${hora(c.hora_inicio)}${c.hora_fin ? `<div class="sub">a ${hora(c.hora_fin)}</div>` : ''}</td>
          <td><a class="who" href="#/expediente/${c.paciente_id}" style="text-decoration:none;color:inherit">${avatar(c.paciente)}<div><b>${esc(c.paciente)}</b><span>${esc(c.expediente_no || '')} · ${c.edad ?? '—'} años</span></div></a></td>
          <td>${esc(c.tipo)}${c.motivo ? `<div class="sub">${esc(c.motivo)}</div>` : ''}</td>
          <td class="sub">${esc(c.medico)}</td>
          <td>${selEstado(c)}</td>
          <td class="acts">
            ${C.permisos.signos() && !['Atendida', 'Cancelada', 'No asistio'].includes(c.estado) ? `<button class="ibtn" title="Signos vitales" data-signos="${c.id}" data-p="${c.paciente_id}" data-n="${esc(c.paciente)}">${icono('i-heart')}</button>` : ''}
            ${C.permisos.clinico() && !['Atendida', 'Cancelada', 'No asistio'].includes(c.estado) ? `<a class="btn sm pri" href="#/consultas/nueva/${c.paciente_id}/${c.id}">${icono('i-steth')}Atender</a>` : ''}
            <button class="ibtn" title="Editar / reprogramar" data-edit="${c.id}">${icono('i-edit')}</button>
            ${!['Cancelada', 'Atendida'].includes(c.estado) ? `<button class="ibtn dan" title="Cancelar cita" data-cancel="${c.id}" data-n="${esc(c.paciente)}">${icono('i-x')}</button>` : ''}
          </td></tr>`).join('')}</tbody></table>`
        : vacio(filtro ? `No hay citas "${filtro}" este día` : 'No hay citas este día', 'Usa "Nueva cita" para agendar una.', 'i-cal');
    }
    const recargar = () => cargar().catch(C.fallo);
    const mover = (n) => { const d = C.aFecha(dia); d.setDate(d.getDate() + n); dia = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; history.replaceState(null, '', '#/agenda/' + dia); recargar(); };

    C.$('#prev').onclick = () => mover(-1);
    C.$('#next').onclick = () => mover(1);
    C.$('#hoy').onclick = () => { dia = C.hoyISO(); history.replaceState(null, '', '#/agenda'); recargar(); };
    C.$('#fdia').onchange = (e) => { if (e.target.value) { dia = e.target.value; history.replaceState(null, '', '#/agenda/' + dia); recargar(); } };
    C.$('#fmed').onchange = recargar;
    C.$('#chips').onclick = (e) => {
      const b = e.target.closest('.chip'); if (!b) return;
      C.$$('#chips .chip').forEach((x) => x.classList.toggle('on', x === b));
      filtro = b.dataset.e; recargar();
    };
    C.$('#nuevaC').onclick = () => C.formCita({ fecha: dia, alGuardar: (f) => { dia = f; recargar(); } });

    C.$('#alist').addEventListener('change', async (e) => {
      const s = e.target.closest('[data-estado]'); if (!s) return;
      try { await C.cambiarEstadoCita(s.dataset.estado, s.value); } catch (err) { C.fallo(err); }
      recargar();
    });
    C.$('#alist').addEventListener('click', async (e) => {
      const ed = e.target.closest('[data-edit]'), ca = e.target.closest('[data-cancel]'), sv = e.target.closest('[data-signos]');
      if (ed) {
        const c = await api('/citas/' + ed.dataset.edit).catch(C.fallo);
        if (c) C.formCita({ cita: c, alGuardar: (f) => { dia = f; recargar(); } });
      } else if (ca) {
        if (!(await C.confirmar(`¿Cancelar la cita de ${ca.dataset.n}?`, { si: 'Cancelar cita', peligro: true }))) return;
        try { await C.cambiarEstadoCita(ca.dataset.cancel, 'Cancelada'); } catch (err) { C.fallo(err); }
        recargar();
      } else if (sv) {
        C.formSignos({ pacienteId: sv.dataset.p, citaId: sv.dataset.signos, nombre: sv.dataset.n, alGuardar: recargar });
      }
    });

    await cargar();

    // #/agenda/nueva/<pacienteId>: abre el formulario con el paciente ya elegido
    if (params[0] === 'nueva' && params[1]) {
      history.replaceState(null, '', '#/agenda');
      const p = await api('/pacientes/' + params[1]).catch(() => null);
      C.formCita({ paciente: p && { id: p.id, nombre: p.nombres + ' ' + p.apellidos }, alGuardar: (f) => { dia = f; recargar(); } });
    }
  },
});
