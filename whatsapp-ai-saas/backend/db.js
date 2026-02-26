const { Pool } = require('pg');
require('dotenv').config();

// Initialize PostgreSQL Connection Pool
// Falls back to a default local string if DATABASE_URL is not in .env
const pool = new Pool({
    connectionString: process.env.DATABASE_URL || 'postgres://postgres:password@localhost:5432/whatsapp_saas',
});

let isDbConnected = false;

async function initDB() {
    try {
        const client = await pool.connect();

        // Create logs table if it doesn't exist
        await client.query(`
            CREATE TABLE IF NOT EXISTS copilot_logs (
                id SERIAL PRIMARY KEY,
                instance_id VARCHAR(255) NOT NULL,
                contact_name VARCHAR(255) NOT NULL,
                extracted_context JSONB NOT NULL,
                proposed_replies JSONB NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
        `);

        client.release();
        isDbConnected = true;
        console.log('[PostgreSQL] Connected and copilot_logs table verified.');
    } catch (err) {
        console.warn('[PostgreSQL] Could not connect to database. Logging will be bypassed.', err.message);
    }
}

// Fire and forget initialization
initDB();

async function logCopilotInteraction(instance_id, contact_name, context, proposals) {
    if (!isDbConnected) {
        console.log(`[DB Mock] Logged interaction for ${instance_id} with ${contact_name}`);
        return;
    }

    try {
        const query = `
            INSERT INTO copilot_logs (instance_id, contact_name, extracted_context, proposed_replies)
            VALUES ($1, $2, $3, $4)
        `;
        const values = [
            instance_id,
            contact_name,
            JSON.stringify(context),
            JSON.stringify(proposals)
        ];

        await pool.query(query, values);
    } catch (err) {
        console.error('[PostgreSQL] Error logging interaction:', err.message);
    }
}

module.exports = {
    pool,
    logCopilotInteraction
};
