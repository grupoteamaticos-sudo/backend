const pool = require('../DB/db');

//Crear Asignacion

async function crearAsignacion(payload) {
  const {
    id_tipo_registro_asignacion,
    id_usuario,
    ip_origen,
    id_empleado,
    id_bodega_origen,
    id_bien,
    id_bien_item,
    cantidad,
    tipo_acta,
    numero_acta,
    fecha_emision_acta,
    motivo_asignacion,
    observaciones,
    archivo_pdf,
    firma_digital
  } = payload;

  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    const result = await client.query(
      `CALL sp_asignacion_crear(
        $1,$2,$3,
        $4,$5,
        $6,$7,$8,
        $9,$10,$11,$12,$13,$14,$15,
        NULL,NULL,NULL
      );`,
      [
        id_tipo_registro_asignacion,
        id_usuario,
        ip_origen,
        id_empleado,
        id_bodega_origen,
        id_bien,
        id_bien_item,
        cantidad,
        tipo_acta,
        numero_acta,
        fecha_emision_acta,
        motivo_asignacion,
        observaciones,
        archivo_pdf,
        firma_digital
      ]
    );

    await client.query('COMMIT');

    return { ok: true };

  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

//Devolver Asignacion 

async function devolverAsignacion(payload) {
  const {
    id_asignacion,
    id_tipo_registro_devolucion,
    id_usuario,
    ip_origen,
    id_bodega_destino,
    id_bien_item,
    cantidad,
    observaciones
  } = payload;

  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    await client.query(
      `CALL sp_asignacion_devolver(
        $1,$2,$3,$4,
        $5,$6,$7,$8,
        NULL,NULL
      );`,
      [
        id_asignacion,
        id_tipo_registro_devolucion,
        id_usuario,
        ip_origen,
        id_bodega_destino,
        id_bien_item,
        cantidad,
        observaciones
      ]
    );

    await client.query('COMMIT');

    return { ok: true };

  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

module.exports = {
  crearAsignacion,
  devolverAsignacion
};