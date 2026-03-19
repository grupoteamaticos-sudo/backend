const pool = require('../DB/db');

async function obtenerKardex({ id_bien = null, id_bodega = null, fecha_inicio = null, fecha_fin = null }) {

  let sql = `
    SELECT *
    FROM vw_kardex
    WHERE 1=1
  `;

  const params = [];
  let index = 1;

  if (id_bien) {
    sql += ` AND id_bien = $${index++}`;
    params.push(id_bien);
  }

  if (id_bodega) {
    sql += ` AND (id_bodega_origen = $${index} OR id_bodega_destino = $${index})`;
    params.push(id_bodega);
    index++;
  }

  if (fecha_inicio) {
    sql += ` AND fecha_registro >= $${index++}`;
    params.push(fecha_inicio);
  }

  if (fecha_fin) {
    sql += ` AND fecha_registro <= $${index++}`;
    params.push(fecha_fin);
  }

  sql += ` ORDER BY fecha_registro ASC`;

  const { rows } = await pool.query(sql, params);
  return rows;
}

module.exports = {
  obtenerKardex
};