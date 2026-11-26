/* Expediente: ficha completa del paciente con su historial */

// Dar o quitar acceso al PORTAL DE PACIENTES
C.formPortal = function (p, alGuardar) {
  const activo = Boolean(p.portal_activo);
  const m = C.formulario({
    titulo: activo ? 'Portal del paciente · activo' : 'Dar acceso al portal de pacientes',
    valores: { email: p.email || '' },
    campos: [
      { n: 'email', l: 'Correo del paciente', t: 'email', req: true, full: true, hint: 'Con este correo entrará al portal' },
      { n: 'password', l: activo ? 'Nueva contraseña' : 'Contraseña inicial', t: 'text', req: true, full: true, hint: 'Mínimo 6 caracteres. Entrégasela al paciente; luego él puede cambiarla.' },
    ],
    textoBoton: activo ? 'Guardar' : 'Activar acceso',
    alAbrir(mm) {
      const pie = mm.el.querySelector('.mb');
      pie.insertAdjacentHTML('afterbegin', `<p class="sub" style="margin:0 0 12px">En el portal (<b>portal.html</b>) el paciente ve sus citas y recetas, solicita citas y le escribe a la clínica por Mensajes.</p>`);
      if (activo) {
        const mf = mm.el.querySelector('.mf');
        mf.insertAdjacentHTML('afterbegin', `<button class="btn dan" data-quitar style="margin-right:auto">Quitar acceso</button>`);
        mf.querySelector('[data-quitar]').addEventListener('click', async () => {
          try { await C.api(`/pacientes/${p.id}/portal`, { method: 'DELETE' }); C.aviso('Acceso al portal desactivado'); mm.cerrar(); if (alGuardar) alGuardar(); }
          catch (e) { C.fallo(e); }
        });
      }
    },
    async guardar(d) {
      await C.api(`/pacientes/${p.id}/portal`, { method: 'POST', body: d });
      C.aviso(activo ? 'Acceso actualizado' : `Acceso activado: ${d.email}`);
      if (alGuardar) alGuardar();
    },
  });
  return m;
};

// Formulario de signos vitales (lo usa también la Agenda)
C.formSignos = function ({ pacienteId, citaId, nombre, alGuardar }) {
  C.formulario({
    titulo: 'Signos vitales' + (nombre ? ' · ' + nombre : ''),
    campos: [
      { n: 'presion_sistolica', l: 'Presión sistólica (mmHg)', t: 'number', min: 0, ph: '120' },
      { n: 'presion_diastolica', l: 'Presión diastólica (mmHg)', t: 'number', min: 0, ph: '80' },
      { n: 'frecuencia_cardiaca', l: 'Frecuencia cardíaca (lpm)', t: 'number', min: 0, ph: '72' },
      { n: 'frecuencia_resp', l: 'Frecuencia respiratoria (rpm)', t: 'number', min: 0, ph: '16' },
      { n: 'temperatura_c', l: 'Temperatura (°C)', t: 'number', min: 0, step: '0.1', ph: '36.5' },
      { n: 'saturacion_o2', l: 'Saturación O₂ (%)', t: 'number', min: 0, ph: '98' },
      { n: 'peso_kg', l: 'Peso (kg)', t: 'number', min: 0, step: '0.1' },
      { n: 'talla_cm', l: 'Talla (cm)', t: 'number', min: 0, step: '0.1' },
      { n: 'motivo_consulta', l: 'Motivo de consulta', full: true },
      { n: 'observaciones', l: 'Observaciones', t: 'textarea' },
    ],
    textoBoton: 'Registrar',
    async guardar(d) {
      await C.api(`/pacientes/${pacienteId}/signos`, { method: 'POST', body: { ...d, cita_id: citaId || null } });
      C.aviso('Signos vitales registrados');
      if (alGuardar) alGuardar();
    },
  });
};

C.vista('expediente', {
  titulo: 'Expediente',
  async render(el, params) {
    const { api, esc, icono, avatar, vacio, fecha, fechaHora, hora, badgeEstado } = C;
    const id = params[0];

    // Sin paciente: buscador
    if (!id) {
      el.innerHTML = `<div class="vhead"><div><h1>Expediente</h1><p>Busca un paciente para ver su expediente completo.</p></div></div>
        <div class="card"><div class="toolbar"><div class="sbox grow">${icono('i-search')}<input class="inp" id="eq" placeholder="Nombre, expediente o teléfono"></div></div>
        <div id="elist">${C.cargando()}</div></div>`;
      const pintar = async (q) => {
        const l = await api('/pacientes?q=' + encodeURIComponent(q));
        C.$('#elist').innerHTML = l.length ? l.map((p) => {
          const n = p.nombres + ' ' + p.apellidos;
          return `<a class="appt" href="#/expediente/${p.id}" style="text-decoration:none;color:inherit;padding:12px 16px;border-radius:0">
            ${avatar(n)}<div class="who"><b>${esc(n)}</b><span>${esc(p.expediente_no || '')} · ${p.edad ?? '—'} años · ${esc(p.telefono || 'sin teléfono')}</span></div>${icono('i-chev', 'style="color:var(--ink-3)"')}</a>`;
        }).join('') : vacio('Sin resultados', '', 'i-users');
      };
      let t;
      C.$('#eq').addEventListener('input', (e) => { clearTimeout(t); t = setTimeout(() => pintar(e.target.value.trim()).catch(C.fallo), 250); });
      C.$('#eq').focus();
      return pintar('');
    }

    const [p, h] = await Promise.all([api('/pacientes/' + id), api(`/pacientes/${id}/historial`)]);
    const nombre = p.nombres + ' ' + p.apellidos;
    const SEXO = { M: 'Masculino', F: 'Femenino', O: 'Otro' };
    const sv = h.signos[0];
    let pestana = 'consultas';

    const pintarPestana = () => {
      C.$$('.tabs button').forEach((b) => b.classList.toggle('on', b.dataset.t === pestana));
      const box = C.$('#tab');
      if (pestana === 'consultas') {
        box.innerHTML = h.consultas.length ? `<div class="tl">${h.consultas.map((c) => `
          <div class="tli"><div class="d">${fechaHora(c.fecha)} · ${esc(c.medico)}</div>
            <b>${esc(c.diagnostico || c.motivo || 'Consulta')}${c.cie10 ? ` <span class="tag b-blue">${esc(c.cie10)}</span>` : ''}</b>
            ${c.motivo ? `<p><strong>Motivo:</strong> ${esc(c.motivo)}</p>` : ''}
            ${c.tratamiento ? `<p><strong>Tratamiento:</strong> ${esc(c.tratamiento)}</p>` : ''}
            ${c.indicaciones ? `<p><strong>Indicaciones:</strong> ${esc(c.indicaciones)}</p>` : ''}
            <a class="btn sm ghost" href="#/consultas/ver/${c.id}" style="margin-top:4px;padding-left:0">Ver consulta ${icono('i-chev')}</a>
          </div>`).join('')}</div>` : vacio('Sin consultas registradas', '', 'i-steth');
      } else if (pestana === 'recetas') {
        box.innerHTML = h.recetas.length ? `<div class="tl">${h.recetas.map((r) => `
          <div class="tli"><div class="d">${fechaHora(r.fecha)} · ${esc(r.medico)}</div>
            <b>Receta #${r.id}</b>
            ${r.items.map((i) => `<p><strong>${esc(i.medicamento)}</strong> ${esc([i.dosis, i.frecuencia, i.duracion].filter(Boolean).join(' · '))}</p>`).join('')}
            <button class="btn sm ghost" data-print="${r.id}" style="margin-top:4px;padding-left:0">${icono('i-print')}Imprimir</button>
          </div>`).join('')}</div>` : vacio('Sin recetas', '', 'i-pill');
      } else if (pestana === 'citas') {
        box.innerHTML = h.citas.length ? `<div class="tbl-wrap"><table class="tbl"><thead><tr><th>Fecha</th><th>Hora</th><th>Tipo</th><th>Médico</th><th>Estado</th></tr></thead><tbody>
          ${h.citas.map((c) => `<tr><td>${fecha(c.fecha)}</td><td>${hora(c.hora_inicio)}</td><td>${esc(c.tipo)}${c.motivo ? `<div class="sub">${esc(c.motivo)}</div>` : ''}</td><td class="sub">${esc(c.medico)}</td><td>${badgeEstado(c.estado)}</td></tr>`).join('')}
          </tbody></table></div>` : vacio('Sin citas', '', 'i-cal');
      } else {
        box.innerHTML = h.signos.length ? `<div class="tbl-wrap"><table class="tbl"><thead><tr><th>Fecha</th><th>Presión</th><th>FC</th><th>Temp.</th><th>SpO₂</th><th>Peso</th><th>Talla</th></tr></thead><tbody>
          ${h.signos.map((s) => `<tr><td>${fechaHora(s.creado_en)}</td><td>${s.presion_sistolica ? `${s.presion_sistolica}/${s.presion_diastolica ?? '—'}` : '—'}</td>
            <td>${s.frecuencia_cardiaca ?? '—'}</td><td>${s.temperatura_c ? s.temperatura_c + ' °C' : '—'}</td><td>${s.saturacion_o2 ? s.saturacion_o2 + '%' : '—'}</td>
            <td>${s.peso_kg ? s.peso_kg + ' kg' : '—'}</td><td>${s.talla_cm ? s.talla_cm + ' cm' : '—'}</td></tr>`).join('')}
          </tbody></table></div>` : vacio('Sin signos vitales', '', 'i-heart');
      }
    };

    el.innerHTML = `
      <div class="vhead"><a class="btn sm ghost" href="#/pacientes">${icono('i-left')}Pacientes</a></div>
      <div class="card" style="margin-bottom:16px">
        <div class="ptop">
          ${avatar(nombre)}
          <div><h2>${esc(nombre)}</h2>
            <div class="meta">${esc(p.expediente_no || '')} · ${SEXO[p.sexo] || 'Sexo no indicado'} · ${p.edad != null ? p.edad + ' años' : 'edad no registrada'}${p.tipo_sangre ? ' · ' + esc(p.tipo_sangre) : ''}</div></div>
          <div class="acts">
            ${C.permisos.clinico() ? `<a class="btn pri" href="#/consultas/nueva/${p.id}">${icono('i-steth')}Nueva consulta</a>` : ''}
            ${C.permisos.clinico() ? `<a class="btn" href="#/recetas/nueva/${p.id}">${icono('i-pill')}Receta</a>` : ''}
            ${C.permisos.signos() ? `<button class="btn" id="bSignos">${icono('i-heart')}Signos</button>` : ''}
            <a class="btn" href="#/agenda/nueva/${p.id}">${icono('i-cal')}Cita</a>
            <a class="btn" href="#/mensajes/${p.id}">${icono('i-msg')}Mensaje</a>
            <button class="btn" id="bPortal" title="Acceso del paciente al portal">${icono('i-lock')}${p.portal_activo ? 'Portal activo' : 'Dar acceso al portal'}</button>
            <button class="ibtn" id="bEdit" title="Editar datos">${icono('i-edit')}</button>
          </div>
        </div>
        ${p.alergias ? `<div class="alert">${icono('i-alert')}<div><b>Alergias:</b> ${esc(p.alergias)}</div></div>` : ''}
        <div class="kv">
          <div><span>Teléfono</span><b>${esc(p.telefono || '—')}</b></div>
          <div><span>Fecha de nacimiento</span><b>${p.fecha_nacimiento ? fecha(p.fecha_nacimiento) : '—'}</b></div>
          <div><span>Identidad</span><b>${esc(p.identidad || '—')}</b></div>
          <div><span>Correo</span><b>${esc(p.email || '—')}</b>${p.portal_activo ? '<div class="sub" style="color:var(--good)">Con acceso al portal</div>' : ''}</div>
          <div><span>Antecedentes</span><b>${esc(p.antecedentes || 'Ninguno registrado')}</b></div>
          <div><span>Dirección</span><b>${esc(p.direccion || '—')}</b></div>
          <div><span>Contacto de emergencia</span><b>${esc(p.contacto_emerg_nombre || '—')}${p.contacto_emerg_telefono ? ' · ' + esc(p.contacto_emerg_telefono) : ''}</b></div>
          <div><span>Últimos signos</span><b>${sv ? [sv.presion_sistolica && `PA ${sv.presion_sistolica}/${sv.presion_diastolica ?? '—'}`, sv.temperatura_c && sv.temperatura_c + ' °C', sv.frecuencia_cardiaca && `FC ${sv.frecuencia_cardiaca}`].filter(Boolean).join(' · ') || 'Registrados' : '—'}</b>${sv ? `<div class="sub">${fecha(sv.creado_en)}</div>` : ''}</div>
        </div>
      </div>
      <div class="card">
        <div class="tabs">
          <button data-t="consultas">Consultas <span class="n">${h.consultas.length}</span></button>
          <button data-t="recetas">Recetas <span class="n">${h.recetas.length}</span></button>
          <button data-t="citas">Citas <span class="n">${h.citas.length}</span></button>
          <button data-t="signos">Signos vitales <span class="n">${h.signos.length}</span></button>
        </div>
        <div id="tab"></div>
      </div>`;

    C.$('.tabs').addEventListener('click', (e) => { const b = e.target.closest('button'); if (b) { pestana = b.dataset.t; pintarPestana(); } });
    C.$('#tab').addEventListener('click', (e) => { const b = e.target.closest('[data-print]'); if (b) C.imprimirReceta(b.dataset.print); });
    C.$('#bEdit').addEventListener('click', () => C.formPaciente(p, C.recargar));
    C.$('#bPortal').addEventListener('click', () => C.formPortal(p, C.recargar));
    const bs = C.$('#bSignos');
    if (bs) bs.addEventListener('click', () => C.formSignos({ pacienteId: p.id, nombre, alGuardar: C.recargar }));
    pintarPestana();
  },
});
