/**
 * Outils MCP — Documents texte générés par l’IA.
 *
 * Extrait de wacopiloteMcpServer.js (constat R9 de l’audit du 29/09/2026),
 * à l’identique : définitions et corps des handlers sont ceux de l’ancien
 * `switch`, seuls les chemins require ont gagné un niveau.
 */

const db = require('../../db');

const definitions = [
        {
            name: 'list_documents',
            description: 'Lister les documents texte générés par l\'IA (AI Writer).',
            inputSchema: { type: 'object', properties: {}, required: [] }
        },
        {
            name: 'get_document',
            description: 'Récupérer un document texte par son identifiant.',
            inputSchema: {
                type: 'object',
                properties: { id: { type: 'number', description: 'Identifiant du document' } },
                required: ['id']
            }
        },
        {
            name: 'create_document',
            description: 'Créer un nouveau document texte.',
            inputSchema: {
                type: 'object',
                properties: {
                    title: { type: 'string', description: 'Titre du document' },
                    content: { type: 'string', description: 'Contenu du document' }
                },
                required: ['content']
            }
        },
        {
            name: 'update_document',
            description: 'Mettre à jour un document texte existant.',
            inputSchema: {
                type: 'object',
                properties: {
                    id: { type: 'number', description: 'Identifiant du document' },
                    title: { type: 'string', description: 'Nouveau titre' },
                    content: { type: 'string', description: 'Nouveau contenu' }
                },
                required: ['id']
            }
        },
        {
            name: 'delete_document',
            description: 'Supprimer un document texte.',
            inputSchema: {
                type: 'object',
                properties: { id: { type: 'number', description: 'Identifiant du document' } },
                required: ['id']
            }
        }
];

const handlers = {
    list_documents: async () => {
        await db.initDB();
        const documentsService = require('../../services/documentsService');
        const documents = await documentsService.listDocuments();
        return { documents, count: documents.length };
    },

    get_document: async (args) => {
        const { id } = args || {};
        if (!id) throw new Error("L'argument 'id' est obligatoire.");
        await db.initDB();
        const documentsService = require('../../services/documentsService');
        return { document: await documentsService.getDocument(id) };
    },

    create_document: async (args) => {
        const { title, content } = args || {};
        if (!content) throw new Error("L'argument 'content' est obligatoire.");
        await db.initDB();
        const documentsService = require('../../services/documentsService');
        return { document: await documentsService.createDocument({ title, content }) };
    },

    update_document: async (args) => {
        const { id, title, content } = args || {};
        if (!id) throw new Error("L'argument 'id' est obligatoire.");
        await db.initDB();
        const documentsService = require('../../services/documentsService');
        return { document: await documentsService.updateDocument(id, { title, content }) };
    },

    delete_document: async (args) => {
        const { id } = args || {};
        if (!id) throw new Error("L'argument 'id' est obligatoire.");
        await db.initDB();
        const documentsService = require('../../services/documentsService');
        return await documentsService.deleteDocument(id);
    }
};

module.exports = { definitions, handlers };
