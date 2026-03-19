const pool = require('../DB/db');
const bcrypt = require('bcryptjs');
const redis = require('../Helpers/init-redis');

const MAX_INTENTOS = parseInt(process.env.MAX_INTENTOS_LOGIN, 10) || 3;
const OTP_MINUTES = parseInt(process.env.RECOVERY_OTP_MINUTES || '10', 10);

function genOtp6() {
  return String(Math.floor(100000 + Math.random() * 900000));
}

function genTempToken(prefix = 'tmp') {
  return `${prefix}_${Date.now()}_${Math.random().toString(16).slice(2)}`;
}

function maskEmail(email = '') {
  if (!email.includes('@')) return email;
  const [name, domain] = email.split('@');
  const safeName = name.length <= 2
    ? `${name[0] || '*'}*`
    : `${name.slice(0, 2)}***`;
  return `${safeName}@${domain}`;
}

async function findUserByUsername(nombre_usuario) {
  const sql = `
    SELECT
      id_usuario,
      id_empleado,
      nombre_usuario,
      contrasena_usuario,
      correo_login,
      ultimo_acceso,
      intentos_fallidos,
      bloqueado,
      estado_usuario
    FROM usuario
    WHERE nombre_usuario = $1
    LIMIT 1;
  `;
  const { rows } = await pool.query(sql, [nombre_usuario]);
  return rows[0] || null;
}

async function findUserByIdentifier(identifier) {
  const sql = `
    SELECT
      id_usuario,
      id_empleado,
      nombre_usuario,
      contrasena_usuario,
      correo_login,
      ultimo_acceso,
      intentos_fallidos,
      bloqueado,
      estado_usuario
    FROM usuario
    WHERE lower(nombre_usuario) = lower($1)
       OR lower(correo_login) = lower($1)
    LIMIT 1;
  `;
  const { rows } = await pool.query(sql, [identifier]);
  return rows[0] || null;
}

async function incrementFailedAttempt(id_usuario) {
  const sql = `
    UPDATE usuario
    SET
      intentos_fallidos = intentos_fallidos + 1,
      bloqueado = CASE WHEN (intentos_fallidos + 1) >= $2 THEN TRUE ELSE bloqueado END
    WHERE id_usuario = $1
    RETURNING intentos_fallidos, bloqueado;
  `;
  const { rows } = await pool.query(sql, [id_usuario, MAX_INTENTOS]);
  return rows[0] || null;
}

async function resetAttemptsAndUpdateAccess(id_usuario) {
  const sql = `
    UPDATE usuario
    SET
      intentos_fallidos = 0,
      bloqueado = FALSE,
      ultimo_acceso = NOW()
    WHERE id_usuario = $1;
  `;
  await pool.query(sql, [id_usuario]);
}

async function getRolesPermisos(id_usuario) {
  const sql = `
    SELECT
      r.id_rol,
      r.nombre_rol,
      p.id_permiso,
      p.codigo_permiso,
      p.nombre_permiso
    FROM usuario_rol ur
    INNER JOIN rol r ON r.id_rol = ur.id_rol
    LEFT JOIN rol_permiso rp ON rp.id_rol = r.id_rol
    LEFT JOIN permiso p ON p.id_permiso = rp.id_permiso
    WHERE ur.id_usuario = $1
      AND r.estado_rol = 'ACTIVO'
      AND (p.id_permiso IS NULL OR p.estado_permiso = 'ACTIVO');
  `;
  const { rows } = await pool.query(sql, [id_usuario]);

  const rolesMap = new Map();
  const permisosMap = new Map();

  for (const row of rows) {
    if (row.id_rol) {
      rolesMap.set(row.id_rol, {
        id_rol: row.id_rol,
        nombre_rol: row.nombre_rol
      });
    }

    if (row.id_permiso) {
      permisosMap.set(row.codigo_permiso, {
        id_permiso: row.id_permiso,
        codigo_permiso: row.codigo_permiso,
        nombre_permiso: row.nombre_permiso
      });
    }
  }

  return {
    roles: Array.from(rolesMap.values()),
    permisos: Array.from(permisosMap.values())
  };
}

async function verifyPassword(plain, hash) {
  return bcrypt.compare(plain, hash);
}

async function updateUserPasswordById(id_usuario, newPassword) {
  const hash = await bcrypt.hash(newPassword, 10);

  const sql = `
    UPDATE usuario
    SET
      contrasena_usuario = $1,
      intentos_fallidos = 0,
      bloqueado = FALSE
    WHERE id_usuario = $2
    RETURNING id_usuario, nombre_usuario, correo_login;
  `;

  const { rows } = await pool.query(sql, [hash, id_usuario]);
  return rows[0] || null;
}

async function createLoginOtpChallenge(user) {
  const otp = genOtp6();
  const tempToken = genTempToken('login');
  const ttlSeconds = OTP_MINUTES * 60;

  const payload = {
    flow: 'LOGIN',
    id_usuario: user.id_usuario,
    username: user.nombre_usuario,
    email: user.correo_login,
    otp
  };

  await redis.SET(`otp:${tempToken}`, JSON.stringify(payload), { EX: ttlSeconds });

  return {
    tempToken,
    expiresInSeconds: ttlSeconds,
    channel: 'APP',
    devOtp: process.env.NODE_ENV === 'development' ? otp : undefined
  };
}

async function verifyLoginOtpChallenge(tempToken, code) {
  const raw = await redis.GET(`otp:${tempToken}`);

  if (!raw) {
    throw new Error('El código OTP expiró o no existe');
  }

  const data = JSON.parse(raw);

  if (data.flow !== 'LOGIN') {
    throw new Error('El desafío OTP no corresponde a login');
  }

  if (String(data.otp) !== String(code).trim()) {
    throw new Error('Código OTP incorrecto');
  }

  await redis.DEL(`otp:${tempToken}`);

  return {
    id_usuario: data.id_usuario,
    username: data.username,
    email: data.email
  };
}

async function createRecoveryOtpChallenge(user) {
  const otp = genOtp6();
  const tempToken = genTempToken('recovery');
  const ttlSeconds = OTP_MINUTES * 60;

  const payload = {
    flow: 'RECOVERY',
    id_usuario: user.id_usuario,
    username: user.nombre_usuario,
    email: user.correo_login,
    otp
  };

  await redis.SET(`otp:${tempToken}`, JSON.stringify(payload), { EX: ttlSeconds });

  return {
    tempToken,
    expiresInSeconds: ttlSeconds,
    channel: 'EMAIL',
    destination: maskEmail(user.correo_login || ''),
    devOtp: process.env.NODE_ENV === 'development' ? otp : undefined
  };
}

async function verifyRecoveryOtpChallenge(tempToken, code) {
  const raw = await redis.GET(`otp:${tempToken}`);

  if (!raw) {
    throw new Error('El código OTP expiró o no existe');
  }

  const data = JSON.parse(raw);

  if (data.flow !== 'RECOVERY') {
    throw new Error('El desafío OTP no corresponde a recuperación');
  }

  if (String(data.otp) !== String(code).trim()) {
    throw new Error('Código OTP incorrecto');
  }

  await redis.DEL(`otp:${tempToken}`);

  return {
    id_usuario: data.id_usuario,
    username: data.username,
    email: data.email
  };
}

async function createUserEnterprise({
  id_empleado,
  username,
  password,
  correo,
  id_usuario_accion,
  ip_origen
}) {
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(password, salt);

    const userResult = await client.query(
      `SELECT * FROM sp_usuario_crear(
        $1, $2, $3, $4, $5, $6
      )`,
      [
        id_empleado,
        username,
        passwordHash,
        correo,
        id_usuario_accion,
        ip_origen
      ]
    );

    const id_usuario = userResult.rows[0]?.p_id_usuario;

    if (!id_usuario) {
      throw new Error('No se pudo crear el usuario');
    }

    await client.query(
      `SELECT * FROM sp_usuario_asignar_rol(
        $1, $2, $3, $4
      )`,
      [
        id_usuario,
        4,
        id_usuario_accion,
        ip_origen
      ]
    );

    await client.query(
      `SELECT * FROM sp_log_evento(
        $1, $2, $3, $4, $5, $6
      )`,
      [
        id_usuario_accion,
        'USUARIO_CREADO',
        'usuario',
        id_usuario,
        ip_origen,
        `Usuario creado: ${username}`
      ]
    );

    await client.query('COMMIT');

    return { id_usuario };
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

module.exports = {
  MAX_INTENTOS,
  findUserByUsername,
  findUserByIdentifier,
  incrementFailedAttempt,
  resetAttemptsAndUpdateAccess,
  getRolesPermisos,
  verifyPassword,
  updateUserPasswordById,
  createLoginOtpChallenge,
  verifyLoginOtpChallenge,
  createRecoveryOtpChallenge,
  verifyRecoveryOtpChallenge,
  createUserEnterprise
};