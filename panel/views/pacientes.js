/* Pacientes: lista, búsqueda, crear, editar y desactivar */

// Formulario de paciente (lo usan también Expediente y Agenda)
C.formPaciente = function (paciente, alGuardar) {
  const nuevo = !paciente;
  const p = paciente || {};
  const f = (v) => (v ? String(v).slice(0, 10) : '');
  C.formulario({
    titulo: nuevo ? 'Nuevo paciente' : 'Editar paciente',
    tam: 'lg',
    valores: { ...p, fecha_nacimiento: f(p.fecha_nacimiento) },
    campos: [
      { t: 'sec', l: 'Datos personales' },
      { n: 'nombres', l: 'Nombres', req: true },
      { n: 'apellidos', l: 'Apellidos', req: true },
      { n: 'identidad', l: 'Identidad', ph: '0801-1990-12345' },
      { n: 'fecha_nacimiento', l: 'Fecha de nacimiento', t: 'date' },
      { n: 'sexo', l: 'Sexo', t: 'select', vacio: 'Seleccionar…', ops: [['F', 'Femenino'], ['M', 'Masculino'], ['O', 'Otro']] },
      { n: 'tipo_sangre', l: 'Tipo de sangre', t: 'select', vacio: 'No sabe', ops: ['O+', 'O-', 'A+', 'A-', 'B+', 'B-', 'AB+', 'AB-'] },
      { t: 'sec', l: 'Contacto' },
      { n: 'telefono', l: 'Teléfono', t: 'tel', ph: '+504 9999-9999' },
      { n: 'email', l: 'Correo', t: 'email' },
      { n: 'direccion', l: 'Dirección', full: true },
      { n: 'contacto_emerg_nombre', l: 'Contacto de emergencia' },
      { n: 'contacto_emerg_telefono', l: 'Teléfono de emergencia', t: 'tel' },
      { t: 'sec', l: 'Información clínica' },
      { n: 'alergias', l: 'Alergias', t: 'textarea', ph: 'Ej. Penicilina, mariscos…' },
      { n: 'antecedentes', l: 'Antecedentes', t: 'textarea', ph: 'Enfermedades crónicas, cirugías, etc.' },
    ],
    textoBoton: nuevo ? 'Registrar paciente' : 'Guardar cambios',
    async guardar(datos) {
      const r = nuevo
        ? await C.api('/pacientes', { method: 'POST', body: datos })
        : await C.api('/pacientes/' + p.id, { method: 'PUT', body: datos });
      C.aviso(nuevo ? `Paciente registrado (${r.expediente_no})` : 'Paciente actualizado');
      if (alGuardar) alGuardar(nuevo ? r.id : p.id);
    },
  });
};

C.vista('pacientes', {
  titulo: 'Pacientes',
  async render(el) {
    const { api, esc, icono, avatar, vacio, fecha } = C;
    el.innerHTML = `
      <div class="vhead"><div><h1>Pacientes</h1><p id="pcount">Cargando…</p></div>
        <div class="acts"><button class="btn pri" id="nuevoP">${icono('i-plus')}Nuevo paciente</button></div></div>
      <div class="card">
        <div class="toolbar"><div class="sbox grow">${icono('i-search')}<input class="inp" id="pq" placeholder="Buscar por nombre, expediente o teléfono"></div></div>
        <div class="tbl-wrap" id="plist">${C.cargando()}</div>
      </div>`;

    const SEXO = { M: 'Masculino', F: 'Femenino', O: 'Otro' };
    async function cargar(q = '') {
      const lista = await api('/pacientes?q=' + encodeURIComponent(q));
      C.$('#pcount').textContent = `${lista.length} paciente${lista.length === 1 ? '' : 's'} ${q ? 'encontrados' : 'activos'}`;
      C.$('#plist').innerHTML = lista.length ? `<table class="tbl"><thead><tr>
          <th>Paciente</th><th>Edad</th><th>Sexo</th><th>Teléfono</th><th>Registro</th><th></th></tr></thead><tbody>
          ${lista.map((p) => {
            const n = p.nombres + ' ' + p.apellidos;
            return `<tr class="click" data-id="${p.id}">
              <td><div class="who">${avatar(n)}<div><b>${esc(n)}</b><span>${esc(p.expediente_no || '')}</span></div></div></td>
              <td>${p.edad ?? '—'} ${p.edad != null ? 'años' : ''}</td>
              <td>${SEXO[p.sexo] || '—'}</td>
              <td>${esc(p.telefono || '—')}</td>
              <td class="sub">${p.fecha_nacimiento ? 'Nac. ' + fecha(p.fecha_nacimiento) : ''}</td>
              <td class="acts">
                <a class="ibtn" title="Expediente" href="#/expediente/${p.id}">${icono('i-file')}</a>
                <a class="ibtn" title="Agendar cita" href="#/agenda/nueva/${p.id}">${icono('i-cal')}</a>
                <button class="ibtn" title="Editar" data-edit="${p.id}">${icono('i-edit')}</button>
                <button class="ibtn dan" title="Desactivar" data-del="${p.id}" data-n="${esc(n)}">${icono('i-trash')}</button>
              </td></tr>`;
          }).join('')}</tbody></table>`
        : vacio(q ? 'Sin resultados' : 'Aún no hay pacientes', q ? 'Prueba con otro nombre o número de expediente.' : 'Registra el primero con "Nuevo paciente".', 'i-users');
    }

    let t;
    C.$('#pq').addEventListener('input', (e) => { clearTimeout(t); t = setTimeout(() => cargar(e.target.value.trim()).catch(C.fallo), 250); });
    C.$('#nuevoP').addEventListener('click', () => C.formPaciente(null, (id) => C.ir('expediente/' + id)));
    C.$('#plist').addEventListener('click', async (e) => {
      const ed = e.target.closest('[data-edit]'), del = e.target.closest('[data-del]');
      if (e.target.closest('a')) return;
      if (ed) {
        const p = await api('/pacientes/' + ed.dataset.edit);
        return C.formPaciente(p, () => cargar(C.$('#pq').value.trim()));
      }
      if (del) {
        if (!(await C.confirmar(`¿Desactivar a ${del.dataset.n}? Su historial se conserva, pero ya no aparecerá en la lista.`, { si: 'Desactivar', peligro: true }))) return;
        try { await api('/pacientes/' + del.dataset.del, { method: 'DELETE' }); C.aviso('Paciente desactivado'); cargar(C.$('#pq').value.trim()); }
        catch (err) { C.fallo(err); }
        return;
      }
      const tr = e.target.closest('tr[data-id]');
      if (tr) C.ir('expediente/' + tr.dataset.id);
    });
    await cargar();
  },
});
