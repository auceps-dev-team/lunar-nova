/**
 * Outils MCP — Prospection et pipeline (prospection → contacts → messages → planning).
 *
 * Extrait de wacopiloteMcpServer.js (constat R9 de l’audit du 29/09/2026),
 * à l’identique : définitions et corps des handlers sont ceux de l’ancien
 * `switch`, seuls les chemins require ont gagné un niveau.
 */

const db = require('../../db');

const definitions = [
        {
            name: 'prospect_leads',
            description: 'Rechercher des leads ad-hoc (Google Maps, GoAfrica, Annuaire CI) hors du wizard pipeline.',
            inputSchema: {
                type: 'object',
                properties: {
                    query: { type: 'string', description: "Type de commerce recherché (ex: 'institut de beauté')" },
                    source: { type: 'string', description: "Source : 'google' (défaut), 'goafrica' ou 'annuaireci'" },
                    zone: { type: 'string', description: 'Zone géographique (ex: Abidjan)' },
                    quantity: { type: 'number', description: 'Nombre de résultats souhaités (défaut: 20)' }
                },
                required: ['query']
            }
        },
        {
            name: 'run_pipeline',
            description: 'Exécuter le pipeline autonome complet : prospection -> création de liste de contacts / segment -> génération de messages -> planning (Kanban), en un seul appel.',
            inputSchema: {
                type: 'object',
                properties: {
                    brief: { type: 'string', description: 'Brief de prospection en langage naturel' },
                    name: { type: 'string', description: 'Nom du run (optionnel)' },
                    listName: { type: 'string', description: 'Crée une nouvelle liste de contacts pour les leads trouvés' },
                    listId: { type: 'number', description: 'Utilise une liste de contacts existante' },
                    segmentName: { type: 'string', description: 'Crée ou utilise un segment de contacts nommé' },
                    segmentId: { type: 'number', description: 'Utilise un segment de contacts existant' }
                },
                required: ['brief']
            }
        },
        {
            name: 'create_pipeline_run',
            description: 'Créer un run de pipeline (étape 0, sans lancer la prospection).',
            inputSchema: {
                type: 'object',
                properties: {
                    brief: { type: 'string', description: 'Brief de prospection en langage naturel' },
                    name: { type: 'string', description: 'Nom du run (optionnel)' }
                },
                required: ['brief']
            }
        },
        {
            name: 'save_pipeline_contacts',
            description: 'Valider, dédupliquer, enregistrer ou réaffecter une liste de leads comme contacts WhatsApp (avec liste et segment) pour un run de pipeline.',
            inputSchema: {
                type: 'object',
                properties: {
                    runId: { type: 'number', description: 'Identifiant du run' },
                    leads: { type: 'array', items: { type: 'object' }, description: 'Leads à enregistrer' },
                    listId: { type: 'number', description: 'Liste de contacts existante (optionnel)' },
                    listName: { type: 'string', description: 'Crée une nouvelle liste de contacts (optionnel)' },
                    segmentId: { type: 'number', description: 'Segment de contacts existant (optionnel)' },
                    segmentName: { type: 'string', description: 'Crée ou utilise un segment de contacts nommé (optionnel)' }
                },
                required: ['runId', 'leads']
            }
        },
        {
            name: 'generate_pipeline_messages',
            description: "Générer un brouillon de message d'approche WhatsApp (persona Antoine) pour une liste de contacts.",
            inputSchema: {
                type: 'object',
                properties: {
                    contactIds: { type: 'array', items: { type: 'number' }, description: 'Identifiants des contacts' }
                },
                required: ['contactIds']
            }
        },
        {
            name: 'organize_pipeline',
            description: 'Organiser des contacts en cartes de planning (Kanban) pour un run de pipeline.',
            inputSchema: {
                type: 'object',
                properties: {
                    runId: { type: 'number', description: 'Identifiant du run' },
                    cards: { type: 'array', items: { type: 'object' }, description: 'Cartes { contact_id, draft_message }' }
                },
                required: ['runId', 'cards']
            }
        },
        {
            name: 'list_pipeline_cards',
            description: 'Lister les cartes du planning (Kanban), optionnellement filtrées par run.',
            inputSchema: {
                type: 'object',
                properties: {
                    runId: { type: 'number', description: 'Filtrer par run (optionnel)' }
                },
                required: []
            }
        },
        {
            name: 'update_pipeline_card_stage',
            description: 'Déplacer une carte de planning vers une nouvelle étape du Kanban.',
            inputSchema: {
                type: 'object',
                properties: {
                    cardId: { type: 'number', description: 'Identifiant de la carte' },
                    stage: { type: 'string', description: "Nouvelle étape (ex: 'new', 'contacted', 'won', 'lost')" }
                },
                required: ['cardId', 'stage']
            }
        }
];

const handlers = {
    prospect_leads: async (args) => {
        const { query, source, zone, quantity } = args || {};
        if (!query) {
            throw new Error("L'argument 'query' est obligatoire.");
        }
        const prospectionService = require('../../services/prospectionService');
        return await prospectionService.search({ query, source: source || 'google', zone: zone || '', quantity: quantity || 20 });
    },

    run_pipeline: async (args) => {
        const { brief, name: runName, listName, listId, segmentName, segmentId } = args || {};
        if (!brief) {
            throw new Error("L'argument 'brief' est obligatoire.");
        }
        await db.initDB();
        const pipelineService = require('../../services/pipelineService');
        return await pipelineService.runAuto({ brief, name: runName, listId, listName, segmentId, segmentName });
    },

    create_pipeline_run: async (args) => {
        const { brief, name: runName } = args || {};
        if (!brief) {
            throw new Error("L'argument 'brief' est obligatoire.");
        }
        await db.initDB();
        const pipelineService = require('../../services/pipelineService');
        return { run: await pipelineService.createRun({ brief, name: runName }) };
    },

    save_pipeline_contacts: async (args) => {
        const { runId, leads, listId, listName, segmentId, segmentName } = args || {};
        if (!runId || !Array.isArray(leads)) {
            throw new Error("Les arguments 'runId' et 'leads' sont obligatoires.");
        }
        await db.initDB();
        const pipelineService = require('../../services/pipelineService');
        return await pipelineService.saveContactsStage(runId, {
            leads,
            list_id: listId,
            list_name: listName,
            segment_id: segmentId,
            segment_name: segmentName
        });
    },

    generate_pipeline_messages: async (args) => {
        const { contactIds } = args || {};
        if (!Array.isArray(contactIds) || contactIds.length === 0) {
            throw new Error("L'argument 'contactIds' est obligatoire.");
        }
        await db.initDB();
        const pipelineService = require('../../services/pipelineService');
        return await pipelineService.generateMessagesStage({ contactIds });
    },

    organize_pipeline: async (args) => {
        const { runId, cards } = args || {};
        if (!runId || !Array.isArray(cards)) {
            throw new Error("Les arguments 'runId' et 'cards' sont obligatoires.");
        }
        await db.initDB();
        const pipelineService = require('../../services/pipelineService');
        return await pipelineService.organizeStage(runId, { cards });
    },

    list_pipeline_cards: async (args) => {
        await db.initDB();
        const pipelineService = require('../../services/pipelineService');
        const cards = await pipelineService.listCards({ run_id: args && args.runId });
        return { cards, count: cards.length };
    },

    update_pipeline_card_stage: async (args) => {
        const { cardId, stage } = args || {};
        if (!cardId || !stage) {
            throw new Error("Les arguments 'cardId' et 'stage' sont obligatoires.");
        }
        await db.initDB();
        const pipelineService = require('../../services/pipelineService');
        return { card: await pipelineService.updateCardStage(cardId, stage) };
    }
};

module.exports = { definitions, handlers };
