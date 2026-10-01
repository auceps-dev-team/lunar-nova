/**
 * Outils MCP — Personas IA : lister, appeler un agent.
 *
 * Extrait de wacopiloteMcpServer.js (constat R9 de l’audit du 29/09/2026),
 * à l’identique : définitions et corps des handlers sont ceux de l’ancien
 * `switch`, seuls les chemins require ont gagné un niveau.
 */

const db = require('../../db');
const orchestrator = require('../../agents/orchestrator');

const definitions = [
        {
            name: 'list_agents',
            description: 'Lister l\'ensemble des 26 personas IA configurés dans WaCopilote avec leurs rôles, compétences et formats attendus.',
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
        }
];

const handlers = {
    list_agents: async () => {
        const personas = orchestrator.getAllPersonas().map(p => ({
            id: p.id,
            name: p.name,
            description: p.description,
            outputFormat: p.outputFormat || 'text'
        }));
        return { personas, count: personas.length };
    },

    call_agent: async (args) => {
        const { agent, prompt, provider, model } = args || {};
        if (!agent || !prompt) {
            throw new Error("Les arguments 'agent' et 'prompt' sont obligatoires.");
        }
        await db.initDB();
        const aiController = require('../../aiController');
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
};

module.exports = { definitions, handlers };
