/* -----------------------------------------------------------------------
	Proyecto [ *** BIENES Y LOGISTICA ***]


Equipo:
Juan Cerrato .......... (grupoteamaticos@gmail.com)

-----------------------------------------------------------------------
---------------------------------------------------------------------

Programa:         
Fecha:              24/02/2026
Programador:        Juan Cerrato
descripcion:        Conexion DB Postgres

-----------------------------------------------------------------------
-----------------------------------------------------------------------

                Historial de Cambio

-----------------------------------------------------------------------

Programador               Fecha                      Descripcion

-----------------------------------------------------------------------
----------------------------------------------------------------------- */
const { Pool } = require('pg');
require('dotenv').config();
const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false
  }
});



pool.connect()
  .then(() => console.log('✅ PostgreSQL conectado'))
  .catch(err => console.error('❌ Error PostgreSQL:', err.message));
  
module.exports = pool;