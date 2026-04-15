const {
  listarEmpleados,
  crearEmpleado
} = require('../../service/empleados-service');

const getEmpleados = async (req, res) => {
  try {
    const data = await listarEmpleados();
    res.json({ ok: true, data });
  } catch (error) {
    res.status(500).json({ ok: false, msg: error.message });
  }
};

const postEmpleado = async (req, res) => {
  try {

    const {
      id_persona,
      id_departamento,
      id_estatus_empleado,
      id_puesto,
      id_sucursal,
      codigo_empleado,
      fecha_ingreso
    } = req.body;

    const id_usuario_accion = req.usuario?.id_usuario;
    const ip_origen = req.ip;

    await crearEmpleado({
      id_persona,
      id_departamento,
      id_estatus_empleado,
      id_puesto,
      id_sucursal,
      codigo_empleado,
      fecha_ingreso,
      id_usuario_accion,
      ip_origen
    });

    res.status(201).json({
      ok: true,
      msg: 'Empleado creado correctamente'
    });

  } catch (error) {
    res.status(500).json({ ok: false, msg: error.message });
  }
};

module.exports = {
  getEmpleados,
  postEmpleado
};