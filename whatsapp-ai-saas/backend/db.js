const sqlite3 = require('sqlite3').verbose();
const { open } = require('sqlite');
const path = require('path');

let isDbConnected = false;

// Open SQLite database
const dbPromise = open({
    filename: path.join(__dirname, 'database.sqlite'),
    driver: sqlite3.Database
});

// Mocking the PostgreSQL 'pool' interface so we don't have to rewrite server.js
const pool = {
    async query(text, params = []) {
        const db = await dbPromise;

        // 1. Convert PostgreSQL positional parameters ($1, $2) to SQLite's (?)
        let sqliteText = text.replace(/\$\d+/g, '?');

        // 2. Postgres specific type adjustments for CREATE TABLE
        sqliteText = sqliteText.replace(/SERIAL PRIMARY KEY/gi, 'INTEGER PRIMARY KEY AUTOINCREMENT');
        sqliteText = sqliteText.replace(/JSONB/gi, 'TEXT'); // SQLite uses TEXT for JSON

        // 3. PostgreSQL RETURNING and SELECT expect rows back
        const isSelect = sqliteText.trim().toUpperCase().startsWith('SELECT') || sqliteText.toUpperCase().includes('RETURNING');

        if (isSelect) {
            const rows = await db.all(sqliteText, params);
            return { rows };
        } else {
            const result = await db.run(sqliteText, params);
            return { rows: [], lastID: result.lastID, changes: result.changes };
        }
    },

    // Mock pooling client for transactions
    async connect() {
        return {
            query: async (text, params) => pool.query(text, params),
            release: () => { /* No-op for SQLite */ }
        };
    }
};

async function initDB() {
    try {
        const client = await pool.connect();

        // Create logs table if it doesn't exist
        await client.query(`
            CREATE TABLE IF NOT EXISTS copilot_logs (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                instance_id VARCHAR(255) NOT NULL,
                contact_name VARCHAR(255) NOT NULL,
                extracted_context TEXT NOT NULL,
                proposed_replies TEXT NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
        `);

        // Phase 13: WhatsApp Contact Management Tables
        await client.query(`
            CREATE TABLE IF NOT EXISTS wa_contact_lists (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name VARCHAR(255) NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
        `);

        await client.query(`
            CREATE TABLE IF NOT EXISTS wa_segments (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name VARCHAR(255) NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
        `);

        await client.query(`
            CREATE TABLE IF NOT EXISTS wa_contacts (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name VARCHAR(255) NOT NULL,
                phone VARCHAR(50) NOT NULL,
                list_id INTEGER REFERENCES wa_contact_lists(id) ON DELETE SET NULL,
                segment_id INTEGER REFERENCES wa_segments(id) ON DELETE SET NULL,
                status VARCHAR(50) DEFAULT 'unverified',
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
        `);

        // Migration for the Phase 14: Add 'status' to existing table if it doesn't exist
        try {
            await client.query("ALTER TABLE wa_contacts ADD COLUMN status VARCHAR(50) DEFAULT 'unverified'");
        } catch (err) {
            // Ignore error if column already exists (SQLite throws if column exists)
        }

        client.release();
        isDbConnected = true;
        console.log('[SQLite] Connected and tables verified.');
    } catch (err) {
        console.warn('[SQLite] Could not initialize database. Logging will be bypassed.', err.message);
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
        console.error('[SQLite] Error logging interaction:', err.message);
    }
}

module.exports = {
    pool,
    logCopilotInteraction
};
