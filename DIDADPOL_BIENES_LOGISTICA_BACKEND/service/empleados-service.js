const pool = require('../DB/db');

/* =========================================
   LISTAR EMPLEADOS (CORRECTO)
========================================= */
async function listarEmpleados() {
  const sql = `
  SELECT 
    e.id_empleado,
    e.codigo_empleado,
    e.fecha_ingreso,
    e.estado_empleado,
    e.fecha_registro,

    p.id_persona,
    CONCAT(p.primer_nombre, ' ', p.primer_apellido) AS nombre,

    d.nombre_departamento,
    pu.nombre_puesto,
    s.nombre_sucursal

  FROM empleado e
  LEFT JOIN persona p ON p.id_persona = e.id_persona
  LEFT JOIN departamento d ON d.id_departamento = e.id_departamento
  LEFT JOIN puesto pu ON pu.id_puesto = e.id_puesto
  LEFT JOIN sucursal s ON s.id_sucursal = e.id_sucursal

  ORDER BY e.id_empleado;
`;

  const { rows } = await pool.query(sql);

  return rows.map(r => ({
    ...r,
    nombre_completo: `${r.primer_nombre} ${r.segundo_nombre || ''} ${r.primer_apellido} ${r.segundo_apellido || ''}`.trim()
  }));
}

/* =========================================
   CREAR EMPLEADO (USANDO SP)
========================================= */
async function crearEmpleado({
  id_persona,
  id_departamento,
  id_estatus_empleado,
  id_puesto,
  id_sucursal,
  codigo_empleado,
  fecha_ingreso,
  id_usuario_accion,
  ip_origen
}) {

  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    await client.query(
      `
      CALL sp_empleado_crear(
        $1,$2,$3,$4,$5,$6,$7,$8,$9,$10
      );
      `,
      [
        id_persona,
        id_departamento,
        id_estatus_empleado,
        id_puesto,
        id_sucursal,
        codigo_empleado,
        fecha_ingreso,
        id_usuario_accion,
        ip_origen,
        null
      ]
    );

    await client.query('COMMIT');

    return { ok: true };

  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

module.exports = {
  listarEmpleados,
  crearEmpleado
};