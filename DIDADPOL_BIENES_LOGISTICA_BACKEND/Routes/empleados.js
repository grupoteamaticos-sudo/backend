const { Router } = require('express');
const { validarJWT } = require('../Middlewares/validar-jwt');
const { checkPermission } = require('../Middlewares/validar-permiso');
const { soloAdmin } = require('../Middlewares/validar-rol');

const {
  getEmpleados,
  postEmpleado
} = require('../Controllers/solicitudes/empleados.controller');

const router = Router();

router.get(
  '/',
  validarJWT,
  checkPermission('EMPLEADO_VER'),
  getEmpleados
);

router.post(
  '/',
  validarJWT,
  soloAdmin,
  checkPermission('EMPLEADO_CREAR'),
  postEmpleado
);

module.exports = router;