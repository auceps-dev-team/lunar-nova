// @vitest-environment node
//
// Migration v13 et synchronisation des fonctionnalités (Marketplace, ticket #30,
// PR 1). Règle : une mise à jour ne retire rien à un utilisateur existant.
//
// Une installation 1.52.x est simulée en retirant la v13 d'une base à jour
// (table `features` supprimée, ligne de schema_version retirée), puis en
// rejouant l'initialisation : c'est exactement l'état d'une base 1.52.x, dont
// le schéma s'arrête à la v12.
//
// Convention du projet : require, jamais import, pour partager l'instance de db.
import { describe, it, expect, beforeAll } from 'vitest';

const db = require('../db');
const { fonctionnalites } = require('../featuresCatalogue');

const lignes = async () => {
    const { rows } = await db.pool.query('SELECT id, enabled FROM features ORDER BY id');
    return Object.fromEntries(rows.map((r) => [r.id, Number(r.enabled)]));
};

const revenirEnV12 = async (voiceNotes) => {
    await db.pool.query('DROP TABLE features');
    await db.pool.query('DELETE FROM schema_version WHERE version = 13');
    await db.pool.query("DELETE FROM app_settings WHERE setting_key = 'voice_notes_transcription'");
    if (voiceNotes !== undefined) {
        await db.pool.query(
            "INSERT INTO app_settings (setting_key, setting_value) VALUES ('voice_notes_transcription', $1)",
            [voiceNotes]
        );
    }
};

describe('fonctionnalités — migration v13 et synchronisation', () => {
    beforeAll(async () => {
        db.__setDbFileForTests(':memory:');
        expect(await db.initDB()).toBe(true);
    }, 30000);

    it('base neuve : chaque fonctionnalité reçoit sa valeur par défaut', async () => {
        const attendu = Object.fromEntries(fonctionnalites.map((f) => [f.id, f.noyau || f.defaut ? 1 : 0]));
        expect(await lignes()).toEqual(attendu);
        expect((await lignes())['notes-vocales']).toBe(0);
    });

    it('installation 1.52.x, vocaux activés : notes-vocales reste active', async () => {
        await revenirEnV12('on');
        expect(await db.__rerunInitDBForTests()).toBe(true);
        const etat = await lignes();
        expect(etat['notes-vocales']).toBe(1);
        // Tout le reste est actif, explicitement enregistré.
        for (const f of fonctionnalites) expect(etat[f.id], f.id).toBe(1);
    });

    it('installation 1.52.x, vocaux désactivés : notes-vocales reste éteinte, rien d\'autre ne l\'est', async () => {
        await revenirEnV12('off');
        expect(await db.__rerunInitDBForTests()).toBe(true);
        const etat = await lignes();
        expect(etat['notes-vocales']).toBe(0);
        for (const f of fonctionnalites.filter((x) => x.id !== 'notes-vocales')) expect(etat[f.id], f.id).toBe(1);
    });

    it('installation 1.52.x sans réglage des vocaux : notes-vocales éteinte, comme le réglage par défaut', async () => {
        await revenirEnV12(undefined);
        expect(await db.__rerunInitDBForTests()).toBe(true);
        expect((await lignes())['notes-vocales']).toBe(0);
    });

    it('un redémarrage ne modifie jamais une ligne existante', async () => {
        await db.pool.query("UPDATE features SET enabled = 0 WHERE id = 'crm'");
        await db.pool.query("UPDATE features SET enabled = 1 WHERE id = 'notes-vocales'");
        expect(await db.__rerunInitDBForTests()).toBe(true);
        const etat = await lignes();
        expect(etat.crm).toBe(0);
        expect(etat['notes-vocales']).toBe(1);
    });

    it('une fonctionnalité absente de la table (ajoutée par une mise à jour) reçoit sa valeur par défaut', async () => {
        await db.pool.query("DELETE FROM features WHERE id IN ('taches', 'notes-vocales')");
        expect(await db.__rerunInitDBForTests()).toBe(true);
        const etat = await lignes();
        expect(etat.taches).toBe(1);
        expect(etat['notes-vocales']).toBe(0);
    });
});
