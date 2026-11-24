/* Recetas: lista, nueva receta, imprimir y anular */

// Abre la receta en una ventana nueva lista para imprimir o guardar como PDF
C.imprimirReceta = async function (id) {
  const w = window.open('', '_blank', 'width=820,height=900');
  if (!w) return C.aviso('Permite las ventanas emergentes para imprimir la receta', 'bad');
  w.document.write('<p style="font-family:sans-serif;padding:20px">Cargando receta…</p>');
  try {
    const r = await C.api('/recetas/' + id);
    const { esc, fecha } = C;
    const logo = new URL('img/logo-clinnova.png', location.href).href;
    w.document.open();
    w.document.write(`<!doctype html><html lang="es"><head><meta charset="utf-8"><title>Receta #${r.id} · ${esc(r.paciente)}</title>
      <style>
        body{font-family:Inter,Arial,sans-serif;color:#17212c;margin:0;padding:36px 44px;font-size:14px}
        .top{display:flex;align-items:center;border-bottom:3px solid #0f72b8;padding-bottom:14px}
        .top img{height:54px}.top .dr{margin-left:auto;text-align:right}
        .dr b{font-size:16px;display:block}.dr span{color:#5a6b7d;font-size:12.5px;display:block}
        .pac{display:grid;grid-template-columns:2fr 1fr 1fr;gap:6px 18px;background:#f4f9fd;border-radius:10px;padding:12px 16px;margin:18px 0}
        .pac span{font-size:11px;text-transform:uppercase;letter-spacing:.5px;color:#8a98a8;display:block}
        .rx{font-size:34px;font-weight:800;color:#0f72b8;font-family:Georgia,serif;margin:6px 0 8px}
        .it{padding:12px 0;border-bottom:1px solid #e4ecf4}.it b{font-size:15.5px}
        .it .d{color:#3b4a5a;margin-top:2px}.it .i{color:#5a6b7d;font-style:italic;margin-top:2px}
        .alerg{color:#a8322b;font-weight:600}
        .notas{margin-top:16px;color:#3b4a5a}
        .firma{margin-top:70px;display:flex;justify-content:flex-end}
        .firma div{border-top:1px solid #17212c;width:260px;text-align:center;padding-top:6px;font-size:12.5px}
        .pie{margin-top:40px;font-size:11px;color:#8a98a8;text-align:center}
        @media print{body{padding:16px 20px}.noprint{display:none}}
        .noprint{position:fixed;bottom:18px;right:18px;box-shadow:0 6px 18px rgba(15,114,184,.35);background:#0f72b8;color:#fff;border:0;border-radius:10px;padding:10px 16px;font-size:14px;font-weight:600;cursor:pointer}
      </style></head><body>
      <button class="noprint" onclick="window.print()">Imprimir / Guardar PDF</button>
      <div class="top"><img src="${logo}" alt="Clinnova">
        <div class="dr"><b>Dr. ${esc(r.medico)}</b><span>${esc(r.especialidad || 'Medicina')}</span>${r.colegiatura ? `<span>Colegiación ${esc(r.colegiatura)}</span>` : ''}<span>${esc(r.clinica || '')}</span></div></div>
      <div class="pac">
        <div><span>Paciente</span><b>${esc(r.paciente)}</b></div>
        <div><span>Edad</span><b>${r.edad != null ? r.edad + ' años' : '—'}</b></div>
        <div><span>Fecha</span><b>${fecha(r.fecha)}</b></div>
        <div><span>Expediente</span>${esc(r.expediente_no || '—')}</div>
        <div style="grid-column:span 2"><span>Alergias</span><span class="alerg" style="text-transform:none;letter-spacing:0;font-size:14px;color:${r.alergias ? '#a8322b' : '#17212c'}">${esc(r.alergias || 'Ninguna conocida')}</span></div>
      </div>
      <div class="rx">Rx</div>
      ${r.items.map((i, n) => `<div class="it"><b>${n + 1}. ${esc(i.medicamento)}</b>${i.dosis ? ` — ${esc(i.dosis)}` : ''}
        <div class="d">${esc([i.frecuencia, i.duracion && 'durante ' + i.duracion].filter(Boolean).join(', '))}</div>
        ${i.indicaciones ? `<div class="i">${esc(i.indicaciones)}</div>` : ''}</div>`).join('')}
      ${r.notas ? `<div class="notas"><b>Notas:</b> ${esc(r.notas)}</div>` : ''}
      <div class="firma"><div>Firma y sello<br><b>Dr. ${esc(r.medico)}</b></div></div>
      <div class="pie">Receta #${r.id} · Generada con Clinnova</div>
      </body></html>`);
    w.document.close();
  } catch (e) {
    w.close();
    C.fallo(e);
  }
};

// Formulario de receta (modal). paciente = {id, nombre} opcional
C.formReceta = function ({ paciente, consultaId, alGuardar } = {}) {
  let leer;
  C.formulario({
    titulo: 'Nueva receta', tam: 'lg',
    campos: [{ n: 'notas', l: 'Notas generales', full: true, ph: 'Ej. Tomar a la misma hora todos los días' }],
    textoBoton: 'Guardar receta',
    alAbrir(m) {
      const form = m.el.querySelector('form');
      form.insertAdjacentHTML('afterbegin', C.buscaPacienteHTML() + '<div class="fsec">Medicamentos</div><div class="full" id="ritems"></div>');
      C.montarBuscaPaciente(form, paciente);
      leer = C.editorItems(form.querySelector('#ritems'));
    },
    async guardar(d) {
      if (!d.paciente_id) throw new Error('Elige un paciente de la lista');
      const items = leer();
      if (!items.length) throw new Error('Agrega al menos un medicamento');
      const r = await C.api('/recetas', { method: 'POST', body: { paciente_id: d.paciente_id, consulta_id: consultaId || null, notas: d.notas, items } });
      C.aviso('Receta creada');
      if (alGuardar) alGuardar(r.id);
    },
  });
};

C.vista('recetas', {
  titulo: 'Recetas',
  async render(el, params) {
    const { api, esc, icono, avatar, vacio, fechaHora } = C;
    el.innerHTML = `
      <div class="vhead"><div><h1>Recetas</h1><p id="rcount">Recetas emitidas</p></div>
        <div class="acts">${C.permisos.clinico() ? `<button class="btn pri" id="nuevaR">${icono('i-plus')}Nueva receta</button>` : ''}</div></div>
      <div class="card">
        <div class="toolbar"><div class="sbox grow">${icono('i-search')}<input class="inp" id="rq" placeholder="Buscar por paciente o medicamento"></div>
          ${C.yo.rol === 'medico' ? '<label class="sub" style="display:flex;gap:6px;align-items:center"><input type="checkbox" id="rmias"> Solo mis recetas</label>' : ''}</div>
        <div class="tbl-wrap" id="rlist">${C.cargando()}</div>
      </div>`;

    async function cargar() {
      const qs = new URLSearchParams();
      const q = C.$('#rq').value.trim(); if (q) qs.set('q', q);
      const m = C.$('#rmias'); if (m && m.checked) qs.set('medico_id', C.yo.id);
      const l = await api('/recetas?' + qs);
      C.$('#rcount').textContent = `${l.length} receta${l.length === 1 ? '' : 's'}`;
      C.$('#rlist').innerHTML = l.length ? `<table class="tbl"><thead><tr><th>N.º</th><th>Fecha</th><th>Paciente</th><th>Medicamentos</th><th>Médico</th><th></th></tr></thead><tbody>
        ${l.map((r) => {
          const puede = C.permisos.admin() || (C.yo.rol === 'medico' && r.medico_id === C.yo.id);
          return `<tr>
            <td class="sub">#${r.id}</td>
            <td style="white-space:nowrap">${fechaHora(r.fecha)}</td>
            <td><a class="who" href="#/expediente/${r.paciente_id}" style="text-decoration:none;color:inherit">${avatar(r.paciente)}<div><b>${esc(r.paciente)}</b><span>${esc(r.expediente_no || '')}</span></div></a></td>
            <td>${esc(r.medicamentos || '—')}</td>
            <td class="sub">${esc(r.medico)}</td>
            <td class="acts">
              ${r.consulta_id ? `<a class="ibtn" title="Ver consulta" href="#/consultas/ver/${r.consulta_id}">${icono('i-steth')}</a>` : ''}
              <button class="ibtn" title="Imprimir" data-print="${r.id}">${icono('i-print')}</button>
              ${puede ? `<button class="ibtn dan" title="Anular" data-del="${r.id}">${icono('i-trash')}</button>` : ''}
            </td></tr>`;
        }).join('')}</tbody></table>` : vacio('No hay recetas', '', 'i-pill');
    }
    let t;
    const rec = () => cargar().catch(C.fallo);
    C.$('#rq').addEventListener('input', () => { clearTimeout(t); t = setTimeout(rec, 250); });
    const m = C.$('#rmias'); if (m) m.addEventListener('change', rec);
    const nr = C.$('#nuevaR'); if (nr) nr.addEventListener('click', () => C.formReceta({ alGuardar: rec }));
    C.$('#rlist').addEventListener('click', async (e) => {
      const p = e.target.closest('[data-print]'), d = e.target.closest('[data-del]');
      if (p) C.imprimirReceta(p.dataset.print);
      if (d) {
        if (!(await C.confirmar(`¿Anular la receta #${d.dataset.del}? Esta acción no se puede deshacer.`, { si: 'Anular', peligro: true }))) return;
        try { await api('/recetas/' + d.dataset.del, { method: 'DELETE' }); C.aviso('Receta anulada'); rec(); } catch (err) { C.fallo(err); }
      }
    });
    await cargar();

    // #/recetas/nueva/<pacienteId>/<consultaId?>
    if (params[0] === 'nueva' && C.permisos.clinico()) {
      history.replaceState(null, '', '#/recetas');
      const pac = params[1] ? await api('/pacientes/' + params[1]).catch(() => null) : null;
      C.formReceta({
        paciente: pac && { id: pac.id, nombre: pac.nombres + ' ' + pac.apellidos },
        consultaId: params[2],
        alGuardar: (id) => { rec(); C.imprimirReceta(id); },
      });
    }
  },
});
