const { Router } = require('express');
const { validarJWT } = require('../Middlewares/validar-jwt');
const { checkPermission } = require('../Middlewares/validar-permiso');

const {
  postAsignacion,
  postDevolverAsignacion
} = require('../Controllers/solicitudes/asignaciones.controller');

const router = Router();

router.post(
  '/',
  validarJWT,
  checkPermission('ASIGNAR_BIEN'),
  postAsignacion
);

router.post(
  '/:id/devolver',
  validarJWT,
  checkPermission('DEVOLVER_BIEN'),
  postDevolverAsignacion
);

module.exports = router;