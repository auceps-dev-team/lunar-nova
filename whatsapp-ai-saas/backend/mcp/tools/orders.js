/**
 * Outils MCP — Commandes détectées par l’écouteur WhatsApp.
 *
 * Extrait de wacopiloteMcpServer.js (constat R9 de l’audit du 29/09/2026),
 * à l’identique : définitions et corps des handlers sont ceux de l’ancien
 * `switch`, seuls les chemins require ont gagné un niveau.
 */

const db = require('../../db');

const definitions = [
        {
            name: 'get_orders',
            description: 'Récupérer les commandes WhatsApp récentes enregistrées dans la base de données locale.',
            inputSchema: {
                type: 'object',
                properties: {
                    limit: {
                        type: 'number',
                        description: 'Nombre maximal de commandes à retourner (défaut: 20)'
                    }
                },
                required: []
            }
        }
];

const handlers = {
    get_orders: async (args) => {
        // Lit `detected_orders`, comme la route REST /api/orders. Mesuré le
        // 1er octobre 2026 : l'outil interrogeait une table `wa_orders` qui
        // n'existe nulle part dans le schéma, et échouait à CHAQUE appel
        // (« no such table: wa_orders ») — sans qu'aucun test ne le voie.
        await db.initDB();
        const limit = Math.min(100, Math.max(1, Number(args && args.limit) || 20));
        const result = await db.pool.query(
            `SELECT id, instance_id, contact_name, message_text, order_type, confidence, summary, source, detected_at
             FROM detected_orders ORDER BY detected_at DESC, id DESC LIMIT $1`,
            [limit]
        );
        return { orders: result.rows || [], count: result.rows ? result.rows.length : 0 };
    }
};

module.exports = { definitions, handlers };
