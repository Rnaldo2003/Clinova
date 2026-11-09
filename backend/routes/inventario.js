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
    const [r] = await pool.query(
      `INSERT INTO inventario (clinica_id, nombre, tipo, existencia, stock_minimo, lote, vencimiento, proveedor)
       VALUES (?,?,?,?,?,?,?,?)`,
      [b.clinica_id || 1, b.nombre, b.tipo || 'Medicamento', b.existencia || 0,
       b.stock_minimo || 0, b.lote || null, b.vencimiento || null, b.proveedor || null]
    );
    res.status(201).json({ id: r.insertId, mensaje: 'Artículo creado' });
  } catch (e) { next(e); }
});

// Registrar movimiento (Entrada/Salida/Ajuste) y actualizar existencia
router.post('/:id/movimiento', async (req, res, next) => {
  const conn = await pool.getConnection();
  try {
    const { tipo, cantidad, motivo } = req.body; // tipo: Entrada | Salida | Ajuste
    await conn.beginTransaction();
    await conn.query(
      'INSERT INTO movimientos_inventario (inventario_id, tipo, cantidad, motivo) VALUES (?,?,?,?)',
      [req.params.id, tipo, cantidad, motivo || null]
    );
    const signo = tipo === 'Salida' ? '-' : '+';
    await conn.query(
      `UPDATE inventario SET existencia = existencia ${signo} ? WHERE id = ?`,
      [Math.abs(cantidad), req.params.id]
    );
    await conn.commit();
    res.json({ mensaje: 'Movimiento registrado' });
  } catch (e) {
    await conn.rollback();
    next(e);
  } finally {
    conn.release();
  }
});

module.exports = router;
