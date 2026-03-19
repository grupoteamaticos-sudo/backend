const { Router } = require('express');
const { validarJWT } = require('../Middlewares/validar-jwt');
const { checkPermission } = require('../Middlewares/validar-permiso');
const { soloAdmin, soloSuperAdmin } = require('../Middlewares/validar-rol');

const {
  getRoles,
  getRol,
  postRol,
  patchRol,
  deleteRol,
  postPermisoToRol,
  deletePermisoFromRol
} = require('../Controllers/solicitudes/roles.controller');

const router = Router();

/**
 * BASE: /api/roles
 */

router.get('/', validarJWT, soloAdmin, checkPermission('ROL_VER'), getRoles);
router.get('/:id', validarJWT, soloAdmin, checkPermission('ROL_VER'), getRol);
router.post('/', validarJWT, soloAdmin, checkPermission('ROL_CREAR'), postRol);
router.patch('/:id', validarJWT, soloAdmin, checkPermission('ROL_EDITAR'), patchRol);
router.delete('/:id', validarJWT, soloSuperAdmin, checkPermission('ROL_ELIMINAR'), deleteRol);
router.post('/:id/permisos', validarJWT, soloAdmin, checkPermission('ROL_ASIGNAR_PERMISO'), postPermisoToRol);
router.delete('/:id/permisos', validarJWT, soloAdmin, checkPermission('ROL_QUITAR_PERMISO'), deletePermisoFromRol);

module.exports = router;