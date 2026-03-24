/* -----------------------------------------------------------------------
  Proyecto [ *** BIENES Y LOGISTICA ***]
  Conexion DB Postgres - Local & Render Ready
----------------------------------------------------------------------- */
const { Pool } = require('pg');
require('dotenv').config();

// Detectamos si estamos en producción (Render) o desarrollo (Tu PC)
const isProduction = process.env.NODE_ENV === 'production';

const pool = new Pool({
    // Si existe DATABASE_URL (Render), la usa. Si no, usa los datos individuales del .env
    connectionString: process.env.DATABASE_URL,
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_DATABASE,
    port: process.env.DB_PORT,
    
    // Solo pide SSL si estamos en producción (Render)
    ssl: isProduction ? { rejectUnauthorized: false } : false
});

// Verificación de conexión
pool.connect()
    .then(() => console.log('✅ PostgreSQL conectado correctamente'))
    .catch(err => {
        console.error('❌ Error de conexión PostgreSQL:', err.message);
        if (isProduction) {
            console.error('👉 Revisa que DATABASE_URL esté en la pestaña Environment de Render.');
        } else {
            console.error('👉 Revisa que tu servicio de Postgres local esté encendido y los datos del .env sean correctos.');
        }
    });

module.exports = pool;