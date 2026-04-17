const {
  listarPersonas,
  crearPersona
} = require('../../service/personas-service');

const getPersonas = async (req, res) => {
  try {
    const data = await listarPersonas();
    res.json({ ok: true, data });
  } catch (error) {
    res.status(500).json({ ok: false, msg: error.message });
  }
};

const postPersona = async (req, res) => {
  try {
    const payload = {
      ...req.body,
      id_usuario_accion: req.usuario?.id_usuario || null,
      ip_origen: req.ip
    };

    await crearPersona(payload);

    res.status(201).json({
      ok: true,
      msg: 'Persona creada correctamente'
    });

  } catch (error) {
    res.status(500).json({
      ok: false,
      msg: error.message
    });
  }
};
 // fin del archivo 
module.exports = {
  getPersonas,
  postPersona
};