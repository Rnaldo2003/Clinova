/* Configuración: mi perfil, usuarios del personal (admin) y bitácora (admin) */
C.vista('configuracion', {
  titulo: 'Configuración',
  async render(el, params) {
    const { api, esc, icono, avatar, vacio, fechaHora, hace, rolNombre, yo } = C;
    const admin = C.permisos.admin();
    let pestana = admin && ['usuarios', 'bitacora'].includes(params[0]) ? params[0] : 'perfil';

    el.innerHTML = `
      <div class="vhead"><div><h1>Configuración</h1><p>Tu cuenta${admin ? ', usuarios del personal y bitácora de actividad' : ''}</p></div></div>
      <div class="card">
        <div class="tabs">
          <button data-t="perfil">Mi perfil</button>
          ${admin ? '<button data-t="usuarios">Usuarios</button><button data-t="bitacora">Bitácora</button>' : ''}
        </div>
        <div id="ctab">${C.cargando()}</div>
      </div>`;

    async function perfil(box) {
      const yoData = await api('/auth/me');
      box.innerHTML = `<div class="ptop">${avatar(yoData.nombre, 'style="width:64px;height:64px;border-radius:18px;font-size:22px"')}
          <div><h2>${esc(yoData.nombre)}</h2><div class="meta">${esc(yoData.email)} · ${esc(rolNombre(yoData.rol))}${yoData.especialidad ? ' · ' + esc(yoData.especialidad) : ''}</div></div>
          <div class="acts"><button class="btn" id="cpass">${icono('i-lock')}Cambiar contraseña</button><button class="btn dan" id="csalir">${icono('i-logout')}Cerrar sesión</button></div></div>
        <div class="kv">
          <div><span>Rol</span><b>${esc(rolNombre(yoData.rol))}</b></div>
          <div><span>Especialidad</span><b>${esc(yoData.especialidad || '—')}</b></div>
          <div><span>Correo</span><b>${esc(yoData.email)}</b></div>
          <div><span>Clínica</span><b>Clínica San Pedro</b></div>
        </div>
        <div class="cb" style="padding:16px 20px"><p class="sub" style="margin:0">Para cambiar tu nombre, rol o especialidad, pídeselo a un administrador.</p></div>`;
      C.$('#csalir').onclick = C.salir;
      C.$('#cpass').onclick = () => C.formulario({
        titulo: 'Cambiar contraseña', tam: 'sm',
        campos: [
          { n: 'actual', l: 'Contraseña actual', t: 'password', req: true, full: true },
          { n: 'nueva', l: 'Nueva contraseña', t: 'password', req: true, full: true, hint: 'Mínimo 6 caracteres' },
          { n: 'repetir', l: 'Repite la nueva contraseña', t: 'password', req: true, full: true },
        ],
        textoBoton: 'Cambiar',
        async guardar(d) {
          if (d.nueva !== d.repetir) throw new Error('Las contraseñas nuevas no coinciden');
          await api('/auth/password', { method: 'PATCH', body: { actual: d.actual, nueva: d.nueva } });
          C.aviso('Contraseña actualizada');
        },
      });
    }

    async function usuarios(box) {
      const [lista, cat] = await Promise.all([api('/usuarios'), C.catalogos()]);
      const rolesOps = cat.roles.filter((r) => r.nombre !== 'superadmin' || yo.rol === 'superadmin').map((r) => [r.id, rolNombre(r.nombre)]);
      const espOps = cat.especialidades.map((e) => [e.id, e.nombre]);
      const campos = (nuevo) => [
        { n: 'nombres', l: 'Nombres', req: true },
        { n: 'apellidos', l: 'Apellidos', req: true },
        { n: 'email', l: 'Correo', t: 'email', req: true },
        { n: 'telefono', l: 'Teléfono', t: 'tel' },
        { n: 'rol_id', l: 'Rol', t: 'select', req: true, ops: rolesOps },
        { n: 'especialidad_id', l: 'Especialidad', t: 'select', vacio: 'Ninguna', ops: espOps, hint: 'Solo para médicos' },
        { n: 'colegiatura', l: 'N.º de colegiación', hint: 'Solo para médicos; sale en las recetas' },
        ...(nuevo ? [{ n: 'password', l: 'Contraseña inicial', t: 'password', req: true, hint: 'Mínimo 6 caracteres' }] : []),
      ];
      box.innerHTML = `<div class="toolbar"><span class="sub">${lista.length} usuarios</span>
          <button class="btn pri" id="unuevo" style="margin-left:auto">${icono('i-plus')}Nuevo usuario</button></div>
        <div class="tbl-wrap"><table class="tbl"><thead><tr><th>Usuario</th><th>Rol</th><th>Especialidad</th><th>Último acceso</th><th>Estado</th><th></th></tr></thead><tbody>
        ${lista.map((u) => {
          const n = u.nombres + ' ' + u.apellidos;
          return `<tr style="${u.activo ? '' : 'opacity:.55'}">
            <td><div class="who">${avatar(n)}<div><b>${esc(n)}${u.id === yo.id ? ' <span class="tag b-blue">Tú</span>' : ''}</b><span>${esc(u.email)}</span></div></div></td>
            <td>${esc(rolNombre(u.rol))}</td>
            <td class="sub">${esc(u.especialidad || '—')}${u.colegiatura ? `<div>${esc(u.colegiatura)}</div>` : ''}</td>
            <td class="sub">${u.ultimo_acceso ? hace(u.ultimo_acceso) : 'Nunca'}</td>
            <td>${u.activo ? '<span class="badge b-green">Activo</span>' : '<span class="badge b-grey">Inactivo</span>'}</td>
            <td class="acts">
              <button class="ibtn" title="Editar" data-edit="${u.id}">${icono('i-edit')}</button>
              <button class="ibtn" title="Restablecer contraseña" data-pass="${u.id}">${icono('i-lock')}</button>
              ${u.id !== yo.id ? `<button class="btn sm ${u.activo ? 'dan' : ''}" data-act="${u.id}" data-v="${u.activo ? 0 : 1}">${u.activo ? 'Desactivar' : 'Activar'}</button>` : ''}
            </td></tr>`;
        }).join('')}</tbody></table></div>`;

      C.$('#unuevo').onclick = () => C.formulario({
        titulo: 'Nuevo usuario', campos: campos(true), valores: { rol_id: 3 }, textoBoton: 'Crear usuario',
        async guardar(d) { await api('/auth/register', { method: 'POST', body: d }); C.aviso('Usuario creado'); usuarios(box); },
      });
      box.querySelector('table').addEventListener('click', async (e) => {
        const ed = e.target.closest('[data-edit]'), pw = e.target.closest('[data-pass]'), ac = e.target.closest('[data-act]');
        const u = lista.find((x) => String(x.id) === (ed || pw || ac || {}).dataset?.[ed ? 'edit' : pw ? 'pass' : 'act']);
        if (ed && u) C.formulario({
          titulo: 'Editar usuario', campos: campos(false), valores: u,
          async guardar(d) { await api('/usuarios/' + u.id, { method: 'PUT', body: d }); C.aviso('Usuario actualizado'); usuarios(box); },
        });
        if (pw && u) C.formulario({
          titulo: 'Nueva contraseña · ' + u.nombres, tam: 'sm',
          campos: [{ n: 'password', l: 'Nueva contraseña', t: 'password', req: true, full: true, hint: 'Mínimo 6 caracteres. Compártela con el usuario.' }],
          textoBoton: 'Restablecer',
          async guardar(d) { await api(`/usuarios/${u.id}/password`, { method: 'PATCH', body: d }); C.aviso('Contraseña restablecida'); },
        });
        if (ac && u) {
          const activar = ac.dataset.v === '1';
          if (!activar && !(await C.confirmar(`¿Desactivar a ${u.nombres} ${u.apellidos}? Ya no podrá iniciar sesión.`, { si: 'Desactivar', peligro: true }))) return;
          try { await api(`/usuarios/${u.id}/activo`, { method: 'PATCH', body: { activo: activar } }); C.aviso(activar ? 'Usuario activado' : 'Usuario desactivado'); usuarios(box); }
          catch (err) { C.fallo(err); }
        }
      });
    }

    async function bitacora(box) {
      const [regs, us] = await Promise.all([api('/bitacora?limite=200').catch((e) => e), api('/usuarios')]);
      if (regs instanceof Error) { box.innerHTML = vacio('Bitácora no disponible', regs.status === 503 ? 'MongoDB no está corriendo.' : regs.message, 'i-list'); return; }
      const nom = Object.fromEntries(us.map((u) => [u.id, u.nombres + ' ' + u.apellidos]));
      const ACCION = { POST: ['Creó', 'b-green'], PUT: ['Editó', 'b-blue'], PATCH: ['Cambió', 'b-purple'], DELETE: ['Eliminó', 'b-red'] };
      const QUE = (r) => {
        const m = r.ruta.replace('/api/', '').split('/');
        const mapa = { auth: m[1] === 'login' ? 'Inicio de sesión' : m[1] === 'password' ? 'Contraseña' : 'Usuario', pacientes: m[2] === 'signos' ? 'Signos vitales' : 'Paciente', citas: m[2] === 'estado' ? 'Estado de cita' : 'Cita', consultas: 'Consulta', recetas: 'Receta', inventario: m[2] === 'movimiento' ? 'Movimiento de inventario' : 'Inventario', mensajes: 'Mensaje', notificaciones: 'Notificación', usuarios: 'Usuario' };
        return (mapa[m[0]] || m[0]) + (m[1] && /^\d+$/.test(m[1]) ? ' #' + m[1] : '');
      };
      box.innerHTML = `<div class="toolbar"><span class="sub">Últimas ${regs.length} acciones que cambiaron datos (se guarda en MongoDB)</span></div>
        <div class="tbl-wrap"><table class="tbl"><thead><tr><th>Fecha</th><th>Usuario</th><th>Acción</th><th>Sobre</th><th>Resultado</th></tr></thead><tbody>
        ${regs.map((r) => {
          const [acc, cls] = r.ruta === '/api/auth/login' ? ['Entró', 'b-blue'] : ACCION[r.metodo] || [r.metodo, 'b-grey'];
          const ok = r.status < 400;
          return `<tr><td style="white-space:nowrap">${fechaHora(r.fecha)}</td>
            <td>${r.usuario_id ? esc(nom[r.usuario_id] || 'Usuario #' + r.usuario_id) : '<span class="sub">Sin sesión</span>'}${r.rol ? `<div class="sub">${esc(rolNombre(r.rol))}</div>` : ''}</td>
            <td><span class="badge ${cls}">${acc}</span></td>
            <td>${esc(QUE(r))}<div class="sub">${esc(r.metodo)} ${esc(r.ruta)}</div></td>
            <td>${ok ? '<span class="badge b-green">Correcto</span>' : `<span class="badge b-red">Error ${r.status}</span>`}</td></tr>`;
        }).join('')}</tbody></table></div>`;
    }

    const pintar = async () => {
      C.$$('.tabs button').forEach((b) => b.classList.toggle('on', b.dataset.t === pestana));
      history.replaceState(null, '', '#/configuracion' + (pestana === 'perfil' ? '' : '/' + pestana));
      const box = C.$('#ctab');
      box.innerHTML = C.cargando();
      try { await ({ perfil, usuarios, bitacora })[pestana](box); } catch (e) { box.innerHTML = vacio('No se pudo cargar', e.message, 'i-alert'); }
    };
    C.$('.tabs').addEventListener('click', (e) => { const b = e.target.closest('button'); if (b) { pestana = b.dataset.t; pintar(); } });
    await pintar();
  },
});
