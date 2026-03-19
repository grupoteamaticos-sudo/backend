const pool = require('../DB/db');

// -------------------------------------------
// LISTAR ROLES CON PERMISOS
// -------------------------------------------
async function listarRoles() {
  const sql = `
    SELECT
      r.id_rol,
      r.nombre_rol,
      r.descripcion_rol,
      r.estado_rol,
      r.fecha_registro,
      COALESCE(
        json_agg(
          DISTINCT jsonb_build_object(
            'id_permiso', p.id_permiso,
            'codigo_permiso', p.codigo_permiso,
            'nombre_permiso', p.nombre_permiso
          )
        ) FILTER (WHERE p.id_permiso IS NOT NULL),
        '[]'::json
      ) AS permisos
    FROM rol r
    LEFT JOIN rol_permiso rp ON rp.id_rol = r.id_rol
    LEFT JOIN permiso p ON p.id_permiso = rp.id_permiso
    GROUP BY
      r.id_rol,
      r.nombre_rol,
      r.descripcion_rol,
      r.estado_rol,
      r.fecha_registro
    ORDER BY r.id_rol ASC;
  `;
  const { rows } = await pool.query(sql);
  return rows;
}

// -------------------------------------------
// OBTENER ROL POR ID
// -------------------------------------------
async function obtenerRol(id_rol) {
  const sql = `
    SELECT
      r.id_rol,
      r.nombre_rol,
      r.descripcion_rol,
      r.estado_rol,
      r.fecha_registro,
      COALESCE(
        json_agg(
          DISTINCT jsonb_build_object(
            'id_permiso', p.id_permiso,
            'codigo_permiso', p.codigo_permiso,
            'nombre_permiso', p.nombre_permiso
          )
        ) FILTER (WHERE p.id_permiso IS NOT NULL),
        '[]'::json
      ) AS permisos
    FROM rol r
    LEFT JOIN rol_permiso rp ON rp.id_rol = r.id_rol
    LEFT JOIN permiso p ON p.id_permiso = rp.id_permiso
    WHERE r.id_rol = $1
    GROUP BY
      r.id_rol,
      r.nombre_rol,
      r.descripcion_rol,
      r.estado_rol,
      r.fecha_registro;
  `;
  const { rows } = await pool.query(sql, [id_rol]);
  return rows[0] || null;
}

// -------------------------------------------
// CREAR ROL
// -------------------------------------------
async function crearRol({ nombre_rol, descripcion_rol }) {
  const sql = `
    INSERT INTO rol (nombre_rol, descripcion_rol)
    VALUES ($1, $2)
    RETURNING *;
  `;
  const { rows } = await pool.query(sql, [nombre_rol, descripcion_rol || null]);
  return rows[0];
}

// -------------------------------------------
// ACTUALIZAR ROL
// -------------------------------------------
async function actualizarRol(id_rol, campos) {
  const columnas = [];
  const valores = [];
  let index = 1;

  for (const key in campos) {
    columnas.push(`${key} = $${index}`);
    valores.push(campos[key]);
    index++;
  }

  if (!columnas.length) {
    throw new Error('No hay campos para actualizar');
  }

  valores.push(id_rol);

  const sql = `
    UPDATE rol
    SET ${columnas.join(', ')}
    WHERE id_rol = $${index}
    RETURNING *;
  `;
  const { rows } = await pool.query(sql, valores);
  return rows[0];
}

// -------------------------------------------
// ELIMINAR ROL
// -------------------------------------------
async function eliminarRol(id_rol) {
  await pool.query(`DELETE FROM rol WHERE id_rol = $1`, [id_rol]);
  return true;
}

// -------------------------------------------
// ASIGNAR PERMISO
// -------------------------------------------
async function asignarPermiso(id_rol, id_permiso) {
  const sql = `
    INSERT INTO rol_permiso (id_rol, id_permiso)
    VALUES ($1, $2)
    ON CONFLICT (id_rol, id_permiso) DO NOTHING
    RETURNING *;
  `;
  const { rows } = await pool.query(sql, [id_rol, id_permiso]);
  return rows[0] || null;
}

// -------------------------------------------
// QUITAR PERMISO
// -------------------------------------------
async function quitarPermiso(id_rol, id_permiso) {
  const sql = `
    DELETE FROM rol_permiso
    WHERE id_rol = $1 AND id_permiso = $2;
  `;
  await pool.query(sql, [id_rol, id_permiso]);
  return true;
}

module.exports = {
  listarRoles,
  obtenerRol,
  crearRol,
  actualizarRol,
  eliminarRol,
  asignarPermiso,
  quitarPermiso
};