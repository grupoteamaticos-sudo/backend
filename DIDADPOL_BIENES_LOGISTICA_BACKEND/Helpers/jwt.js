const jwt = require('jsonwebtoken');
const pool = require('../DB/db');
// const client = require('./init-redis'); // Comentado: No se usará Redis en Render por ahora

/* ============================================================
   ACCESS TOKEN – Configurable por .env
   ============================================================ */
const generateAuhtJWT = (payload = {}) => {
    return new Promise((resolve, reject) => {
        jwt.sign(
            payload,
            process.env.ACCESS_JWT_SECRET,
            {
                expiresIn: process.env.ACCESS_EXPIRES || '9h'
            },
            (error, token) => {
                if (error) return reject(error);
                resolve(token);
            }
        );
    });
};

/* ============================================================
   TOKEN PRINCIPAL (legacy opcional)
   ============================================================ */
const generateJWT = (payload = {}) => {
    return new Promise((resolve, reject) => {
        jwt.sign(
            payload,
            process.env.SECRET_JWT_SEED,
            {
                expiresIn: process.env.ACCESS_EXPIRES || '1d'
            },
            async (error, token) => {
                if (error) return reject(error);

                /* DESHABILITADO REDIS:
                await client.SET(
                    `session:${payload.id_usuario}`,
                    token,
                    {
                        EX: 24 * 60 * 60
                    }
                );
                */
                resolve(token);
            }
        );
    });
};

/* ============================================================
   REFRESH TOKEN ENTERPRISE
   ============================================================ */
const generateRefreshToken = (payload = {}) => {
    return new Promise((resolve, reject) => {
        jwt.sign(
            payload,
            process.env.REFRESH_JWT_SECRET,
            {
                expiresIn: process.env.REFRESH_EXPIRES || '7d'
            },
            async (error, token) => {
                if (error) return reject(error);

                /* DESHABILITADO REDIS:
                const expiresSeconds = 7 * 24 * 60 * 60;
                await client.SET(
                    `refresh:${payload.id_usuario}`,
                    token,
                    { EX: expiresSeconds }
                );
                */

                resolve(token);
            }
        );
    });
};

/* ============================================================
   TOKEN DE RECUPERACIÓN
   ============================================================ */
const generateJWTRecovery = async (uid = '') => {
    const payload = { uid };
    const query = await pool.query(
        'SELECT * FROM FN_VENCIMIENTO_RECOVERY()'
    );
    const vencimiento = query.rows[0].t_vencimiento;

    return new Promise((resolve, reject) => {
        jwt.sign(
            payload,
            process.env.SECRET_JWT_RECOVERY_SEED,
            { expiresIn: `${vencimiento} days` },
            (error, token) => {
                if (error) reject(error);
                else resolve(token);
            }
        );
    });
};

/* ============================================================
   VERIFICAR ACCESS TOKEN
   ============================================================ */
const comprobarToken = async (token = '') => {
    if (!token) return null;
    try {
        const decoded = jwt.verify(
            token,
            process.env.ACCESS_JWT_SECRET
        );

        const user = (
            await pool.query(
                `SELECT * FROM FN_INFO_USUARIO($1)`,
                [decoded.id_usuario]
            )
        ).rows[0];

        if (!user) return null;
        if (user.t_estado !== 1) return null;

        return user;
    } catch (error) {
        console.log('❌ Error comprobando token:', error);
        return null;
    }
};

/* ============================================================
   VERIFICAR REFRESH TOKEN
   ============================================================ */
const verifyRefreshToken = async (token = '') => {
    try {
        const decoded = jwt.verify(
            token,
            process.env.REFRESH_JWT_SECRET
        );

        /* DESHABILITADO REDIS:
        const stored = await client.GET(
            `refresh:${decoded.id_usuario}`
        );
        if (!stored || stored !== token) return null;
        */

        return decoded;
    } catch (error) {
        console.log('❌ Refresh token inválido:', error);
        return null;
    }
};

/* ============================================================
   CERRAR SESIÓN
   ============================================================ */
const invalidateJWT = async (id_usuario = '') => {
    try {
        /* DESHABILITADO REDIS:
        await client.DEL(`session:${id_usuario}`);
        await client.DEL(`refresh:${id_usuario}`);
        */
        return true;
    } catch (error) {
        console.log('❌ Error invalidando token:', error);
        return false;
    }
};

module.exports = {
    generateAuhtJWT,
    generateJWT,
    generateRefreshToken,
    generateJWTRecovery,
    comprobarToken,
    verifyRefreshToken,
    invalidateJWT
};