const redis = require('redis');
require('dotenv').config();

const redisClient = redis.createClient({
    url: process.env.REDIS_URL || 'redis://localhost:6379'
});

let isRedisConnected = false;

redisClient.on('error', (err) => {
    // We only log the first connection error to avoid spam
    if (!isRedisConnected) {
        console.warn('[Redis] Could not connect to cache server. Caching bypassed.', err.message);
    }
});

redisClient.on('connect', () => {
    isRedisConnected = true;
    console.log('[Redis] Connected for session caching.');
});

// Attempt to connect, but don't crash if it fails
redisClient.connect().catch(() => { });

async function getCachedProposals(cacheKey) {
    if (!isRedisConnected) return null;
    try {
        const cached = await redisClient.get(cacheKey);
        if (cached) {
            return JSON.parse(cached);
        }
    } catch (err) {
        console.error('[Redis] Get Error:', err.message);
    }
    return null;
}

async function setCachedProposals(cacheKey, proposals, expirationSeconds = 60) {
    if (!isRedisConnected) return;
    try {
        await redisClient.setEx(cacheKey, expirationSeconds, JSON.stringify(proposals));
    } catch (err) {
        console.error('[Redis] Set Error:', err.message);
    }
}

module.exports = {
    redisClient,
    getCachedProposals,
    setCachedProposals
};
