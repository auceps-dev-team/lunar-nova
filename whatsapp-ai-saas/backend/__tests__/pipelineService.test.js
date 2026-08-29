// Ne couvre que les fonctions purement DB (pas d'appel IA ni de scraping réseau,
// cohérent avec le reste de la suite qui évite les dépendances externes) :
// prospectStage, generateMessagesStage et runAuto (qui les enchaîne) en sont
// exclus car ils appellent aiController.chatWithAgent + les scrapers.
// @vitest-environment node
import { describe, it, expect, beforeAll } from 'vitest';

process.env.WACOPILOTE_MASTER_KEY = 'b'.repeat(64);

let sqlite3Available = true;
try {
    require('sqlite3');
} catch {
    sqlite3Available = false;
}

const db = require('../db');
// pipelineService require aiController (-> geminiService/openrouterService),
// qui touchent db.js dès le chargement du module. Le require est donc différé
// à après __setDbFileForTests()/initDB() pour ne jamais laisser ce graphe de
// dépendances ouvrir la connexion réelle avant que la redirection ':memory:'
// ne soit en place (sinon : "__setDbFileForTests doit être appelée avant la
// première requête").
let pipelineService;

describe('pipelineService — étapes DB du pipeline (SQLite en mémoire)', { timeout: 25000 }, () => {
    beforeAll(async () => {
        db.__setDbFileForTests(':memory:');
        await db.initDB();
        pipelineService = require('../services/pipelineService');
    }, 25000);

    it.runIf(sqlite3Available)('createRun exige un brief non vide', async () => {
        await expect(pipelineService.createRun({ brief: '' })).rejects.toMatchObject({ statusCode: 400 });
    });

    it.runIf(sqlite3Available)('createRun puis getRun renvoient le run avec ses cartes (vides)', async () => {
        const run = await pipelineService.createRun({ brief: '10 boutiques à Abidjan', name: 'Test Run' });
        expect(run.id).toBeDefined();

        const { run: fetched, cards } = await pipelineService.getRun(run.id);
        expect(fetched.name).toBe('Test Run');
        expect(cards).toEqual([]);
    });

    it.runIf(sqlite3Available)('listRuns inclut les runs créés', async () => {
        const runs = await pipelineService.listRuns();
        expect(runs.length).toBeGreaterThan(0);
    });

    it.runIf(sqlite3Available)('createContactList crée une nouvelle liste nommée ou réutilise l\'existante', async () => {
        const list = await pipelineService.createContactList('Prospects Test');
        expect(list.id).toBeDefined();
        expect(list.name).toBe('Prospects Test');
        const listAgain = await pipelineService.createContactList('Prospects Test');
        expect(listAgain.id).toBe(list.id);
    });

    it.runIf(sqlite3Available)('createSegment crée un nouveau segment ou réutilise l\'existant', async () => {
        const seg = await pipelineService.createSegment('B2B Mode');
        expect(seg.id).toBeDefined();
        expect(seg.name).toBe('B2B Mode');
        const segAgain = await pipelineService.createSegment('B2B Mode');
        expect(segAgain.id).toBe(seg.id);
    });

    it.runIf(sqlite3Available)('saveContactsStage valide, déduplique et enregistre les leads avec segment', async () => {
        const run = await pipelineService.createRun({ brief: 'brief' });
        const result = await pipelineService.saveContactsStage(run.id, {
            leads: [
                { name: 'Boutique A', phone: '0102030405' },
                { name: 'Boutique A bis', phone: '0102030405' } // doublon de téléphone dans le même batch
            ],
            segmentName: 'Mode'
        });
        expect(result.imported).toBe(1);
        expect(result.contacts).toHaveLength(1);
        expect(result.contacts[0].segment_id).toBeDefined();
    });

    it.runIf(sqlite3Available)('saveContactsStage réaffecte les contacts existants (doublons DB) au nouveau segment/liste', async () => {
        const run = await pipelineService.createRun({ brief: 'brief run 2' });
        // Boutique A (0102030405) existe déjà en base suite au test précédent
        const result = await pipelineService.saveContactsStage(run.id, {
            leads: [
                { name: 'Boutique A Rénovée', phone: '0102030405', address: 'Abidjan Cocody' },
                { name: 'Boutique B Nouvelle', phone: '0708091011', address: 'Abidjan Plateau' }
            ],
            segmentName: 'Luxe',
            listName: 'Liste VIP'
        });

        expect(result.imported).toBe(1); // Boutique B est nouvelle
        expect(result.reassignedCount).toBe(1); // Boutique A est réaffectée
        expect(result.contacts).toHaveLength(2); // Les 2 contacts sont disponibles
        const boutiqueA = result.contacts.find(c => c.phone === '0102030405');
        expect(boutiqueA).toBeDefined();
        expect(boutiqueA.address).toBe('Abidjan Cocody');
    });

    it.runIf(sqlite3Available)('organizeStage crée des cartes de planning liées au run', async () => {
        const run = await pipelineService.createRun({ brief: 'brief' });
        const { cards } = await pipelineService.organizeStage(run.id, {
            cards: [{ contact_id: null, draft_message: 'Bonjour !' }]
        });
        expect(cards).toHaveLength(1);
        expect(cards[0].draft_message).toBe('Bonjour !');

        const listed = await pipelineService.listCards({ run_id: run.id });
        expect(listed).toHaveLength(1);
    });

    it.runIf(sqlite3Available)('updateCardStage déplace une carte vers une nouvelle étape', async () => {
        const run = await pipelineService.createRun({ brief: 'brief' });
        const { cards } = await pipelineService.organizeStage(run.id, { cards: [{ contact_id: null }] });
        const updated = await pipelineService.updateCardStage(cards[0].id, 'contacted');
        expect(updated.stage).toBe('contacted');
    });

    it.runIf(sqlite3Available)('updateCard modifie notes/draft_message', async () => {
        const run = await pipelineService.createRun({ brief: 'brief' });
        const { cards } = await pipelineService.organizeStage(run.id, { cards: [{ contact_id: null }] });
        const updated = await pipelineService.updateCard(cards[0].id, { notes: 'Suivi requis' });
        expect(updated.notes).toBe('Suivi requis');
    });

    it.runIf(sqlite3Available)('deleteCard supprime la carte', async () => {
        const run = await pipelineService.createRun({ brief: 'brief' });
        const { cards } = await pipelineService.organizeStage(run.id, { cards: [{ contact_id: null }] });
        await pipelineService.deleteCard(cards[0].id);
        const listed = await pipelineService.listCards({ run_id: run.id });
        expect(listed.find(c => c.id === cards[0].id)).toBeUndefined();
    });
});
