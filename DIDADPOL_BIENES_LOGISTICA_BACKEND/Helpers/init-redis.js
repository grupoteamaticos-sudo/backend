const { createClient } = require('redis');

const client = createClient({
  url: process.env.REDIS_URL,
  socket: {
    reconnectStrategy: (retries) => {
      if (retries > 5) {
        console.error('Redis reconnection limit reached.');
        return new Error('Retry limit reached');
      }
      return Math.min(retries * 100, 3000);
    }
  }
});

client.on('connect', () => {
  console.log('🔄 Connecting to Redis...');
});

client.on('ready', () => {
  console.log('✅ Redis connected and ready');
});

client.on('error', (err) => {
  console.error('❌ Redis error:', err.message);
});

client.on('end', () => {
  console.warn('⚠️ Redis connection closed');
});

(async () => {
  try {
    await client.connect();
  } catch (error) {
    console.error('Redis initial connection failed:', error.message);
  }
})();

process.on('SIGINT', async () => {
  await client.quit();
  process.exit(0);
});

module.exports = client;