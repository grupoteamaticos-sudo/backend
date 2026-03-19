const { obtenerKardex } = require('../../service/kardex-service');

const getKardex = async (req, res) => {
  try {
    const filters = {
      id_bien: req.query.id_bien ? Number(req.query.id_bien) : null,
      id_bodega: req.query.id_bodega ? Number(req.query.id_bodega) : null,
      fecha_inicio: req.query.fecha_inicio || null,
      fecha_fin: req.query.fecha_fin || null
    };

    const data = await obtenerKardex(filters);

    return res.json({ ok: true, data });

  } catch (error) {
    return res.status(500).json({ ok: false, message: error.message });
  }
};

module.exports = {
  getKardex
};