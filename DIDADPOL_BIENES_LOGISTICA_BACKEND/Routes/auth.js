const { Router } = require('express');
const { check } = require('express-validator');

const {
  validarJWT,
  validarCampos
} = require('../Middlewares');

const {
  login,
  userRegister,
  forgotPassword,
  recoverPassword,
  contactMessage,
  auditAccess,
  logout,
  verifyOtp
} = require('../Controllers/solicitudes/auth.controller');

const router = Router();

/**
 * AUTH
 * Base: /api/auth
 */

// LOGIN PASO 1
router.post('/login', [
  check('username', 'El usuario es obligatorio').not().isEmpty().isLength({ min: 2 }),
  check('password', 'La contraseña es obligatoria').not().isEmpty(),
  validarCampos
], login);

// VERIFICAR OTP LOGIN
router.post('/verify-otp', [
  check('tempToken', 'tempToken es obligatorio').not().isEmpty(),
  check('code', 'El código OTP es obligatorio').not().isEmpty().isLength({ min: 6, max: 6 }),
  validarCampos
], verifyOtp);

// REGISTRO
router.post('/register', [
  validarJWT,
  check('id_empleado', 'El empleado es obligatorio').not().isEmpty(),
  check('username', 'El username es obligatorio').not().isEmpty().isLength({ min: 3 }),
  check('password', 'La contraseña es obligatoria').not().isEmpty().isLength({ min: 8 }),
  check('correo', 'El correo es obligatorio').not().isEmpty().isEmail(),
  validarCampos
], userRegister);

// RECUPERACIÓN PASO 1
router.post('/forgot-password', [
  check('identifier', 'El usuario o correo es obligatorio').not().isEmpty(),
  validarCampos
], forgotPassword);

// RECUPERACIÓN PASO 2
router.post('/recover-password', [
  check('tempToken', 'tempToken es obligatorio').not().isEmpty(),
  check('code', 'El código OTP es obligatorio').not().isEmpty().isLength({ min: 6, max: 6 }),
  check('newPassword', 'La nueva contraseña es obligatoria').not().isEmpty().isLength({ min: 8 }),
  check('passwordConfirm', 'Confirmar la contraseña es obligatorio').not().isEmpty().isLength({ min: 8 }),
  validarCampos
], recoverPassword);

// CONTACTO
router.post('/contact', [
  check('email', 'El correo electrónico es obligatorio').not().isEmpty().isEmail(),
  check('name', 'El nombre es obligatorio').not().isEmpty().isLength({ min: 2 }),
  check('subject', 'El asunto es obligatorio').not().isEmpty().isLength({ min: 2 }),
  check('message', 'El mensaje es obligatorio').not().isEmpty().isLength({ min: 2 }),
  validarCampos
], contactMessage);

// AUDITORÍA DE ACCESO
router.post('/audit-access/:screenName', [
  validarJWT,
  check('screenName', 'screenName es obligatorio').not().isEmpty().isLength({ min: 2 }),
  validarCampos
], auditAccess);

// LOGOUT
router.delete('/logout', [validarJWT], logout);

module.exports = router;