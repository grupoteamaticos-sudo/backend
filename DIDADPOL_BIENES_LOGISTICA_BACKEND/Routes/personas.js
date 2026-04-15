const { Router } = require('express');
const {
  getPersonas,
  postPersona
} = require('../Controllers/solicitudes/personas.controller');

const { validarJWT } = require('../Middlewares/validar-jwt');

const router = Router();

router.get('/', validarJWT, getPersonas);
router.post('/', validarJWT, postPersona);

module.exports = router;