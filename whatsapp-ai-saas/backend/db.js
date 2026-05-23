const sqlite3 = require('sqlite3').verbose();
const { open } = require('sqlite');
const path = require('path');

let isDbConnected = false;

// Determiner le chemin de la base de données
const dbFileName = 'database.sqlite';
// En production (forked depuis main.cjs), process.env.USER_DATA_PATH sera défini.
// En dev, on garde le dossier backend local.
const userDataPath = process.env.USER_DATA_PATH;
const dbFilePath = userDataPath ? path.join(userDataPath, dbFileName) : path.join(__dirname, '..', dbFileName);

// Open SQLite database
const dbPromise = open({
    filename: dbFilePath,
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
            return { rows, rowCount: rows.length };
        } else {
            const result = await db.run(sqliteText, params);
            return { rows: [], lastID: result.lastID, changes: result.changes, rowCount: result.changes };
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
                provider VARCHAR(50),
                model VARCHAR(100),
                tokens INTEGER DEFAULT 0,
                cost REAL DEFAULT 0.0,
                status VARCHAR(50) DEFAULT 'success',
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
        `);

        // Migrations for Phase 2: Add tracking columns to copilot_logs
        try { await client.query("ALTER TABLE copilot_logs ADD COLUMN provider VARCHAR(50)"); } catch(e) {}
        try { await client.query("ALTER TABLE copilot_logs ADD COLUMN model VARCHAR(100)"); } catch(e) {}
        try { await client.query("ALTER TABLE copilot_logs ADD COLUMN tokens INTEGER DEFAULT 0"); } catch(e) {}
        try { await client.query("ALTER TABLE copilot_logs ADD COLUMN cost REAL DEFAULT 0.0"); } catch(e) {}
        try { await client.query("ALTER TABLE copilot_logs ADD COLUMN status VARCHAR(50) DEFAULT 'success'"); } catch(e) {}

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

        // Migration for Phase 18.3: Add 'email' and 'address' columns
        try {
            await client.query("ALTER TABLE wa_contacts ADD COLUMN email TEXT");
        } catch (err) {
            // Column already exists
        }
        try {
            await client.query("ALTER TABLE wa_contacts ADD COLUMN address TEXT");
        } catch (err) {
            // Column already exists
        }

        // Migration for missing list_id
        try {
            await client.query("ALTER TABLE wa_contacts ADD COLUMN list_id INTEGER REFERENCES wa_contact_lists(id) ON DELETE SET NULL");
        } catch (err) {
            // Column already exists
        }

        // Phase 19.5: Message Tracking
        await client.query(`
            CREATE TABLE IF NOT EXISTS wa_message_logs (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                contact_id INTEGER REFERENCES wa_contacts(id) ON DELETE SET NULL,
                message TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
        `);

        // Phase 15: AI Modularity
        await client.query(`
            CREATE TABLE IF NOT EXISTS app_settings (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                setting_key VARCHAR(255) UNIQUE NOT NULL,
                setting_value TEXT
            );
        `);

        // Phase 26: AI Writer Documents
        await client.query(`
            CREATE TABLE IF NOT EXISTS ai_documents (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                title VARCHAR(255) NOT NULL,
                content TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
        `);

        await client.query(`
            INSERT OR IGNORE INTO app_settings (setting_key, setting_value)
            VALUES ('default_ai_provider', 'gemini')
        `);

        await client.query(`
            CREATE TABLE IF NOT EXISTS ai_agents (
                id VARCHAR(255) PRIMARY KEY,
                name VARCHAR(255) NOT NULL,
                system_instruction TEXT NOT NULL,
                response_format VARCHAR(50) DEFAULT 'text',
                provider_override VARCHAR(50) DEFAULT NULL,
                model_override VARCHAR(100) DEFAULT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
        `);

        // Migrations for Phase 2: Add model_override to ai_agents
        try { await client.query("ALTER TABLE ai_agents ADD COLUMN model_override VARCHAR(100) DEFAULT NULL"); } catch(e) {}

        // WordPress Bridge (Phase 30) — v2.0 uses App Passwords
        await client.query(`
            CREATE TABLE IF NOT EXISTS wp_connections (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name TEXT NOT NULL,
                site_url TEXT NOT NULL,
                wp_username TEXT NOT NULL DEFAULT '',
                app_password TEXT NOT NULL DEFAULT '',
                token TEXT DEFAULT '',
                is_active INTEGER DEFAULT 1,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
        `);

        // Migration v2.0: add App Password columns to existing tables
        try { await client.query("ALTER TABLE wp_connections ADD COLUMN wp_username TEXT NOT NULL DEFAULT ''"); } catch(e) {}
        try { await client.query("ALTER TABLE wp_connections ADD COLUMN app_password TEXT NOT NULL DEFAULT ''"); } catch(e) {}

        client.release();
        isDbConnected = true;
        console.log('[SQLite] Connected and tables verified.');
    } catch (err) {
        console.error('[CRITICAL] DB Init Failed:', err.message);
        process.exit(1);
    }
}

// Fire and forget initialization
initDB();

async function logCopilotInteraction(instance_id, contact_name, context, proposals, provider = 'gemini', model = 'gemini-1.5-pro', tokens = 0, cost = 0.0, status = 'success') {
    if (!isDbConnected) {
        console.log(`[DB Mock] Logged interaction for ${instance_id} with ${contact_name}`);
        return;
    }

    try {
        const query = `
            INSERT INTO copilot_logs (instance_id, contact_name, extracted_context, proposed_replies, provider, model, tokens, cost, status)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
        `;
        const values = [
            instance_id,
            contact_name,
            JSON.stringify(context),
            JSON.stringify(proposals),
            provider,
            model,
            tokens,
            cost,
            status
        ];

        await pool.query(query, values);
    } catch (err) {
        console.error('[SQLite] Error logging interaction:', err.message);
    }
}

// --- Phase 15 Helpers ---
async function getSetting(key, defaultValue = null) {
    if (!isDbConnected) return defaultValue;
    try {
        const result = await pool.query('SELECT setting_value FROM app_settings WHERE setting_key = $1', [key]);
        if (result.rows.length > 0) return result.rows[0].setting_value;
    } catch (e) {
        console.error('[DB] getSetting Error:', e.message);
    }
    return defaultValue;
}

async function setSetting(key, value) {
    if (!isDbConnected) return;
    try {
        const existing = await pool.query('SELECT id FROM app_settings WHERE setting_key = $1', [key]);
        if (existing.rows.length > 0) {
            await pool.query('UPDATE app_settings SET setting_value = $1 WHERE setting_key = $2', [value, key]);
        } else {
            await pool.query('INSERT INTO app_settings (setting_key, setting_value) VALUES ($1, $2)', [key, value]);
        }
    } catch (e) {
        console.error('[DB] setSetting Error:', e.message);
    }
}

async function getAgent(id) {
    if (!isDbConnected) return null;
    try {
        const result = await pool.query('SELECT * FROM ai_agents WHERE id = $1', [id]);
        if (result.rows.length > 0) return result.rows[0];
    } catch (e) {
        console.error('[DB] getAgent Error:', e.message);
    }
    return null;
}

module.exports = {
    pool,
    logCopilotInteraction,
    getSetting,
    setSetting,
    getAgent
};
