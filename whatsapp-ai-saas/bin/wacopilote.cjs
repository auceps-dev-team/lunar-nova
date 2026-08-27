#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
let dotenv;
try {
    dotenv = require('dotenv');
} catch {
    dotenv = require('../backend/node_modules/dotenv');
}

// Chargement de l'environnement backend en mode silencieux (anti-pollution de stdout pour le format JSON)
const backendEnvPath = path.join(__dirname, '../backend/.env');
if (fs.existsSync(backendEnvPath)) {
    dotenv.config({ path: backendEnvPath, quiet: true });
}
dotenv.config({ quiet: true });

const orchestrator = require('../backend/agents/orchestrator');
const db = require('../backend/db');
const pkg = require('../package.json');

/**
 * Lit l'intégralité du flux d'entrée standard (stdin) de manière asynchrone.
 * Permet le chaînage Unix : `cat prompt.txt | wacopilote run --agent copywriter`
 *
 * @returns {Promise<string>}
 */
async function readStdin() {
    if (process.stdin.isTTY) {
        return '';
    }
    return new Promise((resolve) => {
        let data = '';
        let resolved = false;

        const finish = () => {
            if (!resolved) {
                resolved = true;
                resolve(data.trim());
            }
        };

        // Timeout de sécurité si le descripteur stdin reste ouvert sans émettre d'octets
        const timer = setTimeout(finish, 250);

        process.stdin.setEncoding('utf-8');
        process.stdin.on('data', (chunk) => {
            data += chunk;
        });
        process.stdin.on('end', () => {
            clearTimeout(timer);
            finish();
        });
        process.stdin.on('error', () => {
            clearTimeout(timer);
            finish();
        });
    });
}

/**
 * Affiche l'aide et la documentation de la CLI.
 */
function printHelp() {
    console.log(`
\x1b[1m\x1b[32mWaCopilote CLI\x1b[0m \x1b[90mv${pkg.version}\x1b[0m — Interface en ligne de commande pour le pilotage d'agents IA

\x1b[1mUSAGE :\x1b[0m
  wacopilote <commande> [options]
  node bin/wacopilote.cjs <commande> [options]

\x1b[1mCOMMANDES DISPONIBLES :\x1b[0m
  \x1b[36mlist-agents\x1b[0m                      Lister les 27 personas IA configurés
  \x1b[36mrun\x1b[0m                              Exécuter un agent IA avec un prompt
  \x1b[36mpipeline run\x1b[0m                     Lancer un pipeline autonome de prospection
  \x1b[36mmcp\x1b[0m                              Démarrer le serveur MCP (Model Context Protocol stdio)
  \x1b[36mstatus\x1b[0m                           Vérifier la configuration locale (DB, clés, API)
  \x1b[36mversion\x1b[0m, \x1b[36m-v\x1b[0m, \x1b[36m--version\x1b[0m         Afficher la version de WaCopilote
  \x1b[36mhelp\x1b[0m, \x1b[36m-h\x1b[0m, \x1b[36m--help\x1b[0m               Afficher cette aide

\x1b[1mOPTIONS POUR 'run' :\x1b[0m
  \x1b[33m--agent <id>\x1b[0m                     Identifiant de l'agent (ex: copywriter, creative, ella)
  \x1b[33m--prompt <texte>\x1b[0m                 Message ou prompt à envoyer à l'agent
  \x1b[33m--file <chemin>\x1b[0m                  Chemin vers un fichier texte contenant le prompt
  \x1b[33m--provider <nom>\x1b[0m                 Fournisseur IA forcé (gemini, openrouter, nvidia, ollama)
  \x1b[33m--model <id>\x1b[0m                     Modèle IA forcé (ex: gemini-2.5-flash, meta/llama-3.3-70b-instruct)
  \x1b[33m--format <text|json>\x1b[0m             Format de sortie souhaité (défaut: text)
  \x1b[33m--json\x1b[0m                           Renvoyer le résultat complet sous forme d'objet JSON

\x1b[1mEXEMPLES :\x1b[0m
  $ wacopilote list-agents
  $ wacopilote run --agent copywriter --prompt "Rédige une accroche WhatsApp pour une boulangerie"
  $ cat brief.txt | wacopilote run --agent outbound_strategist --json
  $ wacopilote run --agent seo_specialist --file ./keywords.txt --provider openrouter
  $ wacopilote pipeline run --brief "10 boutiques de vêtements à Abidjan"
  $ wacopilote mcp
`);
}

/**
 * Commande `list-agents` : Liste l'ensemble des 27 personas.
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
 * Parseur d'arguments basique pour options nommées (--key value ou --flag).
 */
function parseNamedArgs(argsList) {
    const parsed = {};
    for (let i = 0; i < argsList.length; i++) {
        const arg = argsList[i];
        if (arg.startsWith('--')) {
            const key = arg.slice(2);
            if (i + 1 < argsList.length && !argsList[i + 1].startsWith('--')) {
                parsed[key] = argsList[i + 1];
                i++;
            } else {
                parsed[key] = true;
            }
        }
    }
    return parsed;
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
        const aiController = require('../backend/aiController');

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

/**
 * Commande `status` : Affiche l'état de la configuration et des services.
 */
async function handleStatus(args) {
    const isJson = args.includes('--json');
    try {
        await db.initDB();
        const geminiKeySet = Boolean(await db.getSetting('gemini_api_key', '') || process.env.GEMINI_API_KEY);
        const openrouterKeySet = Boolean(await db.getSetting('openrouter_api_key', '') || process.env.OPENROUTER_API_KEY);
        const nvidiaKeySet = Boolean(await db.getSetting('openai_api_key', '') || process.env.NVIDIA_API_KEY);
        const defaultProvider = await db.getSetting('default_ai_provider', 'gemini');

        const statusData = {
            version: pkg.version,
            database: 'SQLite (Opérationnelle)',
            personasCount: orchestrator.getAllPersonas().length,
            defaultProvider,
            keysConfigured: {
                gemini: geminiKeySet,
                openrouter: openrouterKeySet,
                nvidia: nvidiaKeySet
            }
        };

        if (isJson) {
            console.log(JSON.stringify({ success: true, ...statusData }, null, 2));
            return;
        }

        console.log(`\n\x1b[1m📊 État de WaCopilote (v${pkg.version}) :\x1b[0m\n`);
        console.log(`  • Base de données : \x1b[32m${statusData.database}\x1b[0m`);
        console.log(`  • Personas IA     : \x1b[36m${statusData.personasCount} chargés\x1b[0m`);
        console.log(`  • Fournisseur par défaut : \x1b[33m${statusData.defaultProvider}\x1b[0m`);
        console.log(`  • Clés configurées :`);
        console.log(`      - Google Gemini : ${geminiKeySet ? '🟢 Active' : '⚪ Absente'}`);
        console.log(`      - OpenRouter    : ${openrouterKeySet ? '🟢 Active' : '⚪ Absente'}`);
        console.log(`      - NVIDIA NIM    : ${nvidiaKeySet ? '🟢 Active' : '⚪ Absente'}\n`);
    } catch (err) {
        console.error(`\x1b[31mErreur d'initialisation : ${err.message}\x1b[0m`);
        process.exit(1);
    }
}

/**
 * Point d'entrée principal de la CLI.
 */
async function main() {
    const rawArgs = process.argv.slice(2);
    const command = rawArgs[0] ? rawArgs[0].toLowerCase() : '';

    if (!command || command === 'help' || command === '-h' || command === '--help') {
        printHelp();
        return;
    }

    if (command === 'version' || command === '-v' || command === '--version') {
        console.log(`WaCopilote v${pkg.version}`);
        return;
    }

    if (command === 'list-agents' || command === 'list') {
        await handleListAgents(rawArgs.slice(1));
        return;
    }

    if (command === 'run' || command === 'chat') {
        await handleRun(rawArgs.slice(1));
        return;
    }

    if (command === 'status') {
        await handleStatus(rawArgs.slice(1));
        return;
    }

    if (command === 'mcp') {
        // Lance le serveur MCP sur stdio
        const { startMcpServer } = require('../backend/mcp/wacopiloteMcpServer');
        await startMcpServer();
        return;
    }

    if (command === 'pipeline') {
        const subCommand = rawArgs[1];
        if (subCommand === 'run') {
            const opts = parseNamedArgs(rawArgs.slice(2));
            const brief = opts.brief || (await readStdin());
            if (!brief) {
                console.error(`\x1b[31mErreur : Le paramètre --brief <texte> est obligatoire pour le pipeline.\x1b[0m`);
                process.exit(1);
            }
            console.log(`\x1b[36m[Pipeline CLI] Lancement du pipeline avec le brief :\x1b[0m ${brief}`);
            await db.initDB();
            const aiController = require('../backend/aiController');
            const aiResult = await aiController.chatWithAgent('prospecting_agent', brief, null, null, 'json');
            console.log(aiResult && aiResult.response ? aiResult.response : JSON.stringify(aiResult, null, 2));
            return;
        }
    }

    console.error(`\x1b[31mCommande inconnue : '${command}'. Tapez 'wacopilote help' pour voir la liste des commandes.\x1b[0m`);
    process.exit(1);
}

main().catch((err) => {
    console.error(`\x1b[31mErreur inattendue : ${err.message}\x1b[0m`);
    process.exit(1);
});
