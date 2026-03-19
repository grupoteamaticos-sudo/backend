const {
  reservar,
  liberar,
  consumir
} = require('../../service/reservas-service');

const postReservar = async (req, res) => {
  try {
    const result = await reservar(req.body);
    return res.status(201).json({ ok: true, data: result });
  } catch (error) {
    return res.status(500).json({ ok: false, message: error.message });
  }
};

const patchLiberar = async (req, res) => {
  try {
    const result = await liberar(req.body);
    return res.json({ ok: true, data: result });
  } catch (error) {
    return res.status(500).json({ ok: false, message: error.message });
  }
};

const patchConsumir = async (req, res) => {
  try {
    const result = await consumir(req.body);
    return res.json({ ok: true, data: result });
  } catch (error) {
    return res.status(500).json({ ok: false, message: error.message });
  }
};

module.exports = {
  postReservar,
  patchLiberar,
  patchConsumir
};