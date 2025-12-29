const redis = require('redis');

let redisClient;

const connectRedis = async () => {
  redisClient = redis.createClient({
    url: process.env.REDIS_URL || 'redis://localhost:6379'
  });

  redisClient.on('error', (err) => console.log('Redis Client Error', err));
  redisClient.on('connect', () => console.log('Redis Client Connected'));

  await redisClient.connect();
  return redisClient;
};

const getRedisClient = () => redisClient;

module.exports = { connectRedis, getRedisClient };