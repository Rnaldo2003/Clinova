/* Consultas: lista, nueva consulta (con receta opcional), ver y editar */

// Editor de medicamentos de una receta (lo usan Consultas y Recetas)
C.editorItems = function (box, iniciales = []) {
  const { esc, icono } = C;
  const fila = (i = {}) => `<div class="item">
      <input class="inp" data-k="medicamento" placeholder="Medicamento *" value="${esc(i.medicamento || '')}">
      <input class="inp" data-k="dosis" placeholder="Dosis (500 mg)" value="${esc(i.dosis || '')}">
      <input class="inp" data-k="frecuencia" placeholder="Frecuencia (cada 8 h)" value="${esc(i.frecuencia || '')}">
      <input class="inp" data-k="duracion" placeholder="Duración (7 días)" value="${esc(i.duracion || '')}">
      <button type="button" class="ibtn dan" data-quitar title="Quitar">${icono('i-trash')}</button>
      <input class="inp" data-k="indicaciones" placeholder="Indicaciones (opcional): con comida, en ayunas…" value="${esc(i.indicaciones || '')}" style="grid-column:1/-2">
    </div>`;
  box.innerHTML = `<div class="items"></div><button type="button" class="btn sm" data-agregar style="margin-top:10px">${icono('i-plus')}Agregar medicamento</button>`;
  const lista = box.querySelector('.items');
  const agregar = (i) => lista.insertAdjacentHTML('beforeend', fila(i));
  (iniciales.length ? iniciales : [{}]).forEach(agregar);
  box.querySelector('[data-agregar]').addEventListener('click', () => { agregar(); lista.lastElementChild.querySelector('input').focus(); });
  lista.addEventListener('click', (e) => { const q = e.target.closest('[data-quitar]'); if (q) q.closest('.item').remove(); });
  return () => [...lista.querySelectorAll('.item')].map((it) => {
    const o = {};
    it.querySelectorAll('[data-k]').forEach((inp) => { o[inp.dataset.k] = inp.value.trim() || null; });
    return o;
  }).filter((o) => o.medicamento);
};

C.vista('consultas', {
  titulo: 'Consultas',
  async render(el, params) {
    if (params[0] === 'nueva') return this.nueva(el, params[1], params[2]);
    if (params[0] === 'ver' && params[1]) return this.ver(el, params[1]);
    return this.lista(el);
  },

  async lista(el) {
    const { api, esc, icono, avatar, vacio, fechaHora, hoyISO } = C;
    const hace30 = new Date(); hace30.setDate(hace30.getDate() - 90);
    const desdeDef = `${hace30.getFullYear()}-${String(hace30.getMonth() + 1).padStart(2, '0')}-${String(hace30.getDate()).padStart(2, '0')}`;
    el.innerHTML = `
      <div class="vhead"><div><h1>Consultas</h1><p id="ccount">Historial de consultas médicas</p></div>
        <div class="acts">${C.permisos.clinico() ? `<button class="btn pri" id="nuevaK">${icono('i-plus')}Nueva consulta</button>` : ''}</div></div>
      <div class="card">
        <div class="toolbar">
          <div class="sbox grow">${icono('i-search')}<input class="inp" id="kq" placeholder="Buscar por paciente, diagnóstico o código CIE-10"></div>
          <label class="sub">Desde <input class="inp" type="date" id="kd" value="${desdeDef}" style="width:auto"></label>
          <label class="sub">Hasta <input class="inp" type="date" id="kh" value="${hoyISO()}" style="width:auto"></label>
          ${C.yo.rol === 'medico' ? '<label class="sub" style="display:flex;gap:6px;align-items:center"><input type="checkbox" id="kmias" checked> Solo mis consultas</label>' : ''}
        </div>
        <div class="tbl-wrap" id="klist">${C.cargando()}</div>
      </div>`;

    async function cargar() {
      const qs = new URLSearchParams();
      const q = C.$('#kq').value.trim(); if (q) qs.set('q', q);
      if (C.$('#kd').value) qs.set('desde', C.$('#kd').value);
      if (C.$('#kh').value) qs.set('hasta', C.$('#kh').value);
      const mias = C.$('#kmias'); if (mias && mias.checked) qs.set('medico_id', C.yo.id);
      const l = await api('/consultas?' + qs);
      C.$('#ccount').textContent = `${l.length} consulta${l.length === 1 ? '' : 's'} en el período`;
      C.$('#klist').innerHTML = l.length ? `<table class="tbl"><thead><tr><th>Fecha</th><th>Paciente</th><th>Motivo</th><th>Diagnóstico</th><th>Médico</th><th></th></tr></thead><tbody>
        ${l.map((k) => `<tr class="click" data-id="${k.id}">
          <td style="white-space:nowrap">${fechaHora(k.fecha)}</td>
          <td><div class="who">${avatar(k.paciente)}<div><b>${esc(k.paciente)}</b><span>${esc(k.expediente_no || '')}</span></div></div></td>
          <td>${esc(k.motivo || '—')}</td>
          <td>${esc(k.diagnostico || '—')}${k.cie10 ? ` <span class="tag b-blue">${esc(k.cie10)}</span>` : ''}</td>
          <td class="sub">${esc(k.medico)}</td>
          <td class="acts">${k.recetas ? `<span class="tag b-purple">${icono('i-pill', 'style="width:12px;height:12px;vertical-align:-2px"')} ${k.recetas}</span>` : ''}${icono('i-chev', 'style="color:var(--ink-3)"')}</td>
        </tr>`).join('')}</tbody></table>` : vacio('No hay consultas', 'Cambia el rango de fechas o la búsqueda.', 'i-steth');
    }
    let t;
    const rec = () => cargar().catch(C.fallo);
    C.$('#kq').addEventListener('input', () => { clearTimeout(t); t = setTimeout(rec, 250); });
    ['#kd', '#kh', '#kmias'].forEach((s) => { const e = C.$(s); if (e) e.addEventListener('change', rec); });
    C.$('#klist').addEventListener('click', (e) => { const tr = e.target.closest('tr[data-id]'); if (tr) C.ir('consultas/ver/' + tr.dataset.id); });
    const nk = C.$('#nuevaK');
    if (nk) nk.addEventListener('click', () => C.ir('consultas/nueva'));
    await cargar();
  },

  // Página para atender: datos del paciente + formulario de consulta + receta opcional
  async nueva(el, pacienteId, citaId) {
    const { api, esc, icono, avatar, fecha } = C;
    if (!C.permisos.clinico()) { el.innerHTML = C.vacio('Solo médicos y administradores pueden registrar consultas', '', 'i-lock'); return; }

    // Sin paciente: primero elegirlo
    if (!pacienteId) {
      el.innerHTML = `<div class="vhead"><div><h1>Nueva consulta</h1><p>Elige el paciente que vas a atender.</p></div></div>
        <div class="card"><div class="cb" style="padding:18px"><div class="form">${C.buscaPacienteHTML()}</div></div></div>`;
      C.montarBuscaPaciente(el);
      el.querySelector('input[type=hidden]').addEventListener('change', (e) => C.ir('consultas/nueva/' + e.target.value));
      return;
    }

    const [p, h] = await Promise.all([api('/pacientes/' + pacienteId), api(`/pacientes/${pacienteId}/historial`)]);
    const nombre = p.nombres + ' ' + p.apellidos;
    const sv = h.signos[0];
    const cita = citaId ? h.citas.find((c) => String(c.id) === String(citaId)) : null;
    // Si se atiende desde una cita, pasa a "En consulta"
    if (cita && !['En consulta', 'Atendida'].includes(cita.estado)) {
      api(`/citas/${cita.id}/estado`, { method: 'PATCH', body: { estado: 'En consulta' } }).catch(() => {});
    }

    el.innerHTML = `
      <div class="vhead"><div><h1>Nueva consulta</h1><p>${cita ? `Cita de las ${C.hora(cita.hora_inicio)} · ${esc(cita.tipo)}` : 'Consulta sin cita previa'}</p></div></div>
      <div class="two">
        <div class="card"><div class="cb" style="padding:18px">
          <div class="err" hidden></div>
          <form class="form" id="kform" novalidate>
            ${C.campoHTML({ n: 'motivo', l: 'Motivo de consulta', full: true, req: true }, cita && cita.motivo)}
            ${C.campoHTML({ n: 'historia', l: 'Historia de la enfermedad actual', t: 'textarea' })}
            ${C.campoHTML({ n: 'exploracion', l: 'Exploración física', t: 'textarea', ph: sv ? `PA ${sv.presion_sistolica ?? '—'}/${sv.presion_diastolica ?? '—'}, FC ${sv.frecuencia_cardiaca ?? '—'}, T ${sv.temperatura_c ?? '—'} °C…` : '' })}
            ${C.campoHTML({ n: 'diagnostico', l: 'Diagnóstico' })}
            ${C.campoHTML({ n: 'cie10', l: 'Código CIE-10', ph: 'Ej. I10, J02.9' })}
            ${C.campoHTML({ n: 'tratamiento', l: 'Tratamiento', t: 'textarea' })}
            ${C.campoHTML({ n: 'indicaciones', l: 'Indicaciones para el paciente', t: 'textarea' })}
            <div class="fsec">Receta (opcional)</div>
            <div class="full" id="kitems"></div>
            ${C.campoHTML({ n: 'notas_receta', l: 'Notas de la receta', full: true })}
          </form>
          <div style="display:flex;gap:8px;justify-content:flex-end;margin-top:16px">
            <a class="btn" href="#/expediente/${p.id}">Cancelar</a>
            <button class="btn pri" id="kguardar">${icono('i-check')}Guardar consulta</button>
          </div>
        </div></div>

        <div class="col">
          <div class="card"><div class="cb" style="padding:16px">
            <div class="who" style="display:flex;gap:12px;align-items:center">${avatar(nombre, 'style="width:48px;height:48px;border-radius:14px"')}
              <div><b style="font-size:16px">${esc(nombre)}</b><div class="sub">${esc(p.expediente_no || '')} · ${p.edad ?? '—'} años${p.tipo_sangre ? ' · ' + esc(p.tipo_sangre) : ''}</div></div></div>
            ${p.alergias ? `<div class="alert" style="margin:14px 0 0">${icono('i-alert')}<div><b>Alergias:</b> ${esc(p.alergias)}</div></div>` : ''}
            ${p.antecedentes ? `<p class="sub" style="margin:12px 0 0"><b style="color:var(--ink)">Antecedentes:</b> ${esc(p.antecedentes)}</p>` : ''}
          </div></div>
          <div class="card"><div class="ch"><h3>${icono('i-heart')}Últimos signos vitales</h3></div>
            ${sv ? `<div class="vit" style="padding-top:0">
              <div><span>Presión</span><b>${sv.presion_sistolica ? `${sv.presion_sistolica}/${sv.presion_diastolica}` : '—'}</b></div>
              <div><span>Frec. cardíaca</span><b>${sv.frecuencia_cardiaca ?? '—'}</b></div>
              <div><span>Temperatura</span><b>${sv.temperatura_c ? sv.temperatura_c + '°' : '—'}</b></div>
              <div><span>Peso</span><b>${sv.peso_kg ? sv.peso_kg + ' kg' : '—'}</b></div>
            </div><div class="sub" style="padding:0 16px 14px">Tomados el ${fecha(sv.creado_en)}</div>` : C.vacio('Sin signos vitales', '', 'i-heart')}
          </div>
          <div class="card"><div class="ch"><h3>${icono('i-steth')}Consultas anteriores</h3></div>
            <div class="cb">${h.consultas.slice(0, 4).map((c) => `<div class="act"><div class="at"><b>${esc(c.diagnostico || c.motivo || 'Consulta')}</b><span>${fecha(c.fecha)} · ${esc(c.medico)}</span></div></div>`).join('') || C.vacio('Primera consulta', '', 'i-steth')}</div>
          </div>
        </div>
      </div>`;

    const leerItems = C.editorItems(C.$('#kitems'));
    const boton = C.$('#kguardar');
    boton.addEventListener('click', async () => {
      const errBox = el.querySelector('.err');
      errBox.hidden = true;
      const d = C.leerForm(C.$('#kform'));
      if (!d.motivo) { errBox.textContent = 'Escribe el motivo de consulta'; errBox.hidden = false; return window.scrollTo(0, 0); }
      boton.disabled = true;
      try {
        const k = await api('/consultas', { method: 'POST', body: { ...d, paciente_id: p.id, cita_id: cita ? cita.id : null } });
        const items = leerItems();
        if (items.length) await api('/recetas', { method: 'POST', body: { paciente_id: p.id, consulta_id: k.id, notas: d.notas_receta, items } });
        C.aviso(items.length ? 'Consulta y receta guardadas' : 'Consulta guardada');
        C.ir('consultas/ver/' + k.id);
      } catch (e) {
        errBox.textContent = e.message; errBox.hidden = false; window.scrollTo(0, 0);
      } finally { boton.disabled = false; }
    });
  },

  async ver(el, id) {
    const { api, esc, icono, fechaHora } = C;
    const k = await api('/consultas/' + id);
    const puedeEditar = C.permisos.admin() || (C.yo.rol === 'medico' && k.medico_id === C.yo.id);
    const bloque = (t, v) => (v ? `<div style="margin-bottom:14px"><div class="fsec" style="border:0;padding:0;margin:0 0 4px">${t}</div><div style="white-space:pre-wrap">${esc(v)}</div></div>` : '');
    el.innerHTML = `
      <div class="vhead"><a class="btn sm ghost" href="#/consultas">${icono('i-left')}Consultas</a>
        <div class="acts">
          <a class="btn" href="#/expediente/${k.paciente_id}">${icono('i-file')}Expediente</a>
          ${C.permisos.clinico() ? `<a class="btn" href="#/recetas/nueva/${k.paciente_id}/${k.id}">${icono('i-pill')}Agregar receta</a>` : ''}
          ${puedeEditar ? `<button class="btn pri" id="kedit">${icono('i-edit')}Editar</button>` : ''}
        </div></div>
      <div class="two">
        <div class="card"><div class="cb" style="padding:20px">
          <h1 style="margin:0 0 2px;font-size:22px">${esc(k.diagnostico || k.motivo || 'Consulta')} ${k.cie10 ? `<span class="tag b-blue" style="vertical-align:4px">${esc(k.cie10)}</span>` : ''}</h1>
          <p class="sub" style="margin:0 0 18px">${fechaHora(k.fecha)} · ${esc(k.paciente)} (${esc(k.expediente_no || '')}) · ${esc(k.medico)}</p>
          ${bloque('Motivo de consulta', k.motivo)}${bloque('Historia de la enfermedad', k.historia)}${bloque('Exploración física', k.exploracion)}
          ${bloque('Diagnóstico', k.diagnostico)}${bloque('Tratamiento', k.tratamiento)}${bloque('Indicaciones', k.indicaciones)}
        </div></div>
        <div class="card"><div class="ch"><h3>${icono('i-pill')}Recetas de esta consulta</h3></div>
          <div class="cb">${k.recetas.length ? k.recetas.map((r) => `<div style="padding:10px 0;border-bottom:1px solid var(--line-2)">
            <div style="display:flex;align-items:center"><b>Receta #${r.id}</b><button class="btn sm ghost" style="margin-left:auto" data-print="${r.id}">${icono('i-print')}Imprimir</button></div>
            ${r.items.map((i) => `<div class="sub" style="margin-top:4px"><b style="color:var(--ink)">${esc(i.medicamento)}</b> ${esc([i.dosis, i.frecuencia, i.duracion].filter(Boolean).join(' · '))}</div>`).join('')}
          </div>`).join('') : C.vacio('Sin recetas', '', 'i-pill')}</div>
        </div>
      </div>`;
    el.addEventListener('click', (e) => { const b = e.target.closest('[data-print]'); if (b) C.imprimirReceta(b.dataset.print); });
    const be = C.$('#kedit');
    if (be) be.addEventListener('click', () => C.formulario({
      titulo: 'Editar consulta', tam: 'lg', valores: k,
      campos: [
        { n: 'motivo', l: 'Motivo de consulta', full: true },
        { n: 'historia', l: 'Historia de la enfermedad actual', t: 'textarea' },
        { n: 'exploracion', l: 'Exploración física', t: 'textarea' },
        { n: 'diagnostico', l: 'Diagnóstico' },
        { n: 'cie10', l: 'Código CIE-10' },
        { n: 'tratamiento', l: 'Tratamiento', t: 'textarea' },
        { n: 'indicaciones', l: 'Indicaciones', t: 'textarea' },
      ],
      async guardar(d) { await api('/consultas/' + k.id, { method: 'PUT', body: d }); C.aviso('Consulta actualizada'); C.recargar(); },
    }));
  },
});
