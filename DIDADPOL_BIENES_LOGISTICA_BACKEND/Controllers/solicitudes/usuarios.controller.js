const {
  listarUsuarios,
  obtenerUsuario,
  crearUsuario,
  actualizarUsuario,
  bloquearUsuario,
  inactivarUsuario,
  cambiarPassword
} = require('../../service/usuarios-service');

/* ============================================================
   LISTAR
   ============================================================ */
const getUsuarios = async (req, res) => {
  try {
    const data = await listarUsuarios();
    res.json({ ok: true, data });
  } catch (error) {
    res.status(500).json({ ok: false, msg: error.message });
  }
};

/* ============================================================
   OBTENER
   ============================================================ */
const getUsuario = async (req, res) => {
  try {
    const user = await obtenerUsuario(req.params.id);

    if (!user) {
      return res.status(404).json({ ok: false, msg: 'Usuario no encontrado' });
    }

    res.json({ ok: true, user });
  } catch (error) {
    res.status(500).json({ ok: false, msg: error.message });
  }
};

/* ============================================================
   CREAR
   ============================================================ */
const postUsuario = async (req, res) => {
  try {
    const {
      id_empleado,
      nombre_usuario,
      password,
      correo_login,
      id_rol,
      activo
    } = req.body;

    const id_usuario_accion = req.user?.id_usuario;
    const ip_origen = req.ip;

    const user = await crearUsuario({
      id_empleado,
      nombre_usuario,
      password,
      correo_login,
      id_rol,
      activo,
      id_usuario_accion,
      ip_origen
    });

    res.status(201).json({ ok: true, user });
  } catch (error) {
    res.status(500).json({ ok: false, msg: error.message });
  }
};

/* ============================================================
   ACTUALIZAR
   ============================================================ */
const patchUsuario = async (req, res) => {
  try {
    const data = await actualizarUsuario(req.params.id, req.body);
    res.json({ ok: true, data });
  } catch (error) {
    res.status(500).json({ ok: false, msg: error.message });
  }
};

/* ============================================================
   BLOQUEO
   ============================================================ */
const patchBloqueo = async (req, res) => {
  try {
    const data = await bloquearUsuario(req.params.id);
    res.json({ ok: true, data });
  } catch (error) {
    res.status(500).json({ ok: false, msg: error.message });
  }
};

/* ============================================================
   INACTIVAR
   ============================================================ */
const inactivarUsuarioController = async (req, res) => {
  try {
    await inactivarUsuario(req.params.id);
    res.json({ ok: true, msg: 'Usuario inactivado correctamente' });
  } catch (error) {
    res.status(500).json({ ok: false, msg: error.message });
  }
};

/* ============================================================
   CAMBIAR PASSWORD
   ============================================================ */
const cambiarPasswordUsuario = async (req, res) => {
  try {
    const id_usuario_objetivo = req.params.id;
    const { currentPassword, newPassword } = req.body;

    const esAdmin = req.user?.roles?.some(
      r => r.nombre_rol === 'ADMIN' || r.nombre_rol === 'SUPERADMIN'
    );

    await cambiarPassword({
      id_usuario_objetivo,
      currentPassword,
      newPassword,
      esAdmin
    });

    res.json({ ok: true, msg: 'Contraseña actualizada correctamente' });
  } catch (error) {
    res.status(400).json({
      ok: false,
      msg: error.message
    });
  }
};

module.exports = {
  getUsuarios,
  getUsuario,
  postUsuario,
  patchUsuario,
  patchBloqueo,
  inactivarUsuarioController,
  cambiarPasswordUsuario
};