// P2-3 (c) : migrations de schéma éprouvées sur une base SQLite en mémoire.
// La clé maître est fixée AVANT l'import de db.js (secretStore la résout au
// chargement) : aucun fichier de clé n'est écrit dans l'arborescence.
// @vitest-environment node
import { describe, it, expect, beforeAll } from 'vitest';

process.env.WACOPILOTE_MASTER_KEY = 'b'.repeat(64);

// Le binding natif sqlite3 n'est pas compilable partout (bac à sable sans
// accès aux prébuilds). Ces tests tournent dès qu'il est disponible (CI,
// post-install) et sont explicitement ignorés sinon — ils ne « passent pas
// dans le vide » : un échec de binding se voit dans le résumé.
let sqlite3Available = true;
try {
    require('sqlite3');
} catch {
    sqlite3Available = false;
}

const db = require('../db');

describe('db.js — migrations de schéma (SQLite en mémoire)', () => {
    beforeAll(() => {
        db.__setDbFileForTests(':memory:');
    });

    it.runIf(sqlite3Available)('initDB() réussit et enregistre la dernière version de schéma', async () => {
        const ok = await db.initDB();
        expect(ok).toBe(true);

        const v = await db.pool.query('SELECT MAX(version) as v FROM schema_version');
        expect(v.rows[0].v).toBe(8);
    });

    it.runIf(sqlite3Available)('permet les requêtes INSERT ... ON CONFLICT (phone) sur wa_contacts sans erreur de contrainte', async () => {
        // Premier insert
        await db.pool.query(`
            INSERT INTO wa_contacts (name, phone, segment_id, list_id, email, address) 
            VALUES ($1, $2, $3, $4, $5, $6)
            ON CONFLICT (phone) WHERE phone IS NOT NULL AND phone != ''
            DO UPDATE SET 
                name = COALESCE(NULLIF(EXCLUDED.name, ''), wa_contacts.name),
                segment_id = COALESCE(EXCLUDED.segment_id, wa_contacts.segment_id)
        `, ['ONG Test 1', '22507010203', null, null, 'test1@ong.ci', 'Abidjan']);

        // Deuxième insert (conflit de numéro -> mise à jour)
        await db.pool.query(`
            INSERT INTO wa_contacts (name, phone, segment_id, list_id, email, address) 
            VALUES ($1, $2, $3, $4, $5, $6)
            ON CONFLICT (phone) WHERE phone IS NOT NULL AND phone != ''
            DO UPDATE SET 
                name = COALESCE(NULLIF(EXCLUDED.name, ''), wa_contacts.name),
                segment_id = COALESCE(EXCLUDED.segment_id, wa_contacts.segment_id)
        `, ['ONG Test 1 Mis à jour', '22507010203', 1, null, 'test1@ong.ci', 'Abidjan']);

        const res = await db.pool.query('SELECT * FROM wa_contacts WHERE phone = $1', ['22507010203']);
        expect(res.rows.length).toBe(1);
        expect(res.rows[0].name).toBe('ONG Test 1 Mis à jour');
        expect(res.rows[0].segment_id).toBe(1);
    });

    it.runIf(sqlite3Available)('crée les tables attendues par les routes', async () => {
        const t = await db.pool.query("SELECT name FROM sqlite_master WHERE type='table'");
        const names = t.rows.map(r => r.name);
        for (const table of [
            'copilot_logs', 'app_settings', 'ai_agents', 'ai_documents',
            'wa_contacts', 'wa_contact_lists', 'wa_segments', 'wa_message_logs',
            'detected_orders', 'wp_connections', 'pipeline_runs', 'pipeline_cards', 'quotes'
        ]) {
            expect(names).toContain(table);
        }
    });

    it.runIf(sqlite3Available)('setSetting/getSetting font un aller-retour, avec chiffrement au repos des *_api_key', async () => {
        await db.setSetting('test_provider_api_key', 'sk-secret-1234');
        await db.setSetting('test_setting_plain', 'valeur-claire');

        expect(await db.getSetting('test_provider_api_key')).toBe('sk-secret-1234');
        expect(await db.getSetting('test_setting_plain')).toBe('valeur-claire');

        // Au repos : chiffré pour la clé API (préfixe enc:v1:), clair sinon.
        const raw = await db.pool.query('SELECT setting_key, setting_value FROM app_settings WHERE setting_key LIKE $1', ['test_%']);
        const byKey = Object.fromEntries(raw.rows.map(r => [r.setting_key, r.setting_value]));
        expect(byKey.test_provider_api_key).toMatch(/^enc:v1:/);
        expect(byKey.test_provider_api_key).not.toContain('sk-secret-1234');
        expect(byKey.test_setting_plain).toBe('valeur-claire');
    });

    it.runIf(sqlite3Available)('une migration ne marque sa version qu\'en cas de succès (colonne déjà présente = cas bénin ignoré)', async () => {
        // Ré-exécuter initDB est sans effet (idempotence des CREATE IF NOT
        // EXISTS et des migrations versionnées).
        const again = await db.initDB();
        expect(again).toBe(true);

        // La colonne de la migration v6 existe bien (doublon → « already
        // exists » ignoré, pas d'échec).
        const cols = await db.pool.query('SELECT wp_username FROM wp_connections LIMIT 1');
        expect(cols).toBeDefined();
    });

    it.runIf(!sqlite3Available)('sans binding sqlite3, la suite reste verte et le mode dégradé s\'applique', async () => {
        const ok = await db.initDB();
        expect(ok).toBe(false);
        expect(await db.getSetting('n_importe', 'defaut')).toBe('defaut');
    });
});
