const pool = require('../DB/db');

async function crearRegistro(data) {
  const {
    id_tipo_registro,
    id_usuario,
    id_empleado = null,
    id_solicitud = null,
    id_documento = null,
    id_bodega_origen = null,
    id_bodega_destino = null,
    referencia_externa = null,
    observaciones = null
  } = data;

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

await client.query(
  `CALL sp_registro_crear(
     $1::BIGINT,
     $2::BIGINT,
     $3::BIGINT,
     $4::BIGINT,
     $5::BIGINT,
     $6::BIGINT,
     $7::BIGINT,
     $8::VARCHAR,
     $9::TEXT,
     $10::BIGINT
   );`,
  [
    id_tipo_registro,
    id_usuario,
    id_empleado,
    id_solicitud,
    id_documento,
    id_bodega_origen,
    id_bodega_destino,
    referencia_externa,
    observaciones,
    null   
  ]
);

    // Obtener id_registro generado en la misma sesión (sequence currval)
    const seqRes = await client.query("SELECT currval('registro_id_registro_seq') AS id_registro;");
    const id_registro = seqRes.rows[0]?.id_registro;

    await client.query('COMMIT');

    return { id_registro };
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

async function agregarDetalle({
  id_registro,
  id_bien = null,
  id_bien_item = null,
  id_bien_lote = null,
  cantidad,
  costo_unitario = null,
  lote = null,
  observacion = null
}) {
  if (!id_registro) throw new Error('id_registro es obligatorio');
  if (!cantidad || Number(cantidad) <= 0) throw new Error('cantidad debe ser > 0');

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    await client.query(
  `CALL sp_registro_agregar_detalle(
     $1::BIGINT,
     $2::BIGINT,
     $3::BIGINT,
     $4::BIGINT,
     $5::NUMERIC,
     $6::NUMERIC,
     $7::VARCHAR,
     $8::TEXT,
     $9::BIGINT
   );`,
  [
    id_registro,
    id_bien,
    id_bien_item,
    id_bien_lote,
    cantidad,
    costo_unitario,
    lote,
    observacion,
    null   
  ]
);

    const seqRes = await client.query("SELECT currval('registro_detalle_id_registro_detalle_seq') AS id_detalle;");
    const id_detalle = seqRes.rows[0]?.id_detalle;

    await client.query('COMMIT');
    return { id_detalle };
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

async function confirmarRegistro({ id_registro, id_usuario, ip_origen = null }) {
  if (!id_registro) throw new Error('id_registro es obligatorio');

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    await client.query(
  `CALL sp_registro_confirmar_y_afectar_stock(
     $1::BIGINT,
     $2::BIGINT,
     $3::VARCHAR,
     $4::BIGINT
   );`,
  [
    id_registro,
    id_usuario,
    ip_origen,
    null   
  ]
);

    await client.query('COMMIT');
    return { ok: true };
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

async function anularRegistro({ id_registro, id_usuario, ip_origen = null, motivo = null }) {
  if (!id_registro) throw new Error('id_registro es obligatorio');

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    await client.query(
  `CALL sp_registro_anular_y_revertir_stock(
     $1::BIGINT,
     $2::BIGINT,
     $3::VARCHAR,
     $4::TEXT,
     $5::BIGINT
   );`,
  [
    id_registro,
    id_usuario,
    ip_origen,
    motivo,
    null
  ]);

    await client.query('COMMIT');
    return { ok: true };
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

module.exports = {
  crearRegistro,
  agregarDetalle,
  confirmarRegistro,
  anularRegistro
};