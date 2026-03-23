const {
  MAX_INTENTOS,
  findUserByUsername,
  findUserByIdentifier,
  incrementFailedAttempt,
  resetAttemptsAndUpdateAccess,
  getRolesPermisos,
  verifyPassword,
  createUserEnterprise,
  createLoginOtpChallenge,
  verifyLoginOtpChallenge,
  createRecoveryOtpChallenge,
  verifyRecoveryOtpChallenge,
  updateUserPasswordById
} = require('../../service/auth-service');

const {
  generateAuhtJWT,
  generateRefreshToken,
  invalidateJWT
} = require('../../Helpers/jwt');

const { registrarEvento } = require('../../Helpers/auditoria');

/* ============================================================
   LOGIN – PROCESO SIMPLIFICADO (SIN OTP)
   ============================================================ */
const login = async (req, res) => {
  try {
    const { username, password } = req.body;
    const ip_origen = req.ip;

    if (!username || !password) {
      return res.status(400).json({
        ok: false,
        message: 'username y password son obligatorios'
      });
    }

    const user = await findUserByUsername(username);

    if (!user) {
      await registrarEvento({
        id_usuario: null,
        tipo_accion: 'LOGIN_FAILED',
        tabla_afectada: 'usuario',
        registro_afectado: null,
        ip_origen,
        descripcion_log: `Intento con usuario inexistente: ${username}`
      });

      return res.status(401).json({
        ok: false,
        message: 'Credenciales inválidas'
      });
    }

    if (user.estado_usuario !== 'ACTIVO') {
      return res.status(403).json({
        ok: false,
        message: 'Usuario inactivo'
      });
    }

    if (user.bloqueado) {
      return res.status(423).json({
        ok: false,
        message: 'Usuario bloqueado',
        intentos_fallidos: user.intentos_fallidos
      });
    }

    const passOk = await verifyPassword(password, user.contrasena_usuario);

    if (!passOk) {
      const updated = await incrementFailedAttempt(user.id_usuario);
      const fueBloqueado = updated?.bloqueado === true;

      await registrarEvento({
        id_usuario: user.id_usuario,
        tipo_accion: fueBloqueado ? 'AUTO_LOCK_USER' : 'LOGIN_FAILED',
        tabla_afectada: 'usuario',
        registro_afectado: user.id_usuario,
        ip_origen,
        descripcion_log: fueBloqueado
          ? 'Usuario bloqueado automáticamente por intentos fallidos'
          : 'Contraseña incorrecta'
      });

      if (fueBloqueado) {
        return res.status(423).json({
          ok: false,
          message: `Usuario bloqueado por ${MAX_INTENTOS} intentos fallidos`
        });
      }

      return res.status(401).json({
        ok: false,
        message: `Credenciales inválidas. Intento ${updated.intentos_fallidos} de ${MAX_INTENTOS}`
      });
    }

    // --- SALTO DE OTP: GENERACIÓN DIRECTA DE SESIÓN ---
    
    // Actualizamos el último acceso en la DB
    await resetAttemptsAndUpdateAccess(user.id_usuario);

    // Obtenemos los permisos necesarios para el Frontend
    const { roles, permisos } = await getRolesPermisos(user.id_usuario);
    
    const payload = {
      id_usuario: user.id_usuario,
      id_empleado: user.id_empleado,
      roles,
      permisos
    };

    // Generamos tokens de acceso
    const accessToken = await generateAuhtJWT(payload);
    const refreshToken = await generateRefreshToken(payload);

    // Auditoría de éxito
    await registrarEvento({
      id_usuario: user.id_usuario,
      tipo_accion: 'LOGIN_SUCCESS',
      tabla_afectada: 'usuario',
      registro_afectado: user.id_usuario,
      ip_origen,
      descripcion_log: 'Inicio de sesión exitoso (OTP Bypass para despliegue)'
    });

    // Respuesta completa que espera Angular
    return res.json({
      ok: true,
      requires2FA: false, 
      data: {
        accessToken,
        refreshToken,
        roles,
        permisos,
        usuario: {
          id: user.id_usuario,
          id_usuario: user.id_usuario,
          id_empleado: user.id_empleado,
          username: user.nombre_usuario,
          nombre_usuario: user.nombre_usuario,
          correo_login: user.correo_login
        }
      }
    });

  } catch (error) {
    console.error('Error en Login:', error);
    return res.status(500).json({
      ok: false,
      message: error.message
    });
  }
};

/* ============================================================
   VERIFICACIÓN OTP (Mantenemos la función por compatibilidad, 
   aunque ya no se usará en el login principal)
   ============================================================ */
const verifyOtp = async (req, res) => {
  try {
    const { tempToken, code } = req.body;
    const ip_origen = req.ip;
    const otpData = await verifyLoginOtpChallenge(tempToken, code);
    const user = await findUserByUsername(otpData.username);

    if (!user) return res.status(404).json({ ok: false, message: 'Usuario no encontrado' });

    await resetAttemptsAndUpdateAccess(user.id_usuario);
    const { roles, permisos } = await getRolesPermisos(user.id_usuario);

    const payload = { id_usuario: user.id_usuario, id_empleado: user.id_empleado, roles, permisos };
    const accessToken = await generateAuhtJWT(payload);
    const refreshToken = await generateRefreshToken(payload);

    return res.json({
      ok: true,
      data: { accessToken, refreshToken, roles, permisos, usuario: { id: user.id_usuario, username: user.nombre_usuario } }
    });
  } catch (error) {
    return res.status(400).json({ ok: false, message: error.message });
  }
};

/* ============================================================
   RESTO DE FUNCIONES (Registro, Recuperación, etc.)
   ============================================================ */
const userRegister = async (req, res) => {
  try {
    const { id_empleado, username, password, correo } = req.body;
    const id_usuario_accion = req.user.id_usuario;
    const ip_origen = req.ip;

    const result = await createUserEnterprise({ id_empleado, username, password, correo, id_usuario_accion, ip_origen });
    return res.status(201).json({ ok: true, message: 'Usuario creado', data: result });
  } catch (error) {
    return res.status(500).json({ ok: false, message: error.message });
  }
};

const forgotPassword = async (req, res) => {
  try {
    const { identifier } = req.body;
    const ip_origen = req.ip;
    const user = await findUserByIdentifier(identifier);
    if (!user) return res.status(404).json({ ok: false, message: 'No existe usuario' });

    const challenge = await createRecoveryOtpChallenge(user);
    return res.json({ ok: true, tempToken: challenge.tempToken, devOtp: challenge.devOtp });
  } catch (error) {
    return res.status(500).json({ ok: false, message: error.message });
  }
};

const recoverPassword = async (req, res) => {
  try {
    const { tempToken, code, newPassword, passwordConfirm } = req.body;
    if (newPassword !== passwordConfirm) return res.status(400).json({ ok: false, message: 'No coinciden' });

    const otpData = await verifyRecoveryOtpChallenge(tempToken, code);
    await updateUserPasswordById(otpData.id_usuario, newPassword);
    return res.json({ ok: true, message: 'Contraseña actualizada' });
  } catch (error) {
    return res.status(400).json({ ok: false, message: error.message });
  }
};

const contactMessage = async (req, res) => res.status(200).json({ ok: true, message: 'Mensaje recibido' });
const auditAccess = async (req, res) => res.status(200).json({ ok: true, message: 'Acceso auditado' });

const logout = async (req, res) => {
  try {
    const id_usuario = req.user?.id_usuario;
    if (id_usuario) await invalidateJWT(id_usuario);
    return res.json({ ok: true, message: 'Sesión cerrada' });
  } catch (error) {
    return res.status(500).json({ ok: false, message: error.message });
  }
};

module.exports = {
  login,
  verifyOtp,
  userRegister,
  forgotPassword,
  recoverPassword,
  contactMessage,
  auditAccess,
  logout
};