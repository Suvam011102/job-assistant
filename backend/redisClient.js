const { createClient } = require("redis");

const REDIS_URL = process.env.REDIS_URL || "redis://localhost:6379";

const redisClient = createClient({
  url: REDIS_URL,
  socket: {
    connectTimeout: 1000,
    reconnectStrategy: () => false,
  },
});

let isReady = false;
let connectPromise = null;

redisClient.on("ready", () => {
  isReady = true;
  console.log("Redis connected");
});

redisClient.on("end", () => {
  isReady = false;
});

redisClient.on("error", (error) => {
  isReady = false;
  console.warn("Redis unavailable:", error.message || "connection failed");
});

async function ensureRedisConnection() {
  if (isReady) {
    return true;
  }

  if (!connectPromise) {
    connectPromise = redisClient
      .connect()
      .then(() => true)
      .catch((error) => {
        console.warn("Continuing without Redis cache:", error.message);
        return false;
      })
      .finally(() => {
        connectPromise = null;
      });
  }

  return connectPromise;
}

async function getCachedValue(key) {
  const canUseRedis = await ensureRedisConnection();
  if (!canUseRedis) {
    return null;
  }

  try {
    return await redisClient.get(key);
  } catch (error) {
    console.warn("Redis get failed:", error.message);
    return null;
  }
}

async function setCachedValue(key, ttlSeconds, value) {
  const canUseRedis = await ensureRedisConnection();
  if (!canUseRedis) {
    return false;
  }

  try {
    await redisClient.setEx(key, ttlSeconds, value);
    return true;
  } catch (error) {
    console.warn("Redis set failed:", error.message);
    return false;
  }
}

module.exports = {
  getCachedValue,
  setCachedValue,
};
