const { RateLimiterPostgres } = require('rate-limiter-flexible');

/**
 * Crea un rate limiter usando PostgreSQL como storage.
 * opts: { storeClient, points, duration, keyPrefix? }
 */
async function createRateLimiter(opts = {}) {
  const { storeClient, points = 5, duration = 1, keyPrefix = 'rlflx' } = opts;

  if (!storeClient) {
    throw new Error('rate-limiter: storeClient es requerido (pool de PostgreSQL)');
  }

  const limiter = new RateLimiterPostgres({
    storeClient,
    points,
    duration,
    keyPrefix,
    tableName: 'rate_limiter', // puedes dejarlo así
    dbName: undefined,         // no es necesario con pool
  });

  // Asegura conexión/tabla (rate-limiter-flexible la crea si aplica)
  // En algunos entornos no hace falta tocar nada aquí.
  return limiter;
}

module.exports = createRateLimiter;