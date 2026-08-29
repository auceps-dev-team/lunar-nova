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
  \x1b[36mprospect search\x1b[0m                  Recherche de leads ad-hoc (Google Maps, GoAfrica, Annuaire CI)
  \x1b[36mpipeline create|prospect|save-contacts|generate-messages|organize|cards|run\x1b[0m
                                   Wizard de prospection -> liste -> messages -> planning
  \x1b[36mdocuments list|get|create|update|delete\x1b[0m
                                   Gérer les documents texte générés par l'IA
  \x1b[36mphoto generate\x1b[0m                  Générer une photo produit/mannequin (persona + image)
  \x1b[36mwordpress propose|actions|approve|reject|products|orders|stats\x1b[0m
                                   Gouvernance HITL WordPress (validation humaine obligatoire)
  \x1b[36mquotes list|get|create|update|delete|export-pdf\x1b[0m
                                   Gérer les devis (export PDF autonome, via Chromium headless)
  \x1b[36mcontacts list|get|create|update|delete|assign\x1b[0m
                                   Gérer les contacts CRM (filtres segment/liste, assignation)
  \x1b[36msegments list|create|delete\x1b[0m
                                   Gérer les segments de contacts
  \x1b[36minstances list|open-chat\x1b[0m        Lister/piloter les instances WhatsApp déjà connectées
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

\x1b[1mOPTIONS POUR 'pipeline run --auto' :\x1b[0m
  \x1b[33m--brief <texte>\x1b[0m                  Brief de prospection en langage naturel
  \x1b[33m--list-name <nom>\x1b[0m                Crée une nouvelle liste de contacts pour les leads trouvés
  \x1b[33m--list-id <id>\x1b[0m                   Utilise une liste de contacts existante
  \x1b[33m--segment-name <nom>\x1b[0m             Crée ou utilise un segment de contacts nommé
  \x1b[33m--segment-id <id>\x1b[0m                Utilise un segment de contacts existant

\x1b[1mEXEMPLES :\x1b[0m
  $ wacopilote list-agents
  $ wacopilote run --agent copywriter --prompt "Rédige une accroche WhatsApp pour une boulangerie"
  $ cat brief.txt | wacopilote run --agent outbound_strategist --json
  $ wacopilote run --agent seo_specialist --file ./keywords.txt --provider openrouter
  $ wacopilote prospect search --query "institut de beauté" --zone "Abidjan" --json
  $ wacopilote pipeline run --brief "10 boutiques de vêtements à Abidjan" --auto --list-name "Prospects Abidjan" --segment-name "Mode"
  $ wacopilote pipeline cards --run-id 3 --json
  $ wacopilote documents create --title "Argumentaire" --content "..." --json
  $ wacopilote photo generate --agent photoshoot --prompt "Robe d'été rouge" --out ./photo.png
  $ wacopilote wordpress propose --connection 1 --prompt "Crée un article sur nos soldes d'été"
  $ wacopilote wordpress approve --connection 1 --action 42
  $ wacopilote quotes create --client-name "Boutique X" --data '{"items":[{"description":"Robe","qty":2,"price":15000}]}'
  $ wacopilote quotes export-pdf 5 --out ./devis-5.pdf
  $ wacopilote instances list --json
  $ wacopilote instances open-chat --instance wa-tab-123 --phone 2250700000000 --message "Bonjour !"
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
 * Lit un JSON (tableau de leads ou de cartes) depuis --xxx-file <chemin> ou stdin.
 */
async function readJsonArrayInput(opts, fileKey) {
    let raw = '';
    if (opts[fileKey]) {
        if (!fs.existsSync(opts[fileKey])) {
            console.error(`\x1b[31mErreur : Le fichier '${opts[fileKey]}' n'existe pas.\x1b[0m`);
            process.exit(1);
        }
        raw = fs.readFileSync(opts[fileKey], 'utf-8');
    } else {
        raw = await readStdin();
    }
    if (!raw) return [];
    try {
        const parsed = JSON.parse(raw);
        return Array.isArray(parsed) ? parsed : [];
    } catch {
        console.error(`\x1b[31mErreur : entrée JSON invalide (attendu un tableau).\x1b[0m`);
        process.exit(1);
    }
}

function printJsonOrError(isJson, payload) {
    if (isJson) {
        console.log(JSON.stringify({ success: true, ...payload }, null, 2));
    } else {
        console.log(JSON.stringify(payload, null, 2));
    }
}

/**
 * Commande `prospect search` : recherche de leads ad-hoc (hors wizard pipeline).
 */
async function handleProspect(args) {
    const subCommand = args[0];
    if (subCommand !== 'search') {
        console.error(`\x1b[31mSous-commande 'prospect' inconnue : '${subCommand}'. Utilisez 'prospect search'.\x1b[0m`);
        process.exit(1);
    }
    const opts = parseNamedArgs(args.slice(1));
    const isJson = opts.json === true;
    try {
        const prospectionService = require('../backend/services/prospectionService');
        const { count, leads } = await prospectionService.search({
            query: opts.query,
            source: opts.source || 'google',
            zone: opts.zone || '',
            quantity: opts.quantity ? Number(opts.quantity) : 20,
            pages: opts.pages ? Number(opts.pages) : 1,
            ignoreLandlines: opts['ignore-landlines'] !== 'false',
            country: opts.country,
            subcategorySlug: opts['subcategory-slug']
        });
        printJsonOrError(isJson, { count, leads });
    } catch (err) {
        console.error(`\x1b[31mErreur de prospection : ${err.message}\x1b[0m`);
        process.exit(1);
    }
}

/**
 * Commande `pipeline` : wizard de prospection -> liste -> messages -> planning.
 */
async function handlePipeline(args) {
    const subCommand = args[0];
    const opts = parseNamedArgs(args.slice(1));
    const isJson = opts.json === true;

    await db.initDB();
    const pipelineService = require('../backend/services/pipelineService');

    try {
        switch (subCommand) {
            case 'create': {
                const brief = opts.brief || (await readStdin());
                if (!brief) {
                    console.error(`\x1b[31mErreur : --brief <texte> est obligatoire.\x1b[0m`);
                    process.exit(1);
                }
                const run = await pipelineService.createRun({ brief, name: opts.name });
                printJsonOrError(isJson, { run });
                return;
            }
            case 'prospect': {
                const runId = args[1];
                const brief = opts.brief || (await readStdin());
                if (!runId || !brief) {
                    console.error(`\x1b[31mUsage : pipeline prospect <runId> --brief "..."\x1b[0m`);
                    process.exit(1);
                }
                const result = await pipelineService.prospectStage(runId, { brief });
                printJsonOrError(isJson, result);
                return;
            }
            case 'save-contacts': {
                const runId = args[1];
                if (!runId) {
                    console.error(`\x1b[31mUsage : pipeline save-contacts <runId> [--list-id <id>] [--list-name <nom>] [--segment-id <id>] [--segment-name <nom>] [--leads-file <path>]\x1b[0m`);
                    process.exit(1);
                }
                const leads = await readJsonArrayInput(opts, 'leads-file');
                let listId = opts['list-id'] ? Number(opts['list-id']) : null;
                const listName = opts['list-name'] || opts.list || null;
                if (!listId && listName) {
                    const list = await pipelineService.createContactList(listName);
                    if (list) listId = list.id;
                }

                let segmentId = opts['segment-id'] ? Number(opts['segment-id']) : null;
                const segmentName = opts['segment-name'] || opts.segment || null;
                if (!segmentId && segmentName) {
                    const seg = await pipelineService.createSegment(segmentName);
                    if (seg) segmentId = seg.id;
                }

                const result = await pipelineService.saveContactsStage(runId, {
                    leads,
                    list_id: listId,
                    segment_id: segmentId
                });
                printJsonOrError(isJson, result);
                return;
            }
            case 'generate-messages': {
                const contactIds = (opts['contact-ids'] || '').split(',').map(s => Number(s.trim())).filter(Boolean);
                if (contactIds.length === 0) {
                    console.error(`\x1b[31mUsage : pipeline generate-messages --contact-ids 1,2,3\x1b[0m`);
                    process.exit(1);
                }
                const result = await pipelineService.generateMessagesStage({ contactIds });
                printJsonOrError(isJson, result);
                return;
            }
            case 'organize': {
                const runId = args[1];
                if (!runId) {
                    console.error(`\x1b[31mUsage : pipeline organize <runId> [--cards-file <path>]\x1b[0m`);
                    process.exit(1);
                }
                const cards = await readJsonArrayInput(opts, 'cards-file');
                const result = await pipelineService.organizeStage(runId, { cards });
                printJsonOrError(isJson, result);
                return;
            }
            case 'cards': {
                const cards = await pipelineService.listCards({ run_id: opts['run-id'] });
                printJsonOrError(isJson, { cards });
                return;
            }
            case 'run': {
                const brief = opts.brief || (await readStdin());
                if (!brief) {
                    console.error(`\x1b[31mErreur : --brief <texte> est obligatoire.\x1b[0m`);
                    process.exit(1);
                }
                if (!opts.auto) {
                    console.error(`\x1b[31mErreur : 'pipeline run' nécessite --auto (pipeline complet : prospection -> liste -> messages -> planning). Pour un contrôle étape par étape, utilisez 'pipeline create/prospect/save-contacts/generate-messages/organize'.\x1b[0m`);
                    process.exit(1);
                }
                console.log(`\x1b[36m[Pipeline CLI] Lancement du pipeline autonome avec le brief :\x1b[0m ${brief}`);
                const result = await pipelineService.runAuto({
                    brief,
                    name: opts.name,
                    listId: opts['list-id'] ? Number(opts['list-id']) : null,
                    listName: opts['list-name'] || opts.list || null,
                    segmentId: opts['segment-id'] ? Number(opts['segment-id']) : null,
                    segmentName: opts['segment-name'] || opts.segment || null
                });
                printJsonOrError(isJson, result);
                return;
            }
            default:
                console.error(`\x1b[31mSous-commande 'pipeline' inconnue : '${subCommand}'.\x1b[0m`);
                console.error(`Sous-commandes disponibles : create, prospect, save-contacts, generate-messages, organize, cards, run --auto`);
                process.exit(1);
        }
    } catch (err) {
        if (isJson) {
            console.error(JSON.stringify({ success: false, error: err.message }, null, 2));
        } else {
            console.error(`\x1b[31mErreur pipeline : ${err.message}\x1b[0m`);
        }
        process.exit(1);
    }
}

/**
 * Commande `documents` : CRUD sur les documents texte générés par l'IA.
 */
async function handleDocuments(args) {
    const subCommand = args[0];
    const opts = parseNamedArgs(args.slice(1));
    const isJson = opts.json === true;

    await db.initDB();
    const documentsService = require('../backend/services/documentsService');

    try {
        switch (subCommand) {
            case 'list': {
                const documents = await documentsService.listDocuments();
                printJsonOrError(isJson, { documents });
                return;
            }
            case 'get': {
                const document = await documentsService.getDocument(args[1]);
                printJsonOrError(isJson, { document });
                return;
            }
            case 'create': {
                const content = opts.content || (await readStdin());
                const document = await documentsService.createDocument({ title: opts.title, content });
                printJsonOrError(isJson, { document });
                return;
            }
            case 'update': {
                const content = opts.content !== undefined ? opts.content : (await readStdin());
                const document = await documentsService.updateDocument(args[1], { title: opts.title, content: content || undefined });
                printJsonOrError(isJson, { document });
                return;
            }
            case 'delete': {
                await documentsService.deleteDocument(args[1]);
                printJsonOrError(isJson, { deleted: true });
                return;
            }
            default:
                console.error(`\x1b[31mSous-commande 'documents' inconnue : '${subCommand}'. Utilisez list, get, create, update, delete.\x1b[0m`);
                process.exit(1);
        }
    } catch (err) {
        if (isJson) {
            console.error(JSON.stringify({ success: false, error: err.message }, null, 2));
        } else {
            console.error(`\x1b[31mErreur documents : ${err.message}\x1b[0m`);
        }
        process.exit(1);
    }
}

/**
 * Commande `photo generate` : chaîne persona (prompt structuré) -> génération d'image,
 * écrit les bytes base64 résultants sur disque.
 */
async function handlePhoto(args) {
    const subCommand = args[0];
    if (subCommand !== 'generate') {
        console.error(`\x1b[31mSous-commande 'photo' inconnue : '${subCommand}'. Utilisez 'photo generate'.\x1b[0m`);
        process.exit(1);
    }
    const opts = parseNamedArgs(args.slice(1));
    const isJson = opts.json === true;
    const agentId = opts.agent || 'photoshoot';
    let prompt = opts.prompt || (await readStdin());

    if (!prompt) {
        console.error(`\x1b[31mErreur : --prompt <texte> est obligatoire (ou via stdin).\x1b[0m`);
        process.exit(1);
    }

    try {
        await db.initDB();
        const aiController = require('../backend/aiController');

        const agentResult = await aiController.chatWithAgent(agentId, prompt, null, null, 'json');
        const structuredPrompt = (agentResult && agentResult.response) || prompt;

        const generationResponse = await aiController.generateImage(
            structuredPrompt,
            opts['aspect-ratio'] || null,
            null,
            null,
            null,
            opts.provider || null,
            opts.model || null
        );

        if (generationResponse.error) {
            throw new Error(generationResponse.error);
        }

        let outPath = null;
        if (opts.out) {
            fs.writeFileSync(opts.out, Buffer.from(generationResponse.imageBytes, 'base64'));
            outPath = path.resolve(opts.out);
        }

        if (isJson) {
            console.log(JSON.stringify({
                success: true,
                agent: agentId,
                structuredPrompt,
                outPath,
                imageBytes: outPath ? undefined : generationResponse.imageBytes
            }, null, 2));
        } else if (outPath) {
            console.log(`\x1b[32mImage générée et enregistrée : ${outPath}\x1b[0m`);
        } else {
            console.log(generationResponse.imageBytes);
        }
    } catch (err) {
        if (isJson) {
            console.error(JSON.stringify({ success: false, error: err.message }, null, 2));
        } else {
            console.error(`\x1b[31mErreur de génération photo : ${err.message}\x1b[0m`);
        }
        process.exit(1);
    }
}

/**
 * Commande `wordpress` : gouvernance HITL (propose -> approve/reject) + lecture seule.
 * Toute écriture réelle sur le site WordPress du client exige une commande
 * `approve` explicite, exécutée par un humain — jamais automatique.
 */
async function handleWordpress(args) {
    const subCommand = args[0];
    const opts = parseNamedArgs(args.slice(1));
    const isJson = opts.json === true;
    const connectionId = opts.connection;

    if (!connectionId && subCommand !== 'help') {
        console.error(`\x1b[31mErreur : --connection <id> est obligatoire.\x1b[0m`);
        process.exit(1);
    }

    await db.initDB();
    const wordpressService = require('../backend/services/wordpressService');

    try {
        switch (subCommand) {
            case 'propose': {
                const prompt = opts.prompt || (await readStdin());
                if (!prompt) {
                    console.error(`\x1b[31mErreur : --prompt <texte> est obligatoire (ou via stdin).\x1b[0m`);
                    process.exit(1);
                }
                const result = await wordpressService.proposeFromPrompt(connectionId, prompt);
                printJsonOrError(isJson, result);
                return;
            }
            case 'actions': {
                const data = await wordpressService.listActions(connectionId, opts.status || 'pending_review');
                printJsonOrError(isJson, { data });
                return;
            }
            case 'approve': {
                if (!opts.action) {
                    console.error(`\x1b[31mErreur : --action <actionId> est obligatoire.\x1b[0m`);
                    process.exit(1);
                }
                const data = await wordpressService.execute(connectionId, opts.action);
                printJsonOrError(isJson, { data });
                return;
            }
            case 'reject': {
                if (!opts.action) {
                    console.error(`\x1b[31mErreur : --action <actionId> est obligatoire.\x1b[0m`);
                    process.exit(1);
                }
                const data = await wordpressService.reject(connectionId, opts.action);
                printJsonOrError(isJson, { data });
                return;
            }
            case 'products': {
                const data = await wordpressService.listProducts(connectionId, opts);
                printJsonOrError(isJson, { data });
                return;
            }
            case 'orders': {
                const data = await wordpressService.listOrders(connectionId, opts.limit || 15);
                printJsonOrError(isJson, { data });
                return;
            }
            case 'stats': {
                const data = await wordpressService.getStats(connectionId);
                printJsonOrError(isJson, { data });
                return;
            }
            default:
                console.error(`\x1b[31mSous-commande 'wordpress' inconnue : '${subCommand}'. Utilisez propose, actions, approve, reject, products, orders, stats.\x1b[0m`);
                process.exit(1);
        }
    } catch (err) {
        if (isJson) {
            console.error(JSON.stringify({ success: false, error: err.message }, null, 2));
        } else {
            console.error(`\x1b[31mErreur WordPress : ${err.message}\x1b[0m`);
        }
        process.exit(1);
    }
}

/**
 * Commande `quotes` : CRUD sur les devis + export PDF (Chromium headless
 * autonome, voir invoiceService.renderPdf).
 */
async function handleQuotes(args) {
    const subCommand = args[0];
    const opts = parseNamedArgs(args.slice(1));
    const isJson = opts.json === true;

    await db.initDB();
    const invoiceService = require('../backend/services/invoiceService');

    try {
        switch (subCommand) {
            case 'list': {
                const quotes = await invoiceService.listInvoices();
                printJsonOrError(isJson, { quotes });
                return;
            }
            case 'get': {
                const quote = await invoiceService.getInvoice(args[1]);
                printJsonOrError(isJson, { quote });
                return;
            }
            case 'create': {
                const raw = opts.data || (await readStdin());
                let draft = {};
                try { draft = raw ? JSON.parse(raw) : {}; } catch {
                    console.error(`\x1b[31mErreur : --data doit être un JSON valide (ou via stdin).\x1b[0m`);
                    process.exit(1);
                }
                if (opts['client-name']) draft.clientName = opts['client-name'];
                const quote = await invoiceService.createInvoice(draft);
                printJsonOrError(isJson, { quote });
                return;
            }
            case 'update': {
                const existing = await invoiceService.getInvoice(args[1]);
                const raw = opts.data || (await readStdin());
                let patch = {};
                try { patch = raw ? JSON.parse(raw) : {}; } catch {
                    console.error(`\x1b[31mErreur : --data doit être un JSON valide (ou via stdin).\x1b[0m`);
                    process.exit(1);
                }
                const quote = await invoiceService.updateInvoice(args[1], { ...existing, ...patch });
                printJsonOrError(isJson, { quote });
                return;
            }
            case 'delete': {
                await invoiceService.deleteInvoice(args[1]);
                printJsonOrError(isJson, { deleted: true });
                return;
            }
            case 'export-pdf': {
                if (!opts.out) {
                    console.error(`\x1b[31mErreur : --out <chemin.pdf> est obligatoire.\x1b[0m`);
                    process.exit(1);
                }
                const outPath = path.resolve(opts.out);
                await invoiceService.renderPdf(args[1], outPath);
                printJsonOrError(isJson, { outPath });
                return;
            }
            default:
                console.error(`\x1b[31mSous-commande 'quotes' inconnue : '${subCommand}'. Utilisez list, get, create, update, delete, export-pdf.\x1b[0m`);
                process.exit(1);
        }
    } catch (err) {
        if (isJson) {
            console.error(JSON.stringify({ success: false, error: err.message }, null, 2));
        } else {
            console.error(`\x1b[31mErreur devis : ${err.message}\x1b[0m`);
        }
        process.exit(1);
    }
}

/**
 * Commande `instances` : lister/piloter les instances WhatsApp déjà connectées.
 * Créer une toute nouvelle instance nécessite un scan QR humain dans l'app
 * Electron — hors périmètre d'un CLI headless, non disponible ici.
 */
async function handleInstances(args) {
    const subCommand = args[0];
    const opts = parseNamedArgs(args.slice(1));
    const isJson = opts.json === true;

    await db.initDB();
    const waInstancesService = require('../backend/services/waInstancesService');

    try {
        switch (subCommand) {
            case 'list': {
                const instances = await waInstancesService.listInstances();
                printJsonOrError(isJson, { instances });
                return;
            }
            case 'open-chat': {
                if (!opts.instance || !opts.phone) {
                    console.error(`\x1b[31mUsage : instances open-chat --instance <id> --phone <numéro> [--message <texte>]\x1b[0m`);
                    process.exit(1);
                }
                const result = await waInstancesService.openChat({
                    instanceId: opts.instance,
                    phone: opts.phone,
                    text: opts.message || ''
                });
                printJsonOrError(isJson, result);
                return;
            }
            default:
                console.error(`\x1b[31mSous-commande 'instances' inconnue : '${subCommand}'. Utilisez list, open-chat.\x1b[0m`);
                process.exit(1);
        }
    } catch (err) {
        if (isJson) {
            console.error(JSON.stringify({ success: false, error: err.message }, null, 2));
        } else {
            console.error(`\x1b[31mErreur instances : ${err.message}\x1b[0m`);
        }
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
        await handlePipeline(rawArgs.slice(1));
        return;
    }

    if (command === 'prospect') {
        await handleProspect(rawArgs.slice(1));
        return;
    }

    if (command === 'documents') {
        await handleDocuments(rawArgs.slice(1));
        return;
    }

    if (command === 'photo') {
        await handlePhoto(rawArgs.slice(1));
        return;
    }

    if (command === 'wordpress') {
        await handleWordpress(rawArgs.slice(1));
        return;
    }

    if (command === 'quotes') {
        await handleQuotes(rawArgs.slice(1));
        return;
    }

    if (command === 'instances') {
        await handleInstances(rawArgs.slice(1));
        return;
    }

    if (command === 'contacts') {
        await handleContacts(rawArgs.slice(1));
        return;
    }

    if (command === 'segments') {
        await handleSegments(rawArgs.slice(1));
        return;
    }

    console.error(`\x1b[31mCommande inconnue : '${command}'. Tapez 'wacopilote help' pour voir la liste des commandes.\x1b[0m`);
    process.exit(1);
}

/**
 * Commande `contacts` : Gestion des contacts CRM.
 */
async function handleContacts(args) {
    const subCommand = args[0] || 'list';
    const isJson = args.includes('--json');
    const opts = parseNamedArgs(args.slice(1));
    const crmService = require('../backend/services/crmService');
    await db.initDB();

    if (subCommand === 'list') {
        const contacts = await crmService.listContacts({
            segmentId: opts['segment-id'] || opts['segment'],
            listId: opts['list-id'] || opts['list'],
            status: opts['status'],
            search: opts['search'] || opts['query'],
            limit: opts['limit'],
            offset: opts['offset']
        });
        printJsonOrError(isJson, { contacts, count: contacts.length });
        return;
    }

    if (subCommand === 'get') {
        const id = args[1];
        if (!id) {
            console.error('\x1b[31mErreur : Identifiant de contact requis.\x1b[0m');
            process.exit(1);
        }
        const contact = await crmService.getContact(id);
        printJsonOrError(isJson, { contact });
        return;
    }

    if (subCommand === 'create') {
        const phone = opts.phone || args[1];
        if (!phone) {
            console.error('\x1b[31mErreur : Option --phone <numéro> requise.\x1b[0m');
            process.exit(1);
        }
        const contact = await crmService.createContact({
            phone,
            name: opts.name,
            email: opts.email,
            address: opts.address,
            segmentId: opts['segment-id'] || opts['segment'],
            listId: opts['list-id'] || opts['list'],
            status: opts.status
        });
        printJsonOrError(isJson, { success: true, contact });
        return;
    }

    if (subCommand === 'update') {
        const id = args[1];
        if (!id) {
            console.error('\x1b[31mErreur : Identifiant de contact requis.\x1b[0m');
            process.exit(1);
        }
        const contact = await crmService.updateContact(id, {
            name: opts.name,
            phone: opts.phone,
            email: opts.email,
            address: opts.address,
            segmentId: opts['segment-id'] || opts['segment'],
            listId: opts['list-id'] || opts['list'],
            status: opts.status
        });
        printJsonOrError(isJson, { success: true, contact });
        return;
    }

    if (subCommand === 'delete') {
        const id = args[1];
        if (!id) {
            console.error('\x1b[31mErreur : Identifiant de contact requis.\x1b[0m');
            process.exit(1);
        }
        await crmService.deleteContact(id);
        printJsonOrError(isJson, { success: true, id });
        return;
    }

    if (subCommand === 'assign') {
        const segmentId = opts['segment-id'] || opts['segment'];
        const nonNamed = args.slice(1).filter(a => !a.startsWith('--'));
        const contactIds = nonNamed.map(id => parseInt(id, 10)).filter(id => !isNaN(id));
        if (contactIds.length === 0) {
            console.error('\x1b[31mErreur : Au moins un ID de contact doit être spécifié.\x1b[0m');
            process.exit(1);
        }
        const result = await crmService.assignContactsToSegment(contactIds, segmentId ? parseInt(segmentId, 10) : null);
        printJsonOrError(isJson, { success: true, ...result });
        return;
    }

    console.error(`\x1b[31mSous-commande contacts inconnue : '${subCommand}'.\x1b[0m`);
    process.exit(1);
}

/**
 * Commande `segments` : Gestion des segments CRM.
 */
async function handleSegments(args) {
    const subCommand = args[0] || 'list';
    const isJson = args.includes('--json');
    const opts = parseNamedArgs(args.slice(1));
    const crmService = require('../backend/services/crmService');
    await db.initDB();

    if (subCommand === 'list') {
        const segments = await crmService.listSegments();
        printJsonOrError(isJson, { segments, count: segments.length });
        return;
    }

    if (subCommand === 'create') {
        const name = opts.name || args[1];
        if (!name) {
            console.error('\x1b[31mErreur : Nom de segment requis (--name <nom>).\x1b[0m');
            process.exit(1);
        }
        const segment = await crmService.createSegment({ name });
        printJsonOrError(isJson, { success: true, segment });
        return;
    }

    if (subCommand === 'delete') {
        const id = args[1];
        if (!id) {
            console.error('\x1b[31mErreur : Identifiant de segment requis.\x1b[0m');
            process.exit(1);
        }
        await crmService.deleteSegment(id);
        printJsonOrError(isJson, { success: true, id });
        return;
    }

    console.error(`\x1b[31mSous-commande segments inconnue : '${subCommand}'.\x1b[0m`);
    process.exit(1);
}

main().then(() => {
    // Si la commande n'est pas 'mcp' (serveur stdio persistant), sortir proprement
    if (process.argv[2] !== 'mcp') {
        process.exit(0);
    }
}).catch((err) => {
    console.error(`\x1b[31mErreur inattendue : ${err.message}\x1b[0m`);
    process.exit(1);
});
