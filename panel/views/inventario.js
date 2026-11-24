/* Inventario: existencias, entradas/salidas, alertas de stock y vencimiento */
C.vista('inventario', {
  titulo: 'Inventario',
  async render(el, params) {
    const { api, esc, icono, vacio, fecha, aFecha } = C;
    let soloBajo = params[0] === 'bajo';
    let tipo = '';
    let lista = [];

    el.innerHTML = `
      <div class="vhead"><div><h1>Inventario</h1><p id="icount">Medicamentos, material e insumos</p></div>
        <div class="acts"><button class="btn pri" id="nuevoI">${icono('i-plus')}Nuevo artículo</button></div></div>
      <section class="stats" style="grid-template-columns:repeat(3,1fr)" id="istats"></section>
      <div class="card">
        <div class="toolbar">
          <div class="sbox grow">${icono('i-search')}<input class="inp" id="iq" placeholder="Buscar artículo o proveedor"></div>
          <div class="chips" id="itipos">
            <button class="chip on" data-t="">Todos</button><button class="chip" data-t="Medicamento">Medicamentos</button>
            <button class="chip" data-t="Material">Material</button><button class="chip" data-t="Insumo">Insumos</button>
          </div>
          <label class="sub" style="display:flex;gap:6px;align-items:center"><input type="checkbox" id="ibajo" ${soloBajo ? 'checked' : ''}> Solo stock bajo</label>
        </div>
        <div class="tbl-wrap" id="ilist">${C.cargando()}</div>
      </div>`;

    const diasPara = (v) => (v ? Math.ceil((aFecha(v) - new Date()) / 86400000) : null);

    function pintar() {
      const q = C.$('#iq').value.trim().toLowerCase();
      const filas = lista.filter((a) => (!tipo || a.tipo === tipo) && (!soloBajo || a.existencia <= a.stock_minimo)
        && (!q || a.nombre.toLowerCase().includes(q) || (a.proveedor || '').toLowerCase().includes(q)));
      const bajos = lista.filter((a) => a.existencia <= a.stock_minimo).length;
      const porVencer = lista.filter((a) => { const d = diasPara(a.vencimiento); return d !== null && d <= 60; }).length;
      C.$('#icount').textContent = `${lista.length} artículos registrados`;
      C.$('#istats').innerHTML = `
        <div class="stat"><div class="ico i-blue">${icono('i-box')}</div><div><div class="n">${lista.length}</div><div class="l">Artículos</div></div></div>
        <div class="stat" data-f="bajo"><div class="ico i-red">${icono('i-alert')}</div><div><div class="n">${bajos}</div><div class="l">Con stock bajo</div></div></div>
        <div class="stat"><div class="ico i-amber">${icono('i-cal')}</div><div><div class="n">${porVencer}</div><div class="l">Vencen en 60 días o menos</div></div></div>`;
      C.$('#ilist').innerHTML = filas.length ? `<table class="tbl"><thead><tr>
        <th>Artículo</th><th>Tipo</th><th>Existencia</th><th class="num">Mínimo</th><th>Lote</th><th>Vencimiento</th><th>Proveedor</th><th></th></tr></thead><tbody>
        ${filas.map((a) => {
          const pct = Math.min(100, (a.existencia / Math.max(1, a.stock_minimo * 3)) * 100);
          const col = a.existencia <= a.stock_minimo ? 'var(--crit)' : a.existencia <= a.stock_minimo * 1.5 ? 'var(--warn)' : 'var(--good)';
          const d = diasPara(a.vencimiento);
          const venc = a.vencimiento ? `${fecha(a.vencimiento)}${d !== null && d <= 0 ? ' <span class="tag b-red">Vencido</span>' : d !== null && d <= 60 ? ` <span class="tag b-amber">${d} días</span>` : ''}` : '—';
          return `<tr>
            <td><b>${esc(a.nombre)}</b></td>
            <td class="sub">${esc(a.tipo)}</td>
            <td><div class="stock"><b style="min-width:34px;font-variant-numeric:tabular-nums">${a.existencia}</b><div class="bar"><i style="width:${pct}%;background:${col}"></i></div></div></td>
            <td class="num sub">${a.stock_minimo}</td>
            <td class="sub">${esc(a.lote || '—')}</td>
            <td>${venc}</td>
            <td class="sub">${esc(a.proveedor || '—')}</td>
            <td class="acts">
              <button class="btn sm" data-mov="${a.id}">${icono('i-swap')}Movimiento</button>
              <button class="ibtn" title="Historial" data-hist="${a.id}">${icono('i-list')}</button>
              <button class="ibtn" title="Editar" data-edit="${a.id}">${icono('i-edit')}</button>
              ${C.permisos.admin() ? `<button class="ibtn dan" title="Eliminar" data-del="${a.id}">${icono('i-trash')}</button>` : ''}
            </td></tr>`;
        }).join('')}</tbody></table>` : vacio(soloBajo ? 'Ningún artículo con stock bajo' : 'Sin artículos', '', 'i-box');
    }
    async function cargar() { lista = await api('/inventario'); pintar(); }
    const buscar = (id) => lista.find((a) => String(a.id) === String(id));

    function formArticulo(a) {
      const nuevo = !a;
      C.formulario({
        titulo: nuevo ? 'Nuevo artículo' : 'Editar artículo',
        valores: a ? { ...a, vencimiento: a.vencimiento ? String(a.vencimiento).slice(0, 10) : '' } : { tipo: 'Medicamento' },
        campos: [
          { n: 'nombre', l: 'Nombre', req: true, full: true, ph: 'Ej. Amoxicilina 500 mg' },
          { n: 'tipo', l: 'Tipo', t: 'select', ops: ['Medicamento', 'Material', 'Insumo'] },
          nuevo ? { n: 'existencia', l: 'Existencia inicial', t: 'number', min: 0, v: 0 } : { n: 'existencia', l: 'Existencia', t: 'number', dis: true, hint: 'Se cambia con Movimiento' },
          { n: 'stock_minimo', l: 'Stock mínimo', t: 'number', min: 0, hint: 'Avisa cuando la existencia llegue a este número' },
          { n: 'lote', l: 'Lote' },
          { n: 'vencimiento', l: 'Vencimiento', t: 'date' },
          { n: 'proveedor', l: 'Proveedor' },
        ],
        async guardar(d) {
          if (nuevo) await api('/inventario', { method: 'POST', body: d });
          else await api('/inventario/' + a.id, { method: 'PUT', body: d });
          C.aviso(nuevo ? 'Artículo creado' : 'Artículo actualizado');
          cargar();
        },
      });
    }

    C.$('#nuevoI').addEventListener('click', () => formArticulo());
    C.$('#iq').addEventListener('input', pintar);
    C.$('#ibajo').addEventListener('change', (e) => { soloBajo = e.target.checked; pintar(); });
    C.$('#istats').addEventListener('click', (e) => { if (e.target.closest('[data-f=bajo]')) { soloBajo = true; C.$('#ibajo').checked = true; pintar(); } });
    C.$('#itipos').addEventListener('click', (e) => {
      const b = e.target.closest('.chip'); if (!b) return;
      C.$$('#itipos .chip').forEach((x) => x.classList.toggle('on', x === b)); tipo = b.dataset.t; pintar();
    });
    C.$('#ilist').addEventListener('click', async (e) => {
      const mov = e.target.closest('[data-mov]'), hi = e.target.closest('[data-hist]'), ed = e.target.closest('[data-edit]'), del = e.target.closest('[data-del]');
      if (mov) {
        const a = buscar(mov.dataset.mov);
        C.formulario({
          titulo: 'Movimiento · ' + a.nombre, tam: 'sm',
          campos: [
            { n: 'tipo', l: 'Tipo', t: 'select', ops: [['Entrada', 'Entrada (compra, donación)'], ['Salida', 'Salida (uso, despacho)'], ['Ajuste', 'Ajuste (corrección, merma)']] },
            { n: 'cantidad', l: 'Cantidad', t: 'number', req: true, hint: `Existencia actual: ${a.existencia}. En Ajuste usa negativo para restar.` },
            { n: 'motivo', l: 'Motivo', full: true },
          ],
          textoBoton: 'Registrar',
          async guardar(d) {
            const r = await api(`/inventario/${a.id}/movimiento`, { method: 'POST', body: d });
            C.aviso(`Movimiento registrado. Nueva existencia: ${r.existencia}`);
            cargar(); C.contadores();
          },
        });
      } else if (hi) {
        const a = buscar(hi.dataset.hist);
        const movs = await api(`/inventario/${a.id}/movimientos`).catch((err) => { C.fallo(err); return null; });
        if (!movs) return;
        C.modal({
          titulo: 'Historial · ' + a.nombre,
          cuerpo: movs.length ? `<table class="tbl"><thead><tr><th>Fecha</th><th>Tipo</th><th class="num">Cantidad</th><th>Motivo</th></tr></thead><tbody>
            ${movs.map((m) => `<tr><td>${C.fechaHora(m.creado_en)}</td><td><span class="badge ${m.tipo === 'Entrada' ? 'b-green' : m.tipo === 'Salida' ? 'b-amber' : 'b-grey'}">${m.tipo}</span></td>
              <td class="num"><b>${m.tipo === 'Salida' ? '−' : m.tipo === 'Entrada' ? '+' : ''}${m.cantidad}</b></td><td class="sub">${esc(m.motivo || '—')}</td></tr>`).join('')}</tbody></table>`
            : vacio('Sin movimientos registrados', '', 'i-list'),
        });
      } else if (ed) formArticulo(buscar(ed.dataset.edit));
      else if (del) {
        const a = buscar(del.dataset.del);
        if (!(await C.confirmar(`¿Eliminar "${a.nombre}" y todo su historial de movimientos?`, { si: 'Eliminar', peligro: true }))) return;
        try { await api('/inventario/' + a.id, { method: 'DELETE' }); C.aviso('Artículo eliminado'); cargar(); } catch (err) { C.fallo(err); }
      }
    });
    await cargar();
  },
});
