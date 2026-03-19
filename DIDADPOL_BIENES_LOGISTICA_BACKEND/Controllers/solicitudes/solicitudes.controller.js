const {
  crearSolicitud,
  agregarDetalle,
  cambiarEstado,
  generarRegistroSalida
} = require('../../service/solicitudes-service');

const postSolicitud = async (req, res) => {
  try {
    const result = await crearSolicitud(req.body);
    return res.status(201).json({ ok: true, data: result });
  } catch (error) {
    return res.status(500).json({ ok: false, message: error.message });
  }
};

const postSolicitudDetalle = async (req, res) => {
  try {
    const id_solicitud = Number(req.params.id);

    const result = await agregarDetalle({
      id_solicitud,
      ...req.body
    });

    return res.status(201).json({ ok: true, data: result });
  } catch (error) {
    return res.status(500).json({ ok: false, message: error.message });
  }
};

const patchEstadoSolicitud = async (req, res) => {
  try {
    const id_solicitud = Number(req.params.id);

    const result = await cambiarEstado({
      id_solicitud,
      id_estado_nuevo: req.body.id_estado_nuevo,
      id_bodega_reserva: req.body.id_bodega_reserva,
      id_usuario: req.user.id_usuario,
      ip_origen: req.ip,
      observacion: req.body.observacion
    });

    return res.json({ ok: true, data: result });
  } catch (error) {
    return res.status(500).json({ ok: false, message: error.message });
  }
};

const postGenerarRegistro = async (req, res) => {
  try {
    const id_solicitud = Number(req.params.id);

    const result = await generarRegistroSalida({
      id_solicitud,
      id_usuario: req.user.id_usuario,
      id_bodega_origen: req.body.id_bodega_origen,
      ip_origen: req.ip
    });

    return res.json({ ok: true, data: result });
  } catch (error) {
    return res.status(500).json({ ok: false, message: error.message });
  }
};

module.exports = {
  postSolicitud,
  postSolicitudDetalle,
  patchEstadoSolicitud,
  postGenerarRegistro
};