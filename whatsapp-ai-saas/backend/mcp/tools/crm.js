/**
 * Outils MCP — CRM : segments et contacts.
 *
 * Extrait de wacopiloteMcpServer.js (constat R9 de l’audit du 29/09/2026),
 * à l’identique : définitions et corps des handlers sont ceux de l’ancien
 * `switch`, seuls les chemins require ont gagné un niveau.
 */

const db = require('../../db');

const definitions = [
        {
            name: 'list_segments',
            description: 'Lister les segments de contacts CRM avec le décompte des contacts associés.',
            inputSchema: { type: 'object', properties: {}, required: [] }
        },
        {
            name: 'create_segment',
            description: 'Créer un nouveau segment de contacts CRM (ou renvoyer l\'existant s\'il existe déjà).',
            inputSchema: {
                type: 'object',
                properties: {
                    name: { type: 'string', description: 'Nom du segment' }
                },
                required: ['name']
            }
        },
        {
            name: 'delete_segment',
            description: 'Supprimer un segment de contacts CRM et dissocier les contacts associés.',
            inputSchema: {
                type: 'object',
                properties: {
                    id: { type: 'number', description: 'Identifiant du segment' }
                },
                required: ['id']
            }
        },
        {
            name: 'list_contacts',
            description: 'Lister les contacts du CRM avec filtres optionnels par segment, liste, statut ou recherche.',
            inputSchema: {
                type: 'object',
                properties: {
                    segmentId: { type: 'number', description: 'Filtrer par segment (optionnel)' },
                    listId: { type: 'number', description: 'Filtrer par liste de prospection (optionnel)' },
                    status: { type: 'string', description: 'Filtrer par statut (optionnel)' },
                    search: { type: 'string', description: 'Recherche par nom, téléphone ou email (optionnel)' },
                    limit: { type: 'number', description: 'Nombre maximal de contacts (défaut: 100)' },
                    offset: { type: 'number', description: 'Décalage pagination (défaut: 0)' }
                },
                required: []
            }
        },
        {
            name: 'get_contact',
            description: 'Récupérer un contact CRM par son identifiant.',
            inputSchema: {
                type: 'object',
                properties: {
                    id: { type: 'number', description: 'Identifiant du contact' }
                },
                required: ['id']
            }
        },
        {
            name: 'create_contact',
            description: 'Créer un contact dans le CRM.',
            inputSchema: {
                type: 'object',
                properties: {
                    name: { type: 'string', description: 'Nom du contact' },
                    phone: { type: 'string', description: 'Numéro de téléphone' },
                    email: { type: 'string', description: 'Adresse email (optionnel)' },
                    address: { type: 'string', description: 'Adresse physique ou ville (optionnel)' },
                    segmentId: { type: 'number', description: 'Identifiant du segment (optionnel)' },
                    listId: { type: 'number', description: 'Identifiant de la liste de contacts (optionnel)' },
                    status: { type: 'string', description: 'Statut du contact (défaut: unverified)' }
                },
                required: ['phone']
            }
        },
        {
            name: 'update_contact',
            description: 'Mettre à jour un contact existant dans le CRM.',
            inputSchema: {
                type: 'object',
                properties: {
                    id: { type: 'number', description: 'Identifiant du contact' },
                    name: { type: 'string', description: 'Nom du contact' },
                    phone: { type: 'string', description: 'Numéro de téléphone' },
                    email: { type: 'string', description: 'Adresse email' },
                    address: { type: 'string', description: 'Adresse physique ou ville' },
                    segmentId: { type: 'number', description: 'Identifiant du segment' },
                    listId: { type: 'number', description: 'Identifiant de la liste' },
                    status: { type: 'string', description: 'Statut du contact' }
                },
                required: ['id']
            }
        },
        {
            name: 'delete_contact',
            description: 'Supprimer un contact du CRM.',
            inputSchema: {
                type: 'object',
                properties: {
                    id: { type: 'number', description: 'Identifiant du contact' }
                },
                required: ['id']
            }
        },
        {
            name: 'assign_contacts_to_segment',
            description: 'Assigner un lot de contacts à un segment (ou détacher du segment si segmentId est null).',
            inputSchema: {
                type: 'object',
                properties: {
                    contactIds: { type: 'array', items: { type: 'number' }, description: 'Tableau des identifiants de contacts' },
                    segmentId: { type: 'number', description: 'Identifiant du segment (ou null pour détacher)' }
                },
                required: ['contactIds']
            }
        }
];

const handlers = {
    list_segments: async () => {
        await db.initDB();
        const crmService = require('../../services/crmService');
        const segments = await crmService.listSegments();
        return { segments, count: segments.length };
    },

    create_segment: async (args) => {
        await db.initDB();
        const crmService = require('../../services/crmService');
        const segment = await crmService.createSegment(args || {});
        return { success: true, segment };
    },

    delete_segment: async (args) => {
        await db.initDB();
        const crmService = require('../../services/crmService');
        const { id } = args || {};
        if (!id) throw new Error("L'argument 'id' est obligatoire.");
        return await crmService.deleteSegment(id);
    },

    list_contacts: async (args) => {
        await db.initDB();
        const crmService = require('../../services/crmService');
        const contacts = await crmService.listContacts(args || {});
        return { contacts, count: contacts.length };
    },

    get_contact: async (args) => {
        await db.initDB();
        const crmService = require('../../services/crmService');
        const { id } = args || {};
        if (!id) throw new Error("L'argument 'id' est obligatoire.");
        const contact = await crmService.getContact(id);
        return { contact };
    },

    create_contact: async (args) => {
        await db.initDB();
        const crmService = require('../../services/crmService');
        const contact = await crmService.createContact(args || {});
        return { success: true, contact };
    },

    update_contact: async (args) => {
        await db.initDB();
        const crmService = require('../../services/crmService');
        const { id, ...updates } = args || {};
        if (!id) throw new Error("L'argument 'id' est obligatoire.");
        const contact = await crmService.updateContact(id, updates);
        return { success: true, contact };
    },

    delete_contact: async (args) => {
        await db.initDB();
        const crmService = require('../../services/crmService');
        const { id } = args || {};
        if (!id) throw new Error("L'argument 'id' est obligatoire.");
        return await crmService.deleteContact(id);
    },

    assign_contacts_to_segment: async (args) => {
        await db.initDB();
        const crmService = require('../../services/crmService');
        const { contactIds, segmentId } = args || {};
        if (!Array.isArray(contactIds)) throw new Error("L'argument 'contactIds' (tableau) est obligatoire.");
        const result = await crmService.assignContactsToSegment(contactIds, segmentId);
        return { success: true, ...result };
    }
};

module.exports = { definitions, handlers };
