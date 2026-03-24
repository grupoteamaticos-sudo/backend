const { createClient } = require('redis');

const client = createClient({
  url: process.env.REDIS_URL,
  socket: {
    reconnectStrategy: (retries) => {
      if (retries > 10) {
        console.error('❌ Límite de reintentos de Redis alcanzado.');
        return new Error('Retry limit reached');
      }
      return Math.min(retries * 200, 5000); // Reintento progresivo
    }
  }
});

client.on('connect', () => console.log('🔄 Intentando conectar a Redis Cloud...'));
client.on('ready', () => console.log('✅ Redis conectado y listo para usar'));
client.on('error', (err) => console.error('❌ Error crítico en Redis:', err.message));

(async () => {
  try {
    if (!client.isOpen) {
      await client.connect();
    }
  } catch (error) {
    console.error('❌ Error en la conexión inicial de Redis:', error.message);
  }
})();

module.exports = client;