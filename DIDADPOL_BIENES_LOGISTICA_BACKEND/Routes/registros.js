const { Router } = require('express');
const { validarJWT } = require('../Middlewares/validar-jwt');
const { checkPermission } = require('../Middlewares/validar-permiso');
const { soloLogistica } = require('../Middlewares/validar-rol');

const {
  postRegistro,
  postRegistroDetalle,
  postConfirmarRegistro,
  postAnularRegistro
} = require('../Controllers/solicitudes/registros.controller');

const router = Router();

// Crear registro
router.post(
  '/',
  validarJWT,
  soloLogistica,
  checkPermission('REGISTRO_CREAR'),
  postRegistro
);

// Agregar detalle al registro
router.post(
  '/:id/detalles',
  validarJWT,
  soloLogistica,
  checkPermission('REGISTRO_CREAR'),
  postRegistroDetalle
);

// Confirmar registro (afecta inventario)
router.post(
  '/:id/confirmar',
  validarJWT,
  soloLogistica,
  checkPermission('REGISTRO_CONFIRMAR'),
  postConfirmarRegistro
);

// Anular registro (revertir inventario)
router.post(
  '/:id/anular',
  validarJWT,
  soloLogistica,
  checkPermission('REGISTRO_ANULAR'),
  postAnularRegistro
);

module.exports = router;