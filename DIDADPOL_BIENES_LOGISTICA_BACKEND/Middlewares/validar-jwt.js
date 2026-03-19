const jwt = require('jsonwebtoken');
const { registrarEvento } = require('../Helpers/auditoria');

const validarJWT = async (req, res, next) => {
  try {
    let token =
      req.header('x-token') ||
      req.header('authorization')?.replace('Bearer ', '');

    // ==========================================
    // SIN TOKEN
    // ==========================================
    if (!token) {
      await registrarEvento({
        id_usuario: null,
        tipo_accion: 'ACCESS_DENIED_NO_TOKEN',
        tabla_afectada: null,
        registro_afectado: null,
        ip_origen: req.ip,
        descripcion_log: `Acceso sin token a ${req.originalUrl}`
      });

      return res.status(401).json({ ok: false, msg: 'No hay token en la petición' });
    }

    // ==========================================
    // VERIFICAR TOKEN
    // ==========================================
    const decoded = jwt.verify(token, process.env.ACCESS_JWT_SECRET);

    /**
     * decoded = {
     *   id_usuario,
     *   id_empleado,
     *   roles: [],
     *   permisos: []
     * }
     */

    // Guardamos usuario completo
    req.user = decoded;
    req.uid = decoded.id_usuario;

    // Validación mínima del payload:
    if (!decoded.id_usuario) {
      await registrarEvento({
        id_usuario: null,
        tipo_accion: 'ACCESS_DENIED_INVALID_PAYLOAD',
        tabla_afectada: null,
        registro_afectado: null,
        ip_origen: req.ip,
        descripcion_log: `Token con payload inválido`
      });

      return res.status(401).json({ ok: false, msg: 'Token no válido' });
    }

    next();

  } catch (error) {
    // ==========================================
    // TOKEN INVÁLIDO
    // ==========================================
    await registrarEvento({
      id_usuario: null,
      tipo_accion: 'ACCESS_DENIED_INVALID_TOKEN',
      tabla_afectada: null,
      registro_afectado: null,
      ip_origen: req.ip,
      descripcion_log: `Token inválido al acceder a ${req.originalUrl}`
    });

    return res.status(401).json({
      ok: false,
      msg: 'Token no válido'
    });
  }
};

module.exports = { validarJWT };