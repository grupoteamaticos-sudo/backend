const {
  stockCritico,
  solicitudesPorEstado,
  bienesMasSolicitados,
  inventarioValorizado
} = require('../../service/reportes-service');

const getStockCritico = async (req, res) => {
  try {
    const data = await stockCritico();
    res.json({ ok: true, data });
  } catch (error) {
    res.status(500).json({ ok: false, message: error.message });
  }
};

const getSolicitudesPorEstado = async (req, res) => {
  try {
    const data = await solicitudesPorEstado();
    res.json({ ok: true, data });
  } catch (error) {
    res.status(500).json({ ok: false, message: error.message });
  }
};

const getBienesMasSolicitados = async (req, res) => {
  try {
    const data = await bienesMasSolicitados();
    res.json({ ok: true, data });
  } catch (error) {
    res.status(500).json({ ok: false, message: error.message });
  }
};

const getInventarioValorizado = async (req, res) => {
  try {
    const data = await inventarioValorizado();
    res.json({ ok: true, data });
  } catch (error) {
    res.status(500).json({ ok: false, message: error.message });
  }
};

const {
  reporteEjecutivoCompleto
} = require('../../service/reportes-service');

const getReporteEjecutivoCompleto = async (req, res) => {
  try {
    const data = await reporteEjecutivoCompleto();
    res.json({ ok: true, data });
  } catch (error) {
    console.error(error);
    res.status(500).json({
      ok: false,
      message: 'Error al generar reporte ejecutivo'
    });
  }
};

module.exports = {
  getStockCritico,
  getSolicitudesPorEstado,
  getBienesMasSolicitados,
  getInventarioValorizado,
  getReporteEjecutivoCompleto
};

