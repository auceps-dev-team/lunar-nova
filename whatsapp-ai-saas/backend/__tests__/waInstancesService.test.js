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
const waInstancesService = require('../services/waInstancesService');

describe('waInstancesService — miroir des instances WhatsApp (SQLite en mémoire)', () => {
    beforeAll(async () => {
        db.__setDbFileForTests(':memory:');
        await db.initDB();
    });

    it.runIf(sqlite3Available)('upsertInstance crée puis met à jour la même instance', async () => {
        const created = await waInstancesService.upsertInstance('wa-tab-1', 'Instance 1', 'offline');
        expect(created.id).toBe('wa-tab-1');
        expect(created.status).toBe('offline');

        const updated = await waInstancesService.upsertInstance('wa-tab-1', 'Instance 1', 'online');
        expect(updated.status).toBe('online');

        const instances = await waInstancesService.listInstances();
        expect(instances.filter(i => i.id === 'wa-tab-1')).toHaveLength(1);
    });

    it.runIf(sqlite3Available)('listInstances renvoie les instances enregistrées', async () => {
        await waInstancesService.upsertInstance('wa-tab-2', 'Instance 2');
        const instances = await waInstancesService.listInstances();
        expect(instances.length).toBeGreaterThanOrEqual(2);
    });

    it.runIf(sqlite3Available)('removeInstance supprime l\'instance', async () => {
        await waInstancesService.upsertInstance('wa-tab-3', 'Instance 3');
        await waInstancesService.removeInstance('wa-tab-3');
        const instances = await waInstancesService.listInstances();
        expect(instances.find(i => i.id === 'wa-tab-3')).toBeUndefined();
    });

    it.runIf(sqlite3Available)('openChat rejette un numéro de téléphone invalide avant toute tentative CDP', async () => {
        await expect(
            waInstancesService.openChat({ instanceId: 'wa-tab-1', phone: 'abc' })
        ).rejects.toMatchObject({ statusCode: 400 });
    });
});
