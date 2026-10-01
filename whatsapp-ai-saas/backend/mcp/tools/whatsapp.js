/**
 * Outils MCP — Instances WhatsApp déjà connectées.
 *
 * Extrait de wacopiloteMcpServer.js (constat R9 de l’audit du 29/09/2026),
 * à l’identique : définitions et corps des handlers sont ceux de l’ancien
 * `switch`, seuls les chemins require ont gagné un niveau.
 */

const db = require('../../db');

const definitions = [
        {
            name: 'list_instances',
            description: "Lister les instances WhatsApp connues (état miroir du store de l'app Electron). Ne crée pas de nouvelle instance : le pairing par QR reste une action humaine dans l'application.",
            inputSchema: { type: 'object', properties: {}, required: [] }
        },
        {
            name: 'open_whatsapp_chat',
            description: "Ouvrir une conversation WhatsApp sur une instance déjà authentifiée (pont CDP), en pré-remplissant un message optionnel. N'envoie pas le message automatiquement.",
            inputSchema: {
                type: 'object',
                properties: {
                    instanceId: { type: 'string', description: "Identifiant de l'instance WhatsApp" },
                    phone: { type: 'string', description: 'Numéro de téléphone du destinataire' },
                    message: { type: 'string', description: 'Message à pré-remplir (optionnel)' }
                },
                required: ['instanceId', 'phone']
            }
        }
];

const handlers = {
    list_instances: async () => {
        await db.initDB();
        const waInstancesService = require('../../services/waInstancesService');
        const instances = await waInstancesService.listInstances();
        return { instances, count: instances.length };
    },

    open_whatsapp_chat: async (args) => {
        const { instanceId, phone, message } = args || {};
        if (!instanceId || !phone) {
            throw new Error("Les arguments 'instanceId' et 'phone' sont obligatoires.");
        }
        await db.initDB();
        const waInstancesService = require('../../services/waInstancesService');
        return await waInstancesService.openChat({ instanceId, phone, text: message || '' });
    }
};

module.exports = { definitions, handlers };
