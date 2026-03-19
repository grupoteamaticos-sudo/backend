const pool = require('../DB/db');
const bcrypt = require('bcryptjs');

const ROL_DEFAULT_ID = 4;

/* ============================================================
   LISTAR USUARIOS CON ROLES
   ============================================================ */
async function listarUsuarios() {
  const sql = `
    SELECT
      u.id_usuario,
      u.id_empleado,
      u.nombre_usuario,
      u.correo_login,
      u.ultimo_acceso,
      u.intentos_fallidos,
      u.bloqueado,
      u.estado_usuario,
      u.fecha_registro,
      COALESCE(
        json_agg(
          DISTINCT jsonb_build_object(
            'id_rol', r.id_rol,
            'nombre_rol', r.nombre_rol
          )
        ) FILTER (WHERE r.id_rol IS NOT NULL),
        '[]'::json
      ) AS roles
    FROM usuario u
    LEFT JOIN usuario_rol ur ON ur.id_usuario = u.id_usuario
    LEFT JOIN rol r ON r.id_rol = ur.id_rol
    GROUP BY
      u.id_usuario,
      u.id_empleado,
      u.nombre_usuario,
      u.correo_login,
      u.ultimo_acceso,
      u.intentos_fallidos,
      u.bloqueado,
      u.estado_usuario,
      u.fecha_registro
    ORDER BY u.id_usuario ASC;
  `;

  const { rows } = await pool.query(sql);
  return rows;
}

/* ============================================================
   OBTENER USUARIO POR ID CON ROLES
   ============================================================ */
async function obtenerUsuario(id_usuario) {
  const sql = `
    SELECT
      u.id_usuario,
      u.id_empleado,
      u.nombre_usuario,
      u.correo_login,
      u.ultimo_acceso,
      u.intentos_fallidos,
      u.bloqueado,
      u.estado_usuario,
      u.fecha_registro,
      COALESCE(
        json_agg(
          DISTINCT jsonb_build_object(
            'id_rol', r.id_rol,
            'nombre_rol', r.nombre_rol
          )
        ) FILTER (WHERE r.id_rol IS NOT NULL),
        '[]'::json
      ) AS roles
    FROM usuario u
    LEFT JOIN usuario_rol ur ON ur.id_usuario = u.id_usuario
    LEFT JOIN rol r ON r.id_rol = ur.id_rol
    WHERE u.id_usuario = $1
    GROUP BY
      u.id_usuario,
      u.id_empleado,
      u.nombre_usuario,
      u.correo_login,
      u.ultimo_acceso,
      u.intentos_fallidos,
      u.bloqueado,
      u.estado_usuario,
      u.fecha_registro;
  `;

  const { rows } = await pool.query(sql, [id_usuario]);
  return rows[0] || null;
}

/* ============================================================
   CREAR USUARIO + ASIGNAR ROL
   ============================================================ */
async function crearUsuario({
  id_empleado,
  nombre_usuario,
  password,
  correo_login,
  id_rol,
  activo = true,
  id_usuario_accion,
  ip_origen
}) {
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    const hash = await bcrypt.hash(password, 10);

    await client.query(
      `
      CALL sp_usuario_crear(
        $1::bigint,
        $2::varchar,
        $3::text,
        $4::varchar,
        $5::bigint,
        $6::varchar,
        NULL,
        NULL
      );
      `,
      [
        id_empleado,
        nombre_usuario,
        hash,
        correo_login,
        id_usuario_accion,
        ip_origen
      ]
    );

    const { rows } = await client.query(
      `SELECT currval(pg_get_serial_sequence('usuario','id_usuario')) AS id`
    );

    const id_usuario_nuevo = rows[0]?.id;

    if (!id_usuario_nuevo) {
      throw new Error('No se pudo obtener el id del usuario creado');
    }

    await client.query(
      `
      CALL sp_usuario_asignar_rol(
        $1::bigint,
        $2::bigint,
        $3::bigint,
        $4::varchar,
        NULL,
        NULL
      );
      `,
      [
        id_usuario_nuevo,
        id_rol || ROL_DEFAULT_ID,
        id_usuario_accion,
        ip_origen
      ]
    );

    if (!activo) {
      await client.query(
        `
        UPDATE usuario
        SET estado_usuario = 'INACTIVO'
        WHERE id_usuario = $1
        `,
        [id_usuario_nuevo]
      );
    }

    await client.query('COMMIT');

    return await obtenerUsuario(id_usuario_nuevo);
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

/* ============================================================
   ACTUALIZAR USUARIO + ROL
   ============================================================ */
async function actualizarUsuario(id_usuario, campos) {
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    const {
      id_empleado,
      nombre_usuario,
      correo_login,
      estado_usuario,
      bloqueado,
      id_rol
    } = campos;

    const sets = [];
    const values = [];
    let i = 1;

    if (id_empleado !== undefined) {
      sets.push(`id_empleado = $${i++}`);
      values.push(id_empleado);
    }

    if (nombre_usuario !== undefined) {
      sets.push(`nombre_usuario = $${i++}`);
      values.push(nombre_usuario);
    }

    if (correo_login !== undefined) {
      sets.push(`correo_login = $${i++}`);
      values.push(correo_login);
    }

    if (estado_usuario !== undefined) {
      sets.push(`estado_usuario = $${i++}`);
      values.push(estado_usuario);
    }

    if (bloqueado !== undefined) {
      sets.push(`bloqueado = $${i++}`);
      values.push(bloqueado);
    }

    if (sets.length > 0) {
      values.push(id_usuario);

      const sql = `
        UPDATE usuario
        SET ${sets.join(', ')}
        WHERE id_usuario = $${i}
      `;

      await client.query(sql, values);
    }

    if (id_rol !== undefined && id_rol !== null && id_rol !== '') {
      await client.query(
        `DELETE FROM usuario_rol WHERE id_usuario = $1`,
        [id_usuario]
      );

      await client.query(
        `
        INSERT INTO usuario_rol (id_usuario, id_rol)
        VALUES ($1, $2)
        `,
        [id_usuario, id_rol]
      );
    }

    await client.query('COMMIT');

    return await obtenerUsuario(id_usuario);
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

/* ============================================================
   BLOQUEAR / DESBLOQUEAR
   ============================================================ */
async function bloquearUsuario(id_usuario) {
  const sql = `
    UPDATE usuario
    SET bloqueado = NOT bloqueado
    WHERE id_usuario = $1
    RETURNING id_usuario, bloqueado;
  `;

  const { rows } = await pool.query(sql, [id_usuario]);

  if (!rows.length) {
    throw new Error('Usuario no encontrado');
  }

  return rows[0];
}

/* ============================================================
   INACTIVAR
   ============================================================ */
async function inactivarUsuario(id_usuario) {
  const sql = `
    UPDATE usuario
    SET estado_usuario = 'INACTIVO'
    WHERE id_usuario = $1
    RETURNING id_usuario, estado_usuario;
  `;

  const { rows } = await pool.query(sql, [id_usuario]);

  if (!rows.length) {
    throw new Error('Usuario no encontrado');
  }

  return rows[0];
}

/* ============================================================
   CAMBIAR CONTRASEÑA
   ============================================================ */
async function cambiarPassword({
  id_usuario_objetivo,
  currentPassword,
  newPassword,
  esAdmin = false
}) {
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    const { rows } = await client.query(
      `SELECT contrasena_usuario FROM usuario WHERE id_usuario = $1`,
      [id_usuario_objetivo]
    );

    if (!rows.length) {
      throw new Error('Usuario no encontrado');
    }

    const passwordHashActual = rows[0].contrasena_usuario;

    if (!esAdmin) {
      const match = await bcrypt.compare(currentPassword, passwordHashActual);

      if (!match) {
        throw new Error('Contraseña actual incorrecta');
      }
    }

    const newHash = await bcrypt.hash(newPassword, 10);

    await client.query(
      `
      UPDATE usuario
      SET contrasena_usuario = $1
      WHERE id_usuario = $2
      `,
      [newHash, id_usuario_objetivo]
    );

    await client.query('COMMIT');
    return true;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

module.exports = {
  listarUsuarios,
  obtenerUsuario,
  crearUsuario,
  actualizarUsuario,
  bloquearUsuario,
  inactivarUsuario,
  cambiarPassword
};