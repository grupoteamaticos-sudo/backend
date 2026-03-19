const pool = require('../DB/db');

/**
 * REGISTRA EVENTO GENERAL EN sp_log_evento
 */
const registrarEvento = async ({
  id_usuario = null,
  tipo_accion,
  tabla_afectada,
  registro_afectado = null,
  ip_origen,
  descripcion_log = null
}) => {
  try {

    const sql = `
      CALL sp_log_evento(
        $1::bigint,
        $2::varchar,
        $3::varchar,
        $4::bigint,
        $5::varchar,
        $6::text,
        NULL
      );
    `;

    await pool.query(sql, [
      id_usuario,
      tipo_accion,
      tabla_afectada,
      registro_afectado,
      ip_origen,
      descripcion_log
    ]);

  } catch (error) {
    console.error("❌ Error registrando evento:", error.message);
  }
};


/**
 * REGISTRA CAMBIO DETALLADO EN sp_log_cambio
 */
const registrarCambio = async ({
  id_log_usuario,
  campo_modificado,
  valor_antes,
  valor_despues
}) => {
  try {

    const sql = `
      CALL sp_log_cambio(
        $1::bigint,
        $2::varchar,
        $3::text,
        $4::text
      );
    `;

    await pool.query(sql, [
      id_log_usuario,
      campo_modificado,
      valor_antes,
      valor_despues
    ]);

  } catch (error) {
    console.error("❌ Error registrando cambio:", error.message);
  }
};

module.exports = {
  registrarEvento,
  registrarCambio
};