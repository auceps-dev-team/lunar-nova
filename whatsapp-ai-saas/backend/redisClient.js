const redis = require('redis');
// quiet: true — voir la note équivalente dans geminiService.js.
require('dotenv').config({ quiet: true });

const redisClient = redis.createClient({
    url: process.env.REDIS_URL || 'redis://localhost:6379',
    socket: {
        reconnectStrategy: (retries) => {
            // Stop retrying after 3 attempts to avoid infinite reconnect loops
            if (retries >= 3) return false;
            return Math.min(retries * 500, 2000);
        }
    }
});

let isRedisConnected = false;
let hasLoggedError = false; // Separate flag to prevent error spam

redisClient.on('error', (err) => {
    isRedisConnected = false;
    // Only log once, regardless of how many reconnect attempts fire
    if (!hasLoggedError) {
        hasLoggedError = true;
        console.error('[CRITICAL] Redis connection failed. Caching bypassed and falling back to direct API/DB calls.', err.message);
    }
});

redisClient.on('connect', () => {
    isRedisConnected = true;
    hasLoggedError = false; // Reset so reconnection success is visible
    console.log('[Redis] Connected for session caching.');
});

redisClient.on('reconnecting', () => {
    // Silent — no spam on reconnect attempts
});

// Attempt to connect, but don't crash if it fails
redisClient.connect().catch(() => { });

async function getCachedProposals(cacheKey) {
    if (!isRedisConnected) {
        console.warn('[Redis] Fallback: Cache read bypassed, returning null.');
        return null;
    }
    try {
        const cached = await redisClient.get(cacheKey);
        if (cached) {
            return JSON.parse(cached);
        }
    } catch (err) {
        console.error('[CRITICAL] Redis Get Error, using fallback:', err.message);
    }
    return null;
}

async function setCachedProposals(cacheKey, proposals, expirationSeconds = 60) {
    if (!isRedisConnected) {
        console.warn('[Redis] Fallback: Cache write bypassed.');
        return;
    }
    try {
        await redisClient.setEx(cacheKey, expirationSeconds, JSON.stringify(proposals));
    } catch (err) {
        console.error('[CRITICAL] Redis Set Error:', err.message);
    }
}

module.exports = {
    redisClient,
    getCachedProposals,
    setCachedProposals
};