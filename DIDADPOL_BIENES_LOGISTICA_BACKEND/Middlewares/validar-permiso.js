const pool = require('../DB/db');
const { registrarEvento } = require('../Helpers/auditoria');

/**
 * Obtiene permisos desde BD si no vienen correctamente en el token
 */
async function obtenerPermisosDesdeBD(id_usuario) {
  const sql = `
    SELECT DISTINCT p.codigo_permiso
    FROM usuario_rol ur
    INNER JOIN rol r ON r.id_rol = ur.id_rol
    INNER JOIN rol_permiso rp ON rp.id_rol = r.id_rol
    INNER JOIN permiso p ON p.id_permiso = rp.id_permiso
    WHERE ur.id_usuario = $1
      AND r.estado_rol = 'ACTIVO'
      AND p.estado_permiso = 'ACTIVO';
  `;

  const { rows } = await pool.query(sql, [id_usuario]);
  return rows.map(r => r.codigo_permiso);
}

function normalizarPermisosDesdeToken(permisosToken = []) {
  if (!Array.isArray(permisosToken) || permisosToken.length === 0) return [];

  // Si vienen como strings
  if (typeof permisosToken[0] === 'string') {
    return permisosToken;
  }

  // Si vienen como objetos
  return permisosToken
    .map(p => p?.codigo_permiso)
    .filter(Boolean);
}

/**
 * Middleware:
 * checkPermission("USUARIO_CREAR")
 * checkPermission("ROL_VER", "ROL_EDITAR")
 */
function checkPermission(...permisosRequeridos) {
  return async (req, res, next) => {
    try {
      const usuario = req.user;

      if (!usuario || !usuario.id_usuario) {
        return res.status(401).json({
          ok: false,
          message: 'Token inválido o usuario no identificado'
        });
      }

      const id_usuario = usuario.id_usuario;

      let permisosUsuario = normalizarPermisosDesdeToken(usuario.permisos);

      if (!permisosUsuario.length) {
        permisosUsuario = await obtenerPermisosDesdeBD(id_usuario);
      }

      const tienePermiso = permisosRequeridos.some(p =>
        permisosUsuario.includes(p)
      );

      if (!tienePermiso) {
        await registrarEvento({
          id_usuario,
          tipo_accion: 'ACCESS_DENIED_PERMISSION',
          tabla_afectada: null,
          registro_afectado: null,
          ip_origen: req.ip,
          descripcion_log: `Intento sin permiso(s): ${permisosRequeridos.join(', ')}`
        });

        return res.status(403).json({
          ok: false,
          message: `No tienes permiso para esta acción. Requiere: ${permisosRequeridos.join(', ')}`
        });
      }

      next();
    } catch (error) {
      return res.status(500).json({
        ok: false,
        message: 'Error verificando permisos',
        error: error.message
      });
    }
  };
}

module.exports = {
  checkPermission
};