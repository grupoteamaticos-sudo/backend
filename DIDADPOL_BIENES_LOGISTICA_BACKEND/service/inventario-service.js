const pool = require('../DB/db');

async function obtenerInventario({ id_bodega = null, id_bien = null }) {

  let sql = `
    SELECT 
      i.id_inventario,
      i.id_bodega,
      bodega.nombre_bodega,
      i.id_bien,
      bien.nombre_bien,
      i.stock_actual,
      i.stock_reservado,
      i.stock_minimo,
      i.estado_inventario
    FROM inventario i
    JOIN bodega ON bodega.id_bodega = i.id_bodega
    JOIN bien ON bien.id_bien = i.id_bien
    WHERE 1=1
  `;

  const params = [];
  let index = 1;

  if (id_bodega) {
    sql += ` AND i.id_bodega = $${index++}`;
    params.push(id_bodega);
  }

  if (id_bien) {
    sql += ` AND i.id_bien = $${index++}`;
    params.push(id_bien);
  }

  sql += ` ORDER BY bodega.nombre_bodega, bien.nombre_bien`;

  const { rows } = await pool.query(sql, params);
  return rows;
}

module.exports = {
  obtenerInventario
};