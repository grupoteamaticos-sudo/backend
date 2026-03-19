const pool = require('../DB/db');

// -------------------------------------------
// LISTAR PERMISOS
// -------------------------------------------
async function listarPermisos() {
  const sql = `
    SELECT
      id_permiso,
      nombre_permiso,
      codigo_permiso,
      descripcion_permiso,
      estado_permiso,
      fecha_registro
    FROM permiso
    ORDER BY id_permiso ASC;
  `;
  const { rows } = await pool.query(sql);
  return rows;
}

// -------------------------------------------
// OBTENER PERMISO
// -------------------------------------------
async function obtenerPermiso(id_permiso) {
  const sql = `
    SELECT 
      id_permiso,
      nombre_permiso,
      codigo_permiso,
      descripcion_permiso,
      estado_permiso
    FROM permiso
    WHERE id_permiso = $1;
  `;
  const { rows } = await pool.query(sql, [id_permiso]);
  return rows[0] || null;
}

// -------------------------------------------
// CREAR PERMISO
// -------------------------------------------
async function crearPermiso({ nombre_permiso, codigo_permiso, descripcion_permiso }) {
  const sql = `
    INSERT INTO permiso (
      nombre_permiso, codigo_permiso, descripcion_permiso
    ) VALUES ($1, $2, $3)
    RETURNING *;
  `;
  const { rows } = await pool.query(sql, [
    nombre_permiso,
    codigo_permiso,
    descripcion_permiso
  ]);

  return rows[0];
}

// -------------------------------------------
// ACTUALIZAR PERMISO
// -------------------------------------------
async function actualizarPermiso(id_permiso, campos) {
  const columnas = [];
  const valores = [];
  let index = 1;

  for (let key in campos) {
    columnas.push(`${key} = $${index}`);
    valores.push(campos[key]);
    index++;
  }

  valores.push(id_permiso);

  const sql = `
    UPDATE permiso
    SET ${columnas.join(', ')}
    WHERE id_permiso = $${index}
    RETURNING *;
  `;
  const { rows } = await pool.query(sql, valores);
  return rows[0];
}

// -------------------------------------------
// ELIMINAR PERMISO
// -------------------------------------------
async function eliminarPermiso(id_permiso) {
  await pool.query(`DELETE FROM permiso WHERE id_permiso = $1`, [id_permiso]);
  return true;
}

module.exports = {
  listarPermisos,
  obtenerPermiso,
  crearPermiso,
  actualizarPermiso,
  eliminarPermiso
};