const { Router } = require('express');
const { validarJWT } = require('../Middlewares/validar-jwt');
const { checkPermission } = require('../Middlewares/validar-permiso');

const {
  getStockCritico,
  getSolicitudesPorEstado,
  getBienesMasSolicitados,
  getInventarioValorizado,
  getReporteEjecutivoCompleto
} = require('../Controllers/solicitudes/reportes.controller');

const router = Router();

router.get(
  '/stock-critico',
  validarJWT,
  checkPermission('REPORTE_VER'),
  getStockCritico
);

router.get(
  '/solicitudes-estado',
  validarJWT,
  checkPermission('REPORTE_VER'),
  getSolicitudesPorEstado
);

router.get(
  '/bienes-mas-solicitados',
  validarJWT,
  checkPermission('REPORTE_VER'),
  getBienesMasSolicitados
);

router.get(
  '/inventario-valorizado',
  validarJWT,
  checkPermission('REPORTE_VER'),
  getInventarioValorizado
);

router.get(
  '/ejecutivo',
  validarJWT,
  checkPermission('REPORTE_VER'),
  getReporteEjecutivoCompleto
);

module.exports = router;