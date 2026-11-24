/* Inicio: resumen del día con datos reales de la API */
C.vista('inicio', {
  titulo: 'Inicio',
  async render(el) {
    const { api, esc, icono, avatar, hora, hace, vacio, badgeEstado, yo, fechaLarga, hoyISO } = C;
    const [res, agenda, semana, tipos, convs] = await Promise.all([
      api('/dashboard/resumen'),
      api('/dashboard/agenda-hoy'),
      api('/dashboard/semana'),
      api('/dashboard/tipos-consulta'),
      api('/mensajes').catch(() => null),
    ]);

    const h = new Date().getHours();
    const saludo = h < 12 ? 'Buenos días' : h < 19 ? 'Buenas tardes' : 'Buenas noches';
    const nombre = yo.rol === 'medico' ? 'Dr. ' + yo.nombre.split(' ')[0] : yo.nombre.split(' ')[0];
    const siguiente = agenda.find((c) => ['En espera', 'Confirmada', 'Pendiente'].includes(c.estado));

    const stat = (n, l, ic, col, ruta) =>
      `<a class="stat" href="#/${ruta}" style="text-decoration:none;color:inherit"><div class="ico ${col}">${icono(ic)}</div><div><div class="n">${n}</div><div class="l">${l}</div></div><div class="arr">${icono('i-chev')}</div></a>`;

    // Gráfica de barras de los últimos 7 días
    const dias = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date(); d.setDate(d.getDate() - i);
      const iso = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
      const fila = semana.find((s) => s.fecha === iso) || { total: 0, atendidas: 0 };
      dias.push({ et: ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'][d.getDay()], total: +fila.total, atendidas: +fila.atendidas, hoy: iso === hoyISO() });
    }
    const max = Math.max(1, ...dias.map((d) => d.total));
    const barras = dias.map((d) => `<div class="colb" title="${d.total} citas, ${d.atendidas} atendidas">
        <span class="xl" style="font-weight:700;color:var(--ink-2)">${d.total || ''}</span>
        <div class="bar ${d.hoy ? 'full' : ''}" style="height:${Math.max(4, (d.total / max) * 120)}px"></div>
        <span class="xl">${d.et}</span></div>`).join('');

    // Dona de tipos de consulta de hoy
    const COL = ['#1796f4', '#16a864', '#c9871f', '#8b5cf6', '#e3574e', '#93a1b2'];
    const totalT = tipos.reduce((a, t) => a + t.total, 0);
    let acc = 0;
    const segs = tipos.map((t, i) => {
      const ini = (acc / totalT) * 100; acc += t.total;
      return `${COL[i % COL.length]} ${ini}% ${(acc / totalT) * 100}%`;
    }).join(',');

    el.innerHTML = `
      <div class="head">
        <div><h1>${saludo}, ${esc(nombre)}</h1><p>Aquí está el resumen de su día.</p></div>
        <div class="when">${fechaLarga(new Date())}</div>
      </div>

      <section class="stats s5">
        ${stat(res.pacientes_hoy, 'Citas hoy', 'i-users', 'i-blue', 'agenda')}
        ${stat(res.en_espera, 'En sala de espera', 'i-follow', 'i-amber', 'agenda')}
        ${stat(res.atendidas, 'Atendidas', 'i-check', 'i-green', 'agenda')}
        ${stat(res.mensajes, 'Mensajes sin leer', 'i-msg', 'i-purple', 'mensajes')}
        ${stat(res.stock_bajo, 'Stock bajo', 'i-box', 'i-red', 'inventario/bajo')}
      </section>

      <div class="two">
        <div class="card">
          <div class="ch"><h3>${icono('i-cal')}Agenda de hoy</h3><a class="link" href="#/agenda">Ver agenda ${icono('i-chev')}</a></div>
          <div class="cb">
            ${agenda.length ? agenda.map((c) => `
              <a class="appt" href="#/expediente/${c.paciente_id}" style="text-decoration:none;color:inherit">
                <div class="time">${hora(c.hora_inicio)}</div>
                ${avatar(c.paciente)}
                <div class="who"><b>${esc(c.paciente)}</b><span>${esc(c.tipo)} · ${c.edad ?? '—'} años</span></div>
                ${badgeEstado(c.estado)}
              </a>`).join('') : vacio('No hay citas para hoy', 'Agenda una desde la sección Agenda.', 'i-cal')}
          </div>
        </div>

        <div class="col">
          ${siguiente ? `
          <div class="card" style="background:linear-gradient(135deg,#5fb6f2,#2f6db0);color:#fff;border:0">
            <div class="cb" style="padding:18px">
              <div style="font-size:12.5px;opacity:.85">Siguiente paciente · ${hora(siguiente.hora_inicio)}</div>
              <div style="font-size:19px;font-weight:800;margin:3px 0">${esc(siguiente.paciente)}</div>
              <div style="font-size:13px;opacity:.9">${esc(siguiente.tipo)}${siguiente.motivo ? ' · ' + esc(siguiente.motivo) : ''} · ${siguiente.edad ?? '—'} años</div>
              <div style="display:flex;gap:8px;margin-top:14px;flex-wrap:wrap">
                <a class="btn sm" style="background:#fff;color:var(--brand-ink);border:0" href="#/expediente/${siguiente.paciente_id}">Ver expediente</a>
                ${C.permisos.clinico() ? `<a class="btn sm" style="background:rgba(255,255,255,.2);color:#fff;border:0" href="#/consultas/nueva/${siguiente.paciente_id}/${siguiente.id}">${icono('i-steth')}Atender</a>` : ''}
              </div>
            </div>
          </div>` : ''}

          <div class="card">
            <div class="ch"><h3>${icono('i-msg')}Mensajes recientes</h3><a class="link" href="#/mensajes">Ver todos ${icono('i-chev')}</a></div>
            <div class="cb">
              ${convs === null ? vacio('Mensajes no disponibles', 'MongoDB no está corriendo.', 'i-msg')
                : convs.length ? convs.slice(0, 4).map((m) => `
                <a class="msg" href="#/mensajes/${m.paciente_id}" style="text-decoration:none;color:inherit">
                  ${avatar(m.paciente)}
                  <div class="mt"><div class="r"><b>${esc(m.paciente)}</b><time>${hace(m.ultima_fecha)}</time></div>
                  <p>${m.ultimo_autor === 'usuario' ? 'Tú: ' : ''}${esc(m.ultimo_texto)}</p></div>
                  ${m.no_leidos ? '<span class="unread"></span>' : ''}
                </a>`).join('') : vacio('Sin mensajes', '', 'i-msg')}
            </div>
          </div>
        </div>
      </div>

      <section class="charts">
        <div class="card">
          <div class="ch"><h3>${icono('i-bars')}Citas de los últimos 7 días</h3></div>
          <div class="cb"><div class="bars" style="height:170px">${barras}</div></div>
        </div>
        <div class="card">
          <div class="ch"><h3>${icono('i-steth')}Tipos de consulta de hoy</h3></div>
          <div class="cb">
            ${totalT ? `<div class="donut-wrap">
              <div class="donut" style="background:conic-gradient(${segs});border-radius:50%">
                <div class="mid" style="inset:22px;background:var(--surface);border-radius:50%;position:absolute"><div><b>${totalT}</b><br><span>citas</span></div></div>
              </div>
              <div class="legend">${tipos.map((t, i) => `<div class="lg"><span class="sw" style="background:${COL[i % COL.length]}"></span>${esc(t.tipo)}<b>${t.total}</b><span class="pc">${Math.round((t.total / totalT) * 100)}%</span></div>`).join('')}</div>
            </div>` : vacio('Sin citas hoy', '', 'i-steth')}
          </div>
        </div>
      </section>`;
  },
});
