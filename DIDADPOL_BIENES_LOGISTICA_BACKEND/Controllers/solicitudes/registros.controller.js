const {
  crearRegistro,
  agregarDetalle,
  confirmarRegistro,
  anularRegistro
} = require('../../service/registros-service');

const postRegistro = async (req, res) => {
  try {
    const payload = {
      id_tipo_registro: req.body.id_tipo_registro,
      id_usuario: req.user.id_usuario,
      id_empleado: req.body.id_empleado,
      id_solicitud: req.body.id_solicitud,
      id_documento: req.body.id_documento,
      id_bodega_origen: req.body.id_bodega_origen,
      id_bodega_destino: req.body.id_bodega_destino,
      referencia_externa: req.body.referencia_externa,
      observaciones: req.body.observaciones
    };

    const result = await crearRegistro(payload);
    return res.status(201).json({ ok: true, data: result });
  } catch (error) {
    return res.status(500).json({ ok: false, message: error.message });
  }
};

const postRegistroDetalle = async (req, res) => {
  try {
    const id_registro = Number(req.params.id);
    const payload = {
      id_registro,
      id_bien: req.body.id_bien,
      id_bien_item: req.body.id_bien_item,
      id_bien_lote: req.body.id_bien_lote,
      cantidad: req.body.cantidad,
      costo_unitario: req.body.costo_unitario,
      lote: req.body.lote,
      observacion: req.body.observacion
    };

    const result = await agregarDetalle(payload);
    return res.status(201).json({ ok: true, data: result });
  } catch (error) {
    return res.status(500).json({ ok: false, message: error.message });
  }
};

const postConfirmarRegistro = async (req, res) => {
  try {
    const id_registro = Number(req.params.id);
    const id_usuario = req.user.id_usuario;
    const ip_origen = req.ip;

    const result = await confirmarRegistro({ id_registro, id_usuario, ip_origen });
    return res.json({ ok: true, data: result });
  } catch (error) {
    return res.status(500).json({ ok: false, message: error.message });
  }
};

const postAnularRegistro = async (req, res) => {
  try {
    const id_registro = Number(req.params.id);
    const id_usuario = req.user.id_usuario;
    const ip_origen = req.ip;
    const motivo = req.body.motivo || null;

    const result = await anularRegistro({ id_registro, id_usuario, ip_origen, motivo });
    return res.json({ ok: true, data: result });
  } catch (error) {
    return res.status(500).json({ ok: false, message: error.message });
  }
};

module.exports = {
  postRegistro,
  postRegistroDetalle,
  postConfirmarRegistro,
  postAnularRegistro
};