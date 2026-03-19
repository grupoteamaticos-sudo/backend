const { registrarEvento } = require('../Helpers/auditoria');
const pool = require('../DB/db');

/**
 * Si por alguna razón los roles no vienen en el token,
 * se consultan desde la BD.
 */
async function obtenerRolesDesdeBD(id_usuario) {
  const sql = `
    SELECT r.nombre_rol
    FROM usuario_rol ur
    INNER JOIN rol r ON r.id_rol = ur.id_rol
    WHERE ur.id_usuario = $1
      AND r.estado_rol = 'ACTIVO';
  `;

  const { rows } = await pool.query(sql, [id_usuario]);
  return rows.map(r => r.nombre_rol);
}

/**
 * Middleware dinámico:
 * requireRoles('ADMIN')
 * requireRoles('ADMIN', 'SUPERADMIN')
 */
function requireRoles(...rolesPermitidos) {
  return async (req, res, next) => {
    try {
      if (!req.user || !req.user.id_usuario) {
        return res.status(401).json({
          ok: false,
          msg: 'Token inválido o usuario no identificado'
        });
      }

      const id_usuario = req.user.id_usuario;

      // Obtener roles desde token
      let rolesUsuario = req.user.roles || [];

      // Si vienen como objetos ({ id_rol, nombre_rol })
      if (rolesUsuario.length && typeof rolesUsuario[0] === 'object') {
        rolesUsuario = rolesUsuario.map(r => r.nombre_rol);
      }

      // Si no vienen en el token, consultar BD
      if (!rolesUsuario.length) {
        rolesUsuario = await obtenerRolesDesdeBD(id_usuario);
      }

      // Validar si tiene algún rol permitido
      const tienePermiso = rolesUsuario.some(rol =>
        rolesPermitidos.includes(rol)
      );

      if (!tienePermiso) {
        await registrarEvento({
          id_usuario,
          tipo_accion: 'ACCESS_DENIED_ROLE',
          tabla_afectada: null,
          registro_afectado: null,
          ip_origen: req.ip,
          descripcion_log: `Intento de acceso a ${req.originalUrl} sin roles requeridos (${rolesPermitidos.join(', ')})`
        });

        return res.status(403).json({
          ok: false,
          msg: `Acceso denegado. Roles requeridos: ${rolesPermitidos.join(', ')}`
        });
      }

      req.roles = rolesUsuario;
      next();

    } catch (error) {
      return res.status(500).json({
        ok: false,
        msg: 'Error validando roles',
        error: error.message
      });
    }
  };
}

/**
 * Middlewares preconfigurados
 */
const soloSuperAdmin = requireRoles('SUPERADMIN');
const soloAdmin = requireRoles('ADMIN', 'SUPERADMIN');
const soloLogistica = requireRoles('LOGISTICA', 'ADMIN', 'SUPERADMIN');
const soloConsulta = requireRoles('CONSULTA', 'ADMIN', 'SUPERADMIN');

module.exports = {
  requireRoles,
  soloSuperAdmin,
  soloAdmin,
  soloLogistica,
  soloConsulta
};