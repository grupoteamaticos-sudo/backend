const pool = require('../DB/db');

async function crearSolicitud(data) {
  const {
    id_empleado,
    id_tipo_solicitud,
    descripcion_solicitud,
    prioridad
  } = data;

  const { rows } = await pool.query(
    `INSERT INTO solicitud_logistica
     (id_empleado, id_tipo_solicitud, id_estado_solicitud, prioridad, descripcion_solicitud)
     VALUES ($1, $2, 1, $3, $4)
     RETURNING id_solicitud`,
    [id_empleado, id_tipo_solicitud, prioridad, descripcion_solicitud]
  );

  return rows[0];
}

async function agregarDetalle(data) {
  const {
    id_solicitud,
    id_bien,
    cantidad,
    descripcion_item,
    justificacion
  } = data;

  const { rows } = await pool.query(
    `INSERT INTO solicitud_detalle
     (id_solicitud, id_bien, cantidad, descripcion_item, justificacion)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING id_solicitud_detalle`,
    [id_solicitud, id_bien, cantidad, descripcion_item, justificacion]
  );

  return rows[0];
}

async function cambiarEstado(data) {
  const {
    id_solicitud,
    id_estado_nuevo,
    id_bodega_reserva,
    id_usuario,
    ip_origen,
    observacion
  } = data;

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    await client.query(
      `CALL sp_solicitud_cambiar_estado_y_reservar(
        $1, $2, $3, $4, $5, $6, NULL
      )`,
      [
        id_solicitud,
        id_estado_nuevo,
        id_bodega_reserva,
        id_usuario,
        ip_origen,
        observacion
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

async function generarRegistroSalida(data) {
  const {
    id_solicitud,
    id_usuario,
    id_bodega_origen,
    ip_origen
  } = data;

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const { rows } = await client.query(
      `CALL sp_solicitud_generar_registro_salida(
        $1, 3, $2, $3, NULL, NULL, $4, NULL, NULL
      )`,
      [
        id_solicitud,
        id_usuario,
        id_bodega_origen,
        ip_origen
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

module.exports = {
  crearSolicitud,
  agregarDetalle,
  cambiarEstado,
  generarRegistroSalida
};