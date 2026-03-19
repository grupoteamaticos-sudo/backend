const pool = require('../DB/db');

// REPORTE 1 — Stock crítico
async function stockCritico() {
  const { rows } = await pool.query(`
    SELECT 
      b.nombre_bodega,
      bi.nombre_bien,
      i.stock_actual,
      i.stock_minimo,
      i.stock_reservado
    FROM inventario i
    JOIN bodega b ON b.id_bodega = i.id_bodega
    JOIN bien bi ON bi.id_bien = i.id_bien
    WHERE i.stock_minimo IS NOT NULL
      AND i.stock_actual <= i.stock_minimo
    ORDER BY b.nombre_bodega, bi.nombre_bien
  `);

  return rows;
}

// REPORTE 2 — Solicitudes por Estado
async function solicitudesPorEstado() {
  const { rows } = await pool.query(`
    SELECT 
      es.nombre_estado,
      COUNT(sl.id_solicitud) AS total
    FROM estado_solicitud es
    LEFT JOIN solicitud_logistica sl
      ON sl.id_estado_solicitud = es.id_estado_solicitud
    GROUP BY es.nombre_estado
    ORDER BY es.nombre_estado
  `);

  return rows;
}

// REPORTE 3 — Bienes Más Solicitados
async function bienesMasSolicitados() {
  const { rows } = await pool.query(`
    SELECT 
      b.nombre_bien,
      SUM(sd.cantidad) AS total_solicitado
    FROM solicitud_detalle sd
    JOIN bien b ON b.id_bien = sd.id_bien
    GROUP BY b.nombre_bien
    ORDER BY total_solicitado DESC
  `);

  return rows;
}

//Consulta SQL para reporte completo

async function inventarioValorizado() {
  const { rows } = await pool.query(`
    SELECT 
      b.id_bodega,
      b.nombre_bodega,
      COUNT(DISTINCT i.id_bien) AS total_bienes,
      SUM(i.stock_actual) AS total_stock,
      SUM(i.stock_reservado) AS total_reservado,
      SUM(i.stock_actual - i.stock_reservado) AS total_disponible,

      SUM(i.stock_actual * COALESCE(bi.valor_unitario, 0)) AS valor_total_inventario,
      SUM(i.stock_reservado * COALESCE(bi.valor_unitario, 0)) AS valor_total_reservado,
      SUM((i.stock_actual - i.stock_reservado) * COALESCE(bi.valor_unitario, 0)) AS valor_total_disponible

    FROM inventario i
    JOIN bodega b ON b.id_bodega = i.id_bodega
    JOIN bien bi ON bi.id_bien = i.id_bien
    GROUP BY b.id_bodega, b.nombre_bodega
    ORDER BY b.nombre_bodega
  `);

  return rows;
}

async function reporteEjecutivoCompleto() {
  const { rows } = await pool.query(`
    SELECT 
      b.id_bodega,
      b.nombre_bodega,

      COUNT(DISTINCT i.id_bien) AS total_bienes,
      COALESCE(SUM(i.stock_actual), 0) AS total_stock,
      COALESCE(SUM(i.stock_reservado), 0) AS total_reservado,
      COALESCE(SUM(i.stock_actual - i.stock_reservado), 0) AS total_disponible,

      COALESCE(SUM(i.stock_actual * COALESCE(bi.valor_unitario, 0)), 0) AS valor_total_inventario,
      COALESCE(SUM(i.stock_reservado * COALESCE(bi.valor_unitario, 0)), 0) AS valor_total_reservado,
      COALESCE(SUM((i.stock_actual - i.stock_reservado) * COALESCE(bi.valor_unitario, 0)), 0) AS valor_total_disponible,

      (
        SELECT COUNT(*)
        FROM asignacion_bien ab
        JOIN registro r ON r.id_registro = ab.id_registro
        WHERE ab.estado_asignacion = 'ACTIVA'
          AND r.id_bodega_origen = b.id_bodega
      ) AS total_asignaciones_activas,

      (
        SELECT COALESCE(SUM(rd.cantidad),0)
        FROM asignacion_bien ab
        JOIN registro r ON r.id_registro = ab.id_registro
        JOIN registro_detalle rd ON rd.id_registro = r.id_registro
        WHERE ab.estado_asignacion = 'ACTIVA'
          AND r.id_bodega_origen = b.id_bodega
      ) AS total_bienes_asignados

    FROM inventario i
    JOIN bodega b ON b.id_bodega = i.id_bodega
    JOIN bien bi ON bi.id_bien = i.id_bien

    GROUP BY b.id_bodega, b.nombre_bodega
    ORDER BY b.nombre_bodega
  `);

  return rows;
}

module.exports = {
  stockCritico,
  solicitudesPorEstado,
  bienesMasSolicitados,
  inventarioValorizado,
  reporteEjecutivoCompleto
};