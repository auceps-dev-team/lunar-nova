const readline = require('readline');
const orchestrator = require('../agents/orchestrator');
const db = require('../db');
const pkg = require('../../package.json');

/**
 * Définitions des outils MCP exposés par WaCopilote.
 */
const MCP_TOOLS = [
    {
        name: 'list_agents',
        description: 'Lister l\'ensemble des 27 personas IA configurés dans WaCopilote avec leurs rôles, compétences et formats attendus.',
        inputSchema: {
            type: 'object',
            properties: {},
            required: []
        }
    },
    {
        name: 'call_agent',
        description: 'Invoquer l\'un des agents personas de WaCopilote (ex: copywriter, creative, outbound_strategist, seo_specialist, ella) pour traiter une tâche de vente, rédaction, design ou stratégie.',
        inputSchema: {
            type: 'object',
            properties: {
                agent: {
                    type: 'string',
                    description: 'Identifiant de l\'agent (ex: copywriter, creative, outbound_strategist, ella, seo_specialist, etc.)'
                },
                prompt: {
                    type: 'string',
                    description: 'Le message ou prompt à transmettre à l\'agent'
                },
                provider: {
                    type: 'string',
                    description: 'Fournisseur optionnel (gemini, openrouter, nvidia, ollama)'
                },
                model: {
                    type: 'string',
                    description: 'Modèle optionnel spécifique'
                }
            },
            required: ['agent', 'prompt']
        }
    },
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
    },
    {
        name: 'create_product_proposal',
        description: 'Créer une proposition de fiche produit WooCommerce / WordPress avec validation humaine (HITL).',
        inputSchema: {
            type: 'object',
            properties: {
                title: { type: 'string', description: 'Nom du produit' },
                price: { type: 'string', description: 'Prix du produit' },
                description: { type: 'string', description: 'Description complète ou argumentaire' },
                category: { type: 'string', description: 'Catégorie du produit' }
            },
            required: ['title', 'price', 'description']
        }
    },
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
    },
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
    },
    {
        name: 'generate_photo',
        description: 'Générer une photo (produit ou mannequin) : enchaîne la persona photoshoot/creative (prompt structuré) puis la génération d\'image, et retourne les bytes base64 du résultat.',
        inputSchema: {
            type: 'object',
            properties: {
                agent: { type: 'string', description: "Persona à utiliser : 'photoshoot' (défaut, mode) ou 'creative' (produit)" },
                prompt: { type: 'string', description: 'Description de la photo souhaitée' },
                aspectRatio: { type: 'string', description: "Ratio (ex: '1:1', '4:5', '16:9')" },
                provider: { type: 'string', description: 'Fournisseur optionnel (gemini, openai/nvidia)' },
                model: { type: 'string', description: 'Modèle image optionnel spécifique' }
            },
            required: ['prompt']
        }
    },
    {
        name: 'wordpress_propose_action',
        description: 'Analyser un prompt en langage naturel (persona wordpress_agent) et soumettre les actions WordPress résultantes en attente de validation humaine (HITL) — jamais exécuté automatiquement.',
        inputSchema: {
            type: 'object',
            properties: {
                connectionId: { type: 'number', description: 'Identifiant de la connexion WordPress' },
                prompt: { type: 'string', description: "Requête en langage naturel (ex: 'crée une fiche produit pour...')" }
            },
            required: ['connectionId', 'prompt']
        }
    },
    {
        name: 'wordpress_list_actions',
        description: "Lister les propositions d'action WordPress en attente (ou selon un autre statut).",
        inputSchema: {
            type: 'object',
            properties: {
                connectionId: { type: 'number', description: 'Identifiant de la connexion WordPress' },
                status: { type: 'string', description: "Statut à filtrer (défaut: 'pending_review')" }
            },
            required: ['connectionId']
        }
    },
    {
        name: 'wordpress_approve_action',
        description: "Approuver et exécuter une proposition d'action WordPress en attente. Exige que ce tool soit invoqué explicitement par un humain — aucune approbation automatique.",
        inputSchema: {
            type: 'object',
            properties: {
                connectionId: { type: 'number', description: 'Identifiant de la connexion WordPress' },
                actionId: { type: 'number', description: "Identifiant de l'action à approuver" }
            },
            required: ['connectionId', 'actionId']
        }
    },
    {
        name: 'wordpress_reject_action',
        description: "Rejeter une proposition d'action WordPress en attente, sans l'exécuter.",
        inputSchema: {
            type: 'object',
            properties: {
                connectionId: { type: 'number', description: 'Identifiant de la connexion WordPress' },
                actionId: { type: 'number', description: "Identifiant de l'action à rejeter" }
            },
            required: ['connectionId', 'actionId']
        }
    },
    {
        name: 'wordpress_list_products',
        description: 'Lister les produits WooCommerce du site WordPress connecté (lecture seule).',
        inputSchema: {
            type: 'object',
            properties: {
                connectionId: { type: 'number', description: 'Identifiant de la connexion WordPress' },
                search: { type: 'string', description: 'Filtre de recherche optionnel' }
            },
            required: ['connectionId']
        }
    },
    {
        name: 'wordpress_list_orders',
        description: 'Lister les commandes WooCommerce récentes du site WordPress connecté (lecture seule).',
        inputSchema: {
            type: 'object',
            properties: {
                connectionId: { type: 'number', description: 'Identifiant de la connexion WordPress' },
                limit: { type: 'number', description: 'Nombre maximal de résultats (défaut: 15)' }
            },
            required: ['connectionId']
        }
    },
    {
        name: 'list_quotes',
        description: 'Lister les devis enregistrés.',
        inputSchema: { type: 'object', properties: {}, required: [] }
    },
    {
        name: 'get_quote',
        description: 'Récupérer un devis par son identifiant.',
        inputSchema: {
            type: 'object',
            properties: { id: { type: 'number', description: 'Identifiant du devis' } },
            required: ['id']
        }
    },
    {
        name: 'create_quote',
        description: "Créer un nouveau devis. 'items' est un tableau de { description, qty, price }.",
        inputSchema: {
            type: 'object',
            properties: {
                clientName: { type: 'string', description: 'Nom du client' },
                items: { type: 'array', items: { type: 'object' }, description: 'Lignes du devis' },
                taxRate: { type: 'number', description: 'Taux de TVA en % (défaut: 0)' },
                currency: { type: 'string', description: "Devise (défaut: 'XOF')" },
                notes: { type: 'string', description: 'Notes ou conditions de paiement' }
            },
            required: ['items']
        }
    },
    {
        name: 'update_quote',
        description: 'Mettre à jour un devis existant (fusion des champs fournis).',
        inputSchema: {
            type: 'object',
            properties: {
                id: { type: 'number', description: 'Identifiant du devis' },
                clientName: { type: 'string', description: 'Nom du client' },
                items: { type: 'array', items: { type: 'object' }, description: 'Lignes du devis' },
                status: { type: 'string', description: "Statut ('draft', 'pending', 'paid', 'overdue')" }
            },
            required: ['id']
        }
    },
    {
        name: 'export_quote_pdf',
        description: 'Exporter un devis en PDF sur disque (rendu autonome via Chromium headless, aucune dépendance à l\'application Electron).',
        inputSchema: {
            type: 'object',
            properties: {
                id: { type: 'number', description: 'Identifiant du devis' },
                outPath: { type: 'string', description: 'Chemin de fichier de sortie (.pdf)' }
            },
            required: ['id', 'outPath']
        }
    },
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
    },
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

/**
 * Traite l'exécution d'un outil MCP.
 */
async function handleToolCall(name, args) {
    switch (name) {
        case 'list_agents': {
            const personas = orchestrator.getAllPersonas().map(p => ({
                id: p.id,
                name: p.name,
                description: p.description,
                outputFormat: p.outputFormat || 'text'
            }));
            return { personas, count: personas.length };
        }

        case 'call_agent': {
            const { agent, prompt, provider, model } = args || {};
            if (!agent || !prompt) {
                throw new Error("Les arguments 'agent' et 'prompt' sont obligatoires.");
            }
            await db.initDB();
            const aiController = require('../aiController');
            const result = await aiController.chatWithAgent(
                agent,
                prompt,
                null,
                null,
                orchestrator.requiresJsonFormat(agent) ? 'json' : 'text',
                null,
                null,
                false,
                model || null,
                provider || null
            );
            return {
                agent,
                response: result && result.response ? result.response : result
            };
        }

        case 'get_orders': {
            await db.initDB();
            const limit = Math.min(100, Math.max(1, Number(args && args.limit) || 20));
            const result = await db.pool.query(
                `SELECT id, customer_name, phone, items, total_amount, status, created_at FROM wa_orders ORDER BY created_at DESC LIMIT $1`,
                [limit]
            );
            return { orders: result.rows || [], count: result.rows ? result.rows.length : 0 };
        }

        case 'create_product_proposal': {
            await db.initDB();
            const { title, price, description, category } = args || {};
            const actionPayload = JSON.stringify({ title, price, description, category: category || 'Général' });
            const result = await db.pool.query(
                `INSERT INTO wp_pending_actions (action_type, payload, status) VALUES ($1, $2, 'pending_review') RETURNING id`,
                ['create_product', actionPayload]
            );
            return {
                success: true,
                message: 'Proposition de produit enregistrée avec succès en attente de validation humaine (HITL).',
                actionId: result.rows && result.rows[0] ? result.rows[0].id : null
            };
        }

        case 'prospect_leads': {
            const { query, source, zone, quantity } = args || {};
            if (!query) {
                throw new Error("L'argument 'query' est obligatoire.");
            }
            const prospectionService = require('../services/prospectionService');
            return await prospectionService.search({ query, source: source || 'google', zone: zone || '', quantity: quantity || 20 });
        }

        case 'run_pipeline': {
            const { brief, name: runName, listName, listId, segmentName, segmentId } = args || {};
            if (!brief) {
                throw new Error("L'argument 'brief' est obligatoire.");
            }
            await db.initDB();
            const pipelineService = require('../services/pipelineService');
            return await pipelineService.runAuto({ brief, name: runName, listId, listName, segmentId, segmentName });
        }

        case 'create_pipeline_run': {
            const { brief, name: runName } = args || {};
            if (!brief) {
                throw new Error("L'argument 'brief' est obligatoire.");
            }
            await db.initDB();
            const pipelineService = require('../services/pipelineService');
            return { run: await pipelineService.createRun({ brief, name: runName }) };
        }

        case 'save_pipeline_contacts': {
            const { runId, leads, listId, listName, segmentId, segmentName } = args || {};
            if (!runId || !Array.isArray(leads)) {
                throw new Error("Les arguments 'runId' et 'leads' sont obligatoires.");
            }
            await db.initDB();
            const pipelineService = require('../services/pipelineService');
            return await pipelineService.saveContactsStage(runId, {
                leads,
                list_id: listId,
                list_name: listName,
                segment_id: segmentId,
                segment_name: segmentName
            });
        }

        case 'generate_pipeline_messages': {
            const { contactIds } = args || {};
            if (!Array.isArray(contactIds) || contactIds.length === 0) {
                throw new Error("L'argument 'contactIds' est obligatoire.");
            }
            await db.initDB();
            const pipelineService = require('../services/pipelineService');
            return await pipelineService.generateMessagesStage({ contactIds });
        }

        case 'organize_pipeline': {
            const { runId, cards } = args || {};
            if (!runId || !Array.isArray(cards)) {
                throw new Error("Les arguments 'runId' et 'cards' sont obligatoires.");
            }
            await db.initDB();
            const pipelineService = require('../services/pipelineService');
            return await pipelineService.organizeStage(runId, { cards });
        }

        case 'list_pipeline_cards': {
            await db.initDB();
            const pipelineService = require('../services/pipelineService');
            const cards = await pipelineService.listCards({ run_id: args && args.runId });
            return { cards, count: cards.length };
        }

        case 'update_pipeline_card_stage': {
            const { cardId, stage } = args || {};
            if (!cardId || !stage) {
                throw new Error("Les arguments 'cardId' et 'stage' sont obligatoires.");
            }
            await db.initDB();
            const pipelineService = require('../services/pipelineService');
            return { card: await pipelineService.updateCardStage(cardId, stage) };
        }

        case 'list_documents': {
            await db.initDB();
            const documentsService = require('../services/documentsService');
            const documents = await documentsService.listDocuments();
            return { documents, count: documents.length };
        }

        case 'get_document': {
            const { id } = args || {};
            if (!id) throw new Error("L'argument 'id' est obligatoire.");
            await db.initDB();
            const documentsService = require('../services/documentsService');
            return { document: await documentsService.getDocument(id) };
        }

        case 'create_document': {
            const { title, content } = args || {};
            if (!content) throw new Error("L'argument 'content' est obligatoire.");
            await db.initDB();
            const documentsService = require('../services/documentsService');
            return { document: await documentsService.createDocument({ title, content }) };
        }

        case 'update_document': {
            const { id, title, content } = args || {};
            if (!id) throw new Error("L'argument 'id' est obligatoire.");
            await db.initDB();
            const documentsService = require('../services/documentsService');
            return { document: await documentsService.updateDocument(id, { title, content }) };
        }

        case 'delete_document': {
            const { id } = args || {};
            if (!id) throw new Error("L'argument 'id' est obligatoire.");
            await db.initDB();
            const documentsService = require('../services/documentsService');
            return await documentsService.deleteDocument(id);
        }

        case 'generate_photo': {
            const { agent, prompt, aspectRatio, provider, model } = args || {};
            if (!prompt) throw new Error("L'argument 'prompt' est obligatoire.");
            await db.initDB();
            const aiController = require('../aiController');
            const agentId = agent || 'photoshoot';
            const agentResult = await aiController.chatWithAgent(agentId, prompt, null, null, 'json');
            const structuredPrompt = (agentResult && agentResult.response) || prompt;
            const generationResponse = await aiController.generateImage(
                structuredPrompt, aspectRatio || null, null, null, null, provider || null, model || null
            );
            if (generationResponse.error) {
                throw new Error(generationResponse.error);
            }
            return { agent: agentId, structuredPrompt, imageBytes: generationResponse.imageBytes };
        }

        case 'wordpress_propose_action': {
            const { connectionId, prompt } = args || {};
            if (!connectionId || !prompt) {
                throw new Error("Les arguments 'connectionId' et 'prompt' sont obligatoires.");
            }
            await db.initDB();
            const wordpressService = require('../services/wordpressService');
            return await wordpressService.proposeFromPrompt(connectionId, prompt);
        }

        case 'wordpress_list_actions': {
            const { connectionId, status } = args || {};
            if (!connectionId) throw new Error("L'argument 'connectionId' est obligatoire.");
            await db.initDB();
            const wordpressService = require('../services/wordpressService');
            return { data: await wordpressService.listActions(connectionId, status || 'pending_review') };
        }

        case 'wordpress_approve_action': {
            const { connectionId, actionId } = args || {};
            if (!connectionId || !actionId) {
                throw new Error("Les arguments 'connectionId' et 'actionId' sont obligatoires.");
            }
            await db.initDB();
            const wordpressService = require('../services/wordpressService');
            return { data: await wordpressService.execute(connectionId, actionId) };
        }

        case 'wordpress_reject_action': {
            const { connectionId, actionId } = args || {};
            if (!connectionId || !actionId) {
                throw new Error("Les arguments 'connectionId' et 'actionId' sont obligatoires.");
            }
            await db.initDB();
            const wordpressService = require('../services/wordpressService');
            return { data: await wordpressService.reject(connectionId, actionId) };
        }

        case 'wordpress_list_products': {
            const { connectionId, ...query } = args || {};
            if (!connectionId) throw new Error("L'argument 'connectionId' est obligatoire.");
            await db.initDB();
            const wordpressService = require('../services/wordpressService');
            return { data: await wordpressService.listProducts(connectionId, query) };
        }

        case 'wordpress_list_orders': {
            const { connectionId, limit } = args || {};
            if (!connectionId) throw new Error("L'argument 'connectionId' est obligatoire.");
            await db.initDB();
            const wordpressService = require('../services/wordpressService');
            return { data: await wordpressService.listOrders(connectionId, limit || 15) };
        }

        case 'list_quotes': {
            await db.initDB();
            const invoiceService = require('../services/invoiceService');
            const quotes = await invoiceService.listInvoices();
            return { quotes, count: quotes.length };
        }

        case 'get_quote': {
            const { id } = args || {};
            if (!id) throw new Error("L'argument 'id' est obligatoire.");
            await db.initDB();
            const invoiceService = require('../services/invoiceService');
            return { quote: await invoiceService.getInvoice(id) };
        }

        case 'create_quote': {
            const { clientName, items, taxRate, currency, notes } = args || {};
            if (!Array.isArray(items) || items.length === 0) {
                throw new Error("L'argument 'items' est obligatoire.");
            }
            await db.initDB();
            const invoiceService = require('../services/invoiceService');
            return { quote: await invoiceService.createInvoice({ clientName, items, taxRate, currency, notes }) };
        }

        case 'update_quote': {
            const { id, ...patch } = args || {};
            if (!id) throw new Error("L'argument 'id' est obligatoire.");
            await db.initDB();
            const invoiceService = require('../services/invoiceService');
            const existing = await invoiceService.getInvoice(id);
            return { quote: await invoiceService.updateInvoice(id, { ...existing, ...patch }) };
        }

        case 'export_quote_pdf': {
            const { id, outPath } = args || {};
            if (!id || !outPath) throw new Error("Les arguments 'id' et 'outPath' sont obligatoires.");
            await db.initDB();
            const invoiceService = require('../services/invoiceService');
            const result = await invoiceService.renderPdf(id, outPath);
            return { outPath: result.outPath };
        }

        case 'list_instances': {
            await db.initDB();
            const waInstancesService = require('../services/waInstancesService');
            const instances = await waInstancesService.listInstances();
            return { instances, count: instances.length };
        }

        case 'open_whatsapp_chat': {
            const { instanceId, phone, message } = args || {};
            if (!instanceId || !phone) {
                throw new Error("Les arguments 'instanceId' et 'phone' sont obligatoires.");
            }
            await db.initDB();
            const waInstancesService = require('../services/waInstancesService');
            return await waInstancesService.openChat({ instanceId, phone, text: message || '' });
        }

        case 'list_segments': {
            await db.initDB();
            const crmService = require('../services/crmService');
            const segments = await crmService.listSegments();
            return { segments, count: segments.length };
        }

        case 'create_segment': {
            await db.initDB();
            const crmService = require('../services/crmService');
            const segment = await crmService.createSegment(args || {});
            return { success: true, segment };
        }

        case 'delete_segment': {
            await db.initDB();
            const crmService = require('../services/crmService');
            const { id } = args || {};
            if (!id) throw new Error("L'argument 'id' est obligatoire.");
            return await crmService.deleteSegment(id);
        }

        case 'list_contacts': {
            await db.initDB();
            const crmService = require('../services/crmService');
            const contacts = await crmService.listContacts(args || {});
            return { contacts, count: contacts.length };
        }

        case 'get_contact': {
            await db.initDB();
            const crmService = require('../services/crmService');
            const { id } = args || {};
            if (!id) throw new Error("L'argument 'id' est obligatoire.");
            const contact = await crmService.getContact(id);
            return { contact };
        }

        case 'create_contact': {
            await db.initDB();
            const crmService = require('../services/crmService');
            const contact = await crmService.createContact(args || {});
            return { success: true, contact };
        }

        case 'update_contact': {
            await db.initDB();
            const crmService = require('../services/crmService');
            const { id, ...updates } = args || {};
            if (!id) throw new Error("L'argument 'id' est obligatoire.");
            const contact = await crmService.updateContact(id, updates);
            return { success: true, contact };
        }

        case 'delete_contact': {
            await db.initDB();
            const crmService = require('../services/crmService');
            const { id } = args || {};
            if (!id) throw new Error("L'argument 'id' est obligatoire.");
            return await crmService.deleteContact(id);
        }

        case 'assign_contacts_to_segment': {
            await db.initDB();
            const crmService = require('../services/crmService');
            const { contactIds, segmentId } = args || {};
            if (!Array.isArray(contactIds)) throw new Error("L'argument 'contactIds' (tableau) est obligatoire.");
            const result = await crmService.assignContactsToSegment(contactIds, segmentId);
            return { success: true, ...result };
        }

        default:
            throw new Error(`Outil inconnu : '${name}'`);
    }
}

/**
 * Démarre le serveur MCP en écoute sur stdio selon la spécification JSON-RPC 2.0.
 */
async function startMcpServer() {
    // Redirection stricte de console.log vers stderr pendant toute l'exécution du serveur MCP.
    // Garantit l'immunité absolue contre la pollution du canal JSON-RPC sur stdout.
    console.log = (...args) => {
        console.error(...args);
    };

    const rl = readline.createInterface({
        input: process.stdin,
        output: null,
        terminal: false
    });

    const sendResponse = (id, result = null, error = null) => {
        const payload = { jsonrpc: '2.0', id };
        if (error) {
            payload.error = {
                code: error.code || -32000,
                message: error.message || 'Erreur interne MCP'
            };
        } else {
            payload.result = result;
        }
        process.stdout.write(JSON.stringify(payload) + '\n');
    };

    rl.on('line', async (line) => {
        const trimmed = line.trim();
        if (!trimmed) return;

        let request;
        try {
            request = JSON.parse(trimmed);
        } catch {
            sendResponse(null, null, { code: -32700, message: 'Parse error: JSON invalide' });
            return;
        }

        const { id, method, params } = request;

        try {
            switch (method) {
                case 'initialize':
                    sendResponse(id, {
                        protocolVersion: '2024-11-05',
                        serverInfo: {
                            name: 'wacopilote-mcp-server',
                            version: pkg.version
                        },
                        capabilities: {
                            tools: {}
                        }
                    });
                    break;

                case 'notifications/initialized':
                    // Notification client sans id de réponse
                    break;

                case 'ping':
                    sendResponse(id, {});
                    break;

                case 'tools/list':
                    sendResponse(id, { tools: MCP_TOOLS });
                    break;

                case 'tools/call': {
                    const toolName = params && params.name;
                    const toolArgs = (params && params.arguments) || {};
                    const data = await handleToolCall(toolName, toolArgs);
                    sendResponse(id, {
                        content: [
                            {
                                type: 'text',
                                text: typeof data === 'string' ? data : JSON.stringify(data, null, 2)
                            }
                        ]
                    });
                    break;
                }

                default:
                    if (id !== undefined && id !== null) {
                        sendResponse(id, null, { code: -32601, message: `Méthode non supportée: ${method}` });
                    }
                    break;
            }
        } catch (err) {
            if (id !== undefined && id !== null) {
                sendResponse(id, null, { code: -32000, message: err.message });
            }
        }
    });

    // Journalisation de démarrage sur stderr (pour ne pas perturber le protocole JSON-RPC sur stdout)
    console.error(`[WaCopilote MCP] Serveur démarré sur stdio (v${pkg.version})`);
}

module.exports = {
    MCP_TOOLS,
    handleToolCall,
    startMcpServer
};
