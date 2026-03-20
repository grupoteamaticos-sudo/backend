/* -----------------------------------------------------------------------
  Proyecto [ *** BIENES Y LOGISTICA ***]
  Conexion DB Postgres - Render Ready
----------------------------------------------------------------------- */
const { Pool } = require('pg');
require('dotenv').config();

// Configuración del pool usando la URL de conexión de Render
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false // Requerido para conexiones externas en Render/Azure/AWS
  }
});

// Verificación de conexión
pool.connect()
  .then(() => console.log('✅ PostgreSQL conectado correctamente'))
  .catch(err => {
    console.error('❌ Error de conexión PostgreSQL:', err.message);
    console.error('👉 Revisa que DATABASE_URL esté en la pestaña Environment de Render.');
  });

module.exports = pool;