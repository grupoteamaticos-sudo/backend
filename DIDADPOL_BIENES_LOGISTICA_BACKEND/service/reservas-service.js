const pool = require('../DB/db');

async function reservar(data) {
  const { id_bodega, id_bien = null, id_bien_lote = null, cantidad } = data;

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    await client.query(
      `CALL sp_inventario_reservar($1, $2, $3, $4);`,
      [id_bodega, id_bien, id_bien_lote, cantidad]
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

async function liberar(data) {
  const { id_bodega, id_bien = null, id_bien_lote = null, cantidad } = data;

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    await client.query(
      `CALL sp_inventario_liberar_reserva($1, $2, $3, $4);`,
      [id_bodega, id_bien, id_bien_lote, cantidad]
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

async function consumir(data) {
  const { id_bodega, id_bien = null, id_bien_lote = null, cantidad } = data;

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    await client.query(
      `CALL sp_inventario_consumir_reserva($1, $2, $3, $4);`,
      [id_bodega, id_bien, id_bien_lote, cantidad]
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
  reservar,
  liberar,
  consumir
};