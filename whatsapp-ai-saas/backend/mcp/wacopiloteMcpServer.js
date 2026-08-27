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

        default:
            throw new Error(`Outil inconnu : '${name}'`);
    }
}

/**
 * Démarre le serveur MCP en écoute sur stdio selon la spécification JSON-RPC 2.0.
 */
async function startMcpServer() {
    const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout,
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
