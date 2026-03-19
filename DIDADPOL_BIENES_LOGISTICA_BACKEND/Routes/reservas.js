const { Router } = require('express');
const { validarJWT } = require('../Middlewares/validar-jwt');
const { checkPermission } = require('../Middlewares/validar-permiso');

const {
  postReservar,
  patchLiberar,
  patchConsumir
} = require('../Controllers/solicitudes/reservas.controller');

const router = Router();

router.post(
  '/',
  validarJWT,
  checkPermission('RESERVA_CREAR'),
  postReservar
);

router.patch(
  '/liberar',
  validarJWT,
  checkPermission('RESERVA_EDITAR'),
  patchLiberar
);

router.patch(
  '/consumir',
  validarJWT,
  checkPermission('RESERVA_EDITAR'),
  patchConsumir
);

module.exports = router;