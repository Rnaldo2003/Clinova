// Rutas de INVENTARIO  ->  /api/inventario
const router = require('express').Router();
const pool = require('../db');

// Listar inventario. ?bajo=1 devuelve solo lo que está por debajo del stock mínimo
router.get('/', async (req, res, next) => {
  try {
    const soloBajo = req.query.bajo === '1' ? 'WHERE existencia <= stock_minimo' : '';
    const [rows] = await pool.query(
      `SELECT id, nombre, tipo, existencia, stock_minimo, lote, vencimiento, proveedor
         FROM inventario ${soloBajo} ORDER BY nombre`
    );
    res.json(rows);
  } catch (e) { next(e); }
});

// Crear artículo de inventario
router.post('/', async (req, res, next) => {
  try {
    const b = req.body;
    if (!b.nombre) return res.status(400).json({ error: 'nombre es obligatorio' });
    if (Number(b.existencia) < 0 || Number(b.stock_minimo) < 0) {
      return res.status(400).json({ error: 'existencia y stock_minimo no pueden ser negativos' });
    }
    const [r] = await pool.query(
      `INSERT INTO inventario (clinica_id, nombre, tipo, existencia, stock_minimo, lote, vencimiento, proveedor)
       VALUES (?,?,?,?,?,?,?,?)`,
      [b.clinica_id || 1, b.nombre, b.tipo || 'Medicamento', b.existencia || 0,
       b.stock_minimo || 0, b.lote || null, b.vencimiento || null, b.proveedor || null]
    );
    res.status(201).json({ id: r.insertId, mensaje: 'Artículo creado' });
  } catch (e) { next(e); }
});

// Registrar movimiento y actualizar existencia.
//   Entrada: suma `cantidad` (positiva)      Salida: resta `cantidad` (positiva)
//   Ajuste:  `cantidad` es la corrección, puede ser negativa (ej. -3 por merma)
// Nunca deja la existencia por debajo de 0.
router.post('/:id/movimiento', async (req, res, next) => {
  const { tipo, motivo } = req.body;
  const cantidad = Number(req.body.cantidad);

  if (!['Entrada', 'Salida', 'Ajuste'].includes(tipo)) {
    return res.status(400).json({ error: 'tipo debe ser Entrada, Salida o Ajuste' });
  }
  if (!Number.isInteger(cantidad) || cantidad === 0 || (tipo !== 'Ajuste' && cantidad < 0)) {
    return res.status(400).json({ error: 'cantidad debe ser un número entero (positivo para Entrada/Salida)' });
  }
  const delta = tipo === 'Salida' ? -cantidad : cantidad;

  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    // FOR UPDATE bloquea la fila para que dos salidas simultáneas no se pisen
    const [rows] = await conn.query('SELECT existencia FROM inventario WHERE id = ? FOR UPDATE', [req.params.id]);
    if (!rows.length) {
      await conn.rollback();
      return res.status(404).json({ error: 'Artículo no encontrado' });
    }
    const nueva = rows[0].existencia + delta;
    if (nueva < 0) {
      await conn.rollback();
      return res.status(400).json({ error: `Stock insuficiente: hay ${rows[0].existencia}` });
    }
    await conn.query(
      'INSERT INTO movimientos_inventario (inventario_id, tipo, cantidad, motivo) VALUES (?,?,?,?)',
      [req.params.id, tipo, cantidad, motivo || null]
    );
    await conn.query('UPDATE inventario SET existencia = ? WHERE id = ?', [nueva, req.params.id]);
    await conn.commit();
    res.json({ mensaje: 'Movimiento registrado', existencia: nueva });
  } catch (e) {
    await conn.rollback();
    next(e);
  } finally {
    conn.release();
  }
});

module.exports = router;
