const { Router } = require('express');
const { validarJWT } = require('../Middlewares/validar-jwt');
const { checkPermission } = require('../Middlewares/validar-permiso');

const { getInventario } = require('../Controllers/solicitudes/inventario.controller');

const router = Router();

/**
 * BASE: /api/inventario
 */

router.get(
  '/',
  validarJWT,
  checkPermission('INVENTARIO_VER'),
  getInventario
);

module.exports = router;