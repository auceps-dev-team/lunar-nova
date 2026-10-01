const readline = require('readline');
const pkg = require('../../package.json');

// Outils regroupés par domaine (constat R9 de l’audit du 29/09/2026). L’ordre
// des domaines reproduit l’ordre d’origine de la liste : `tools/list` renvoie
// exactement la même séquence qu’avant le découpage.
const DOMAINS = [
    require('./tools/agents'),
    require('./tools/orders'),
    require('./tools/pipeline'),
    require('./tools/documents'),
    require('./tools/photo'),
    require('./tools/quotes'),
    require('./tools/whatsapp'),
    require('./tools/crm')
];

const MCP_TOOLS = DOMAINS.flatMap((d) => d.definitions);

// Objet sans prototype : un nom comme « constructor » ou « toString » doit
// donner « Outil inconnu », comme le faisait le `switch`, et non une méthode
// héritée d’Object.
const HANDLERS = Object.assign(Object.create(null), ...DOMAINS.map((d) => d.handlers));

/**
 * Traite l'exécution d'un outil MCP.
 */
async function handleToolCall(name, args) {
    const handler = HANDLERS[name];
    if (!handler) {
        throw new Error(`Outil inconnu : '${name}'`);
    }
    return handler(args);
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
