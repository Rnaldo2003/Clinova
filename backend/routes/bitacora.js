// Rutas de BITÁCORA (MongoDB)  ->  /api/bitacora   (solo admin/superadmin)
const router = require('express').Router();
const Bitacora = require('../models/Bitacora');

// ?usuario_id=  ?metodo=POST  ?desde=AAAA-MM-DD  ?hasta=AAAA-MM-DD  ?limite=N (máx. 500)
router.get('/', async (req, res, next) => {
  try {
    const filtro = {};
    if (req.query.usuario_id) filtro.usuario_id = Number(req.query.usuario_id);
    if (req.query.metodo) filtro.metodo = String(req.query.metodo).toUpperCase();
    if (req.query.desde || req.query.hasta) {
      filtro.fecha = {};
      if (req.query.desde) filtro.fecha.$gte = new Date(req.query.desde);
      if (req.query.hasta) filtro.fecha.$lte = new Date(`${req.query.hasta}T23:59:59`);
    }
    const limite = Math.min(Number(req.query.limite) || 100, 500);
    res.json(await Bitacora.find(filtro).sort({ fecha: -1 }).limit(limite).lean());
  } catch (e) { next(e); }
});

module.exports = router;
