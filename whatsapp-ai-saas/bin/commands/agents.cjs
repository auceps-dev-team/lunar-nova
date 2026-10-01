/**
 * CLI WaCopilote — Agents IA : lister les personas, exécuter un agent.
 *
 * Extrait de bin/wacopilote.cjs (constat R10 de l’audit du 29/09/2026), à
 * l’identique : seuls les chemins require ont gagné un niveau.
 */

const fs = require('fs');
const orchestrator = require('../../backend/agents/orchestrator');
const db = require('../../backend/db');
const { readStdin, parseNamedArgs } = require('../lib/helpers.cjs');

/**
 * Commande `list-agents` : Liste l'ensemble des 26 personas.
 */
async function handleListAgents(args) {
    const isJson = args.includes('--json');
    const personas = orchestrator.getAllPersonas();

    if (isJson) {
        console.log(JSON.stringify({ success: true, count: personas.length, personas }, null, 2));
        return;
    }

    console.log(`\n\x1b[1m🤖 Personas IA Disponibles (${personas.length}) :\x1b[0m\n`);
    console.log('--------------------------------------------------------------------------------');
    for (const p of personas) {
        const idCol = `\x1b[36m${p.id.padEnd(24)}\x1b[0m`;
        const nameCol = `\x1b[1m${(p.name || '').padEnd(30)}\x1b[0m`;
        console.log(`${idCol} ${nameCol}`);
        if (p.description) {
            console.log(`   \x1b[90m└─ ${p.description}\x1b[0m`);
        }
    }
    console.log('--------------------------------------------------------------------------------\n');
}

/**
 * Commande `run` : Exécute un appel unitaire à un agent.
 */
async function handleRun(args) {
    const opts = parseNamedArgs(args);
    const personaId = opts.agent || opts.persona || 'copilot';
    let prompt = opts.prompt || '';
    const filePath = opts.file;
    const provider = opts.provider || null;
    const model = opts.model || null;
    const isJsonOutput = opts.json === true;
    const format = opts.format || (orchestrator.requiresJsonFormat(personaId) ? 'json' : 'text');

    if (filePath) {
        if (!fs.existsSync(filePath)) {
            console.error(`\x1b[31mErreur : Le fichier spécifié '${filePath}' n'existe pas.\x1b[0m`);
            process.exit(1);
        }
        prompt = fs.readFileSync(filePath, 'utf-8');
    }

    if (!prompt) {
        // Tentative de lecture depuis stdin si pipé
        prompt = await readStdin();
    }

    if (!prompt) {
        console.error(`\x1b[31mErreur : Aucun prompt fourni. Utilisez --prompt <texte>, --file <chemin> ou passez les données via stdin (|).\x1b[0m`);
        process.exit(1);
    }

    try {
        await db.initDB();
        const aiController = require('../../backend/aiController');

        const startTime = Date.now();
        const result = await aiController.chatWithAgent(
            personaId,
            prompt,
            null, // pas d'image
            null, // pas d'attachments
            format,
            null, // messages
            null, // currentTasks
            false, // isRealTime
            model,
            provider
        );
        const durationMs = Date.now() - startTime;

        if (isJsonOutput) {
            console.log(JSON.stringify({
                success: true,
                agent: personaId,
                provider: provider || 'default',
                model: model || 'default',
                durationMs,
                response: result && result.response ? result.response : result
            }, null, 2));
        } else {
            const outputText = (result && typeof result.response === 'string') ? result.response : JSON.stringify(result, null, 2);
            console.log(outputText);
        }
    } catch (err) {
        if (isJsonOutput) {
            console.error(JSON.stringify({ success: false, error: err.message }, null, 2));
        } else {
            console.error(`\x1b[31mErreur lors de l'appel à l'agent '${personaId}' : ${err.message}\x1b[0m`);
        }
        process.exit(1);
    }
}

module.exports = { handleListAgents, handleRun };
