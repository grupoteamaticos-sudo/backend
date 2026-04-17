const pool = require('../DB/db');

/* =========================================
   LISTAR PERSONAS
========================================= */
async function listarPersonas() {
  const { rows } = await pool.query(`
    SELECT 
      p.id_persona,
      CONCAT(
        p.primer_nombre, ' ',
        COALESCE(p.segundo_nombre, ''), ' ',
        p.primer_apellido, ' ',
        COALESCE(p.segundo_apellido, '')
      ) AS nombre_completo
    FROM persona p
    WHERE p.estado_persona = 'ACTIVO'
    AND NOT EXISTS (
      SELECT 1 
      FROM empleado e 
      WHERE e.id_persona = p.id_persona
    )
    ORDER BY p.primer_nombre;
  `);

  return rows;
}

/* =========================================
   CREAR PERSONA (SP)
========================================= */
async function crearPersona(data) {
  const {
    primer_nombre,
    segundo_nombre,
    primer_apellido,
    segundo_apellido,
    identidad,
    fecha_nacimiento,
    sexo,

    tipo_telefono,
    numero,

    pais,
    departamento,
    municipio,
    colonia_barrio,
    direccion_detallada,

    correo,

    id_usuario_accion,
    ip_origen
  } = data;

  // CALL al SP (OUT se pasa como NULL)
  await pool.query(
    `
    CALL sp_persona_crear(
      $1,$2,$3,$4,$5,$6,$7,
      $8,$9,
      $10,$11,$12,$13,$14,
      $15,
      $16,$17,
      $18
    );
    `,
    [
      primer_nombre,
      segundo_nombre,
      primer_apellido,
      segundo_apellido,
      identidad,
      fecha_nacimiento,
      sexo,

      tipo_telefono,
      numero,

      pais,
      departamento,
      municipio,
      colonia_barrio,
      direccion_detallada,

      correo,

      id_usuario_accion,
      ip_origen,

      null // OUT p_id_persona
    ]
  );

  return true;
}

// fin del archivo 

module.exports = {
  listarPersonas,
  crearPersona
};