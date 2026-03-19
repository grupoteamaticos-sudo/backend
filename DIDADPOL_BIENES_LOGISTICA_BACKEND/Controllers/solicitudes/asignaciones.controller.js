const {
  crearAsignacion,
  devolverAsignacion
} = require('../../service/asignaciones-service');

const postAsignacion = async (req, res) => {
  try {
    const payload = {
      ...req.body,
      id_usuario: req.user.id_usuario,
      ip_origen: req.ip
    };

    const result = await crearAsignacion(payload);
    res.status(201).json({ ok: true, data: result });

  } catch (error) {
    res.status(500).json({ ok: false, message: error.message });
  }
};

const postDevolverAsignacion = async (req, res) => {
  try {
    const payload = {
      ...req.body,
      id_asignacion: Number(req.params.id),
      id_usuario: req.user.id_usuario,
      ip_origen: req.ip
    };

    const result = await devolverAsignacion(payload);
    res.json({ ok: true, data: result });

  } catch (error) {
    res.status(500).json({ ok: false, message: error.message });
  }
};

module.exports = {
  postAsignacion,
  postDevolverAsignacion
};