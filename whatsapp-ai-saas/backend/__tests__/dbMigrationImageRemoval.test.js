// @vitest-environment node
//
// Migration v11 (db.js) : retrait des réglages qui ne servaient qu'à la
// génération d'image. On simule une base d'avant la v11 — réglages d'image
// présents, version 11 absente de schema_version — puis on relance initDB.
//
// Convention du projet : require, jamais import (cf. agentFallbackStrategies).
import { describe, it, expect, beforeAll } from 'vitest';

const db = require('../db');

const OBSOLETES = [
    'default_image_provider', 'default_image_model',
    'default_image_generate_model', 'default_image_edit_model',
    'gemini_image_count', 'gemini_quota_reset_date',
    'nvidia_key_qwen_image', 'gemini_models_cache', 'openrouter_models_cache'
];

const lire = async (cle) =>
    (await db.pool.query('SELECT setting_value FROM app_settings WHERE setting_key = $1', [cle])).rows[0];

describe('db — migration v11 : réglages de la génération d\'image', () => {
    beforeAll(async () => {
        db.__setDbFileForTests(':memory:');
        await db.initDB();

        // Base « d'avant » : réglages d'image en place, v11 pas encore appliquée.
        for (const cle of OBSOLETES) {
            await db.pool.query('INSERT INTO app_settings (setting_key, setting_value) VALUES ($1, $2)', [cle, 'valeur']);
        }
        // Inséré par initDB à chaque démarrage : on le modifie, on ne l'ajoute pas.
        await db.pool.query('UPDATE app_settings SET setting_value = $1 WHERE setting_key = $2', ['openrouter', 'default_ai_provider']);
        await db.pool.query('DELETE FROM schema_version WHERE version = 11');

        // initDB est mémorisé : on rejoue explicitement l'initialisation.
        await db.__rerunInitDBForTests();
    }, 30000);

    it('supprime chacun des réglages propres à la génération d\'image', async () => {
        for (const cle of OBSOLETES) expect(await lire(cle), cle).toBeUndefined();
    });

    it('garde les autres réglages', async () => {
        expect((await lire('default_ai_provider')).setting_value).toBe('openrouter');
    });

    it('enregistre la version 11', async () => {
        const r = await db.pool.query('SELECT version FROM schema_version WHERE version = 11');
        expect(r.rows).toHaveLength(1);
    });
});
