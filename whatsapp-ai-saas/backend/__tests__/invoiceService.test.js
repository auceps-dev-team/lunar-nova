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
const invoiceService = require('../services/invoiceService');

describe('invoiceService — CRUD sur quotes (SQLite en mémoire)', () => {
    beforeAll(async () => {
        db.__setDbFileForTests(':memory:');
        await db.initDB();
    });

    it.runIf(sqlite3Available)('createInvoice calcule le total TTC à partir des lignes et du taux de TVA', async () => {
        const invoice = await invoiceService.createInvoice({
            clientName: 'Boutique Test',
            items: [{ description: 'Robe', qty: 2, price: 15000 }],
            taxRate: 18
        });
        expect(invoice.id).toBeDefined();
        expect(invoice.totalAmount).toBe(35400); // 2*15000 * 1.18
        expect(invoice.clientName).toBe('Boutique Test');
    });

    it.runIf(sqlite3Available)('getInvoice restitue le draft complet (items, taxRate) via la colonne data', async () => {
        const created = await invoiceService.createInvoice({
            clientName: 'Client B',
            items: [{ description: 'Sac', qty: 1, price: 20000 }],
            taxRate: 0,
            notes: 'Livraison rapide'
        });
        const fetched = await invoiceService.getInvoice(created.id);
        expect(fetched.items).toEqual([{ description: 'Sac', qty: 1, price: 20000 }]);
        expect(fetched.notes).toBe('Livraison rapide');
    });

    it.runIf(sqlite3Available)('listInvoices inclut les devis créés', async () => {
        const invoices = await invoiceService.listInvoices();
        expect(invoices.length).toBeGreaterThan(0);
    });

    it.runIf(sqlite3Available)('updateInvoice recalcule le total après modification des lignes', async () => {
        const created = await invoiceService.createInvoice({
            clientName: 'Client C',
            items: [{ description: 'Article', qty: 1, price: 1000 }],
            taxRate: 0
        });
        const updated = await invoiceService.updateInvoice(created.id, {
            ...created,
            items: [{ description: 'Article', qty: 3, price: 1000 }]
        });
        expect(updated.totalAmount).toBe(3000);
    });

    it.runIf(sqlite3Available)('getInvoice lève une erreur 404 pour un id inconnu', async () => {
        await expect(invoiceService.getInvoice(999999)).rejects.toMatchObject({ statusCode: 404 });
    });

    it.runIf(sqlite3Available)('deleteInvoice supprime le devis', async () => {
        const created = await invoiceService.createInvoice({ clientName: 'D', items: [], taxRate: 0 });
        await invoiceService.deleteInvoice(created.id);
        await expect(invoiceService.getInvoice(created.id)).rejects.toMatchObject({ statusCode: 404 });
    });
});
