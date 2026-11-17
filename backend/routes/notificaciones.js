// Rutas de NOTIFICACIONES (MongoDB)  ->  /api/notificaciones
// Cada usuario solo ve y modifica SUS notificaciones (el id sale del token).
const router = require('express').Router();
const mongoose = require('mongoose');
const Notificacion = require('../models/Notificacion');

// Lista. ?no_leidas=1 para solo las pendientes. ?limite=N (máx. 100)
router.get('/', async (req, res, next) => {
  try {
    const filtro = { usuario_id: req.usuario.id };
    if (req.query.no_leidas === '1') filtro.leida = false;
    const limite = Math.min(Number(req.query.limite) || 50, 100);
    res.json(await Notificacion.find(filtro).sort({ creado_en: -1 }).limit(limite).lean());
  } catch (e) { next(e); }
});

// Número de no leídas (para el globito de la campana)
router.get('/conteo', async (req, res, next) => {
  try {
    res.json({ no_leidas: await Notificacion.countDocuments({ usuario_id: req.usuario.id, leida: false }) });
  } catch (e) { next(e); }
});

// Marcar todas como leídas
router.patch('/leer-todas', async (req, res, next) => {
  try {
    const r = await Notificacion.updateMany({ usuario_id: req.usuario.id, leida: false }, { $set: { leida: true } });
    res.json({ mensaje: 'Notificaciones marcadas como leídas', actualizadas: r.modifiedCount });
  } catch (e) { next(e); }
});

// Marcar una como leída
router.patch('/:id/leida', async (req, res, next) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) return res.status(400).json({ error: 'id inválido' });
    const n = await Notificacion.findOneAndUpdate(
      { _id: req.params.id, usuario_id: req.usuario.id }, { $set: { leida: true } }, { new: true });
    if (!n) return res.status(404).json({ error: 'Notificación no encontrada' });
    res.json(n);
  } catch (e) { next(e); }
});

// Borrar una
router.delete('/:id', async (req, res, next) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) return res.status(400).json({ error: 'id inválido' });
    const r = await Notificacion.deleteOne({ _id: req.params.id, usuario_id: req.usuario.id });
    if (!r.deletedCount) return res.status(404).json({ error: 'Notificación no encontrada' });
    res.json({ mensaje: 'Notificación eliminada' });
  } catch (e) { next(e); }
});

module.exports = router;
