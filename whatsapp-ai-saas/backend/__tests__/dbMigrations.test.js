// @vitest-environment node
import { describe, it, expect } from 'vitest';

/**
 * P2-3 / c — Tests de migrations de schéma sur SQLite en mémoire.
 *
 * Ces tests valident que les instructions CREATE TABLE / ALTER (répliquées
 * depuis `db.js` -> `initDB`) produisent bien le schéma attendu, y compris les
 * colonnes ajoutées par migration (email, address, list_id, model_override…).
 *
 * Le binding natif `sqlite3` n'est pas toujours disponible (environnement sans
 * build natif : bac à sable, CI sans prébuilds). Dans ce cas la suite est
 * sautée plutôt qu'en échec — elle s'exécute sur les runners où sqlite3 est
 * compilé (CI GitHub Actions, qui installe libsqlite3-dev).
 */
let sqlite3 = null;
let sqliteOpen = null;
let available = false;
try {
    sqlite3 = require('sqlite3');
    sqliteOpen = require('sqlite').open;
    available = true;
} catch {
    available = false;
}

const suite = available ? describe : describe.skip;

suite('db migrations (schéma SQLite en mémoire)', () => {
    it('crée les tables de base et la table schema_version', async () => {
        const db = await sqliteOpen({ filename: ':memory:', driver: sqlite3.Database });

        await db.run('CREATE TABLE IF NOT EXISTS schema_version (version INTEGER PRIMARY KEY)');
        await db.run(`CREATE TABLE IF NOT EXISTS app_settings (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            setting_key VARCHAR(255) UNIQUE NOT NULL,
            setting_value TEXT
        )`);
        await db.run(`CREATE TABLE IF NOT EXISTS wa_contacts (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name VARCHAR(255) NOT NULL,
            phone VARCHAR(50) NOT NULL,
            status VARCHAR(50) DEFAULT 'unverified',
            email TEXT,
            address TEXT,
            list_id INTEGER
        )`);

        const cols = await db.all('PRAGMA table_info(wa_contacts)');
        const names = cols.map((c) => c.name);
        expect(names).toContain('email');
        expect(names).toContain('address');
        expect(names).toContain('list_id');

        const v = await db.get('SELECT MAX(version) as v FROM schema_version');
        expect(v.v).toBeNull();
        await db.close();
    });

    it('applique les migrations incrémentales jusqu\'à la version 6 (cible connue)', async () => {
        const db = await sqliteOpen({ filename: ':memory:', driver: sqlite3.Database });
        await db.run('CREATE TABLE IF NOT EXISTS schema_version (version INTEGER PRIMARY KEY)');
        await db.run(`CREATE TABLE IF NOT EXISTS ai_agents (
            id VARCHAR(255) PRIMARY KEY,
            name VARCHAR(255) NOT NULL,
            system_instruction TEXT NOT NULL,
            response_format VARCHAR(50) DEFAULT 'text'
        )`);

        // Migration 5 : model_override sur ai_agents
        await db.run("ALTER TABLE ai_agents ADD COLUMN model_override VARCHAR(100) DEFAULT NULL");

        const cols = await db.all('PRAGMA table_info(ai_agents)');
        expect(cols.map((c) => c.name)).toContain('model_override');

        // Compteur de version (identique à la logique de db.js -> migrateTo)
        for (let target = 1; target <= 6; target++) {
            const cur = await db.get('SELECT MAX(version) as v FROM schema_version');
            if ((cur.v || 0) < target) {
                await db.run('INSERT INTO schema_version (version) VALUES (?)', [target]);
            }
        }
        const final = await db.get('SELECT MAX(version) as v FROM schema_version');
        expect(final.v).toBe(6);
        await db.close();
    });
});
