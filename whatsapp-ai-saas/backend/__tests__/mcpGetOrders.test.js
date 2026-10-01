// @vitest-environment node
//
// Outil MCP get_orders. Mesuré le 1er octobre 2026 : il interrogeait une table
// `wa_orders` absente du schéma et échouait à chaque appel (« no such table »).
// Aucun test ne l'exerçait ; l'audit du 29/09 le comptait parmi les outils
// opérationnels. Ce fichier l'éprouve contre la vraie table, detected_orders.
//
// Convention du projet : require, jamais import (cf. agentFallbackStrategies).
// Base partagée entre fichiers de test : chaque ligne porte un marqueur unique.
import { describe, it, expect, beforeAll, afterAll } from 'vitest';

const db = require('../db');
const { handleToolCall } = require('../mcp/wacopiloteMcpServer');

const MARQUEUR = `mcp-get-orders-${process.pid}-${Date.now()}`;

describe('MCP get_orders — commandes détectées', { timeout: 30000 }, () => {
    beforeAll(async () => {
        await db.initDB();
        // Deux insertions distinctes. (C'est en écrivant d'abord une seule
        // insertion réutilisant `$1` que le défaut de l'adaptateur a été
        // trouvé — corrigé depuis dans db.js, voir dbPlaceholders.test.js.)
        const insert = `INSERT INTO detected_orders (instance_id, contact_name, message_text, order_type, confidence, summary, source, detected_at)
                        VALUES ($1, $2, $3, 'purchase', $4, $5, $6, $7)`;
        await db.pool.query(insert, [MARQUEUR, 'Awa', 'je veux deux pagnes', 0.9, 'deux pagnes', 'text', '2026-10-01 10:00:00']);
        await db.pool.query(insert, [MARQUEUR, 'Koffi', 'vocal transcrit', 0.7, 'un sac', 'voice', '2026-10-01 11:00:00']);
    }, 30000);

    afterAll(async () => {
        await db.pool.query('DELETE FROM detected_orders WHERE instance_id = $1', [MARQUEUR]);
    });

    it('répond au lieu d\'échouer, et rend les commandes réellement enregistrées', async () => {
        const r = await handleToolCall('get_orders', { limit: 100 });
        const miennes = r.orders.filter((o) => o.instance_id === MARQUEUR);

        expect(miennes).toHaveLength(2);
        expect(r.count).toBe(r.orders.length);
    });

    it('expose les colonnes de detected_orders, origine comprise, la plus récente d\'abord', async () => {
        const r = await handleToolCall('get_orders', { limit: 100 });
        const [premiere, seconde] = r.orders.filter((o) => o.instance_id === MARQUEUR);

        expect(premiere).toMatchObject({
            contact_name: 'Koffi', message_text: 'vocal transcrit', order_type: 'purchase', source: 'voice'
        });
        expect(seconde).toMatchObject({ contact_name: 'Awa', summary: 'deux pagnes', source: 'text' });
    });

    it('borne la limite entre 1 et 100', async () => {
        expect((await handleToolCall('get_orders', { limit: 1 })).orders.length).toBeLessThanOrEqual(1);
        expect((await handleToolCall('get_orders', { limit: 0 })).orders.length).toBeLessThanOrEqual(20);
        expect((await handleToolCall('get_orders', { limit: 5000 })).orders.length).toBeLessThanOrEqual(100);
    });
});
