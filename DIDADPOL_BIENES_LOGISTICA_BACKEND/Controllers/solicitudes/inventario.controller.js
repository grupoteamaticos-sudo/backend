const { obtenerInventario } = require('../../service/inventario-service');

const getInventario = async (req, res) => {
  try {
    const filters = {
      id_bodega: req.query.id_bodega ? Number(req.query.id_bodega) : null,
      id_bien: req.query.id_bien ? Number(req.query.id_bien) : null
    };

    const data = await obtenerInventario(filters);

    return res.json({ ok: true, data });

  } catch (error) {
    return res.status(500).json({ ok: false, message: error.message });
  }
};

module.exports = {
  getInventario
};