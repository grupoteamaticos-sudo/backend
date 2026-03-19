const { Router } = require('express');
const { validarJWT } = require('../Middlewares/validar-jwt');
const { checkPermission } = require('../Middlewares/validar-permiso');

const { getKardex } = require('../Controllers/solicitudes/kardex.controller');

const router = Router();

/**
 * BASE: /api/kardex
 */

router.get(
  '/',
  validarJWT,
  checkPermission('KARDEX_VER'),
  getKardex
);

module.exports = router;