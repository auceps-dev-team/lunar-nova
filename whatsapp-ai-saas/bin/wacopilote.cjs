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

const pkg = require('../package.json');


// Commandes (constat R10 de l’audit du 29/09/2026). Chargées ici, après
// l’amorçage de l’environnement ci-dessus : l’ordre de chargement des modules
// du backend est celui d’avant le découpage.
const { handleListAgents, handleRun } = require('./commands/agents.cjs');
const { handleStatus } = require('./commands/status.cjs');
const { handleProspect } = require('./commands/prospect.cjs');
const { handlePipeline } = require('./commands/pipeline.cjs');
const { handleDocuments } = require('./commands/documents.cjs');
const { handlePhoto } = require('./commands/photo.cjs');
const { handleQuotes } = require('./commands/quotes.cjs');
const { handleInstances } = require('./commands/instances.cjs');
const { handleContacts } = require('./commands/contacts.cjs');
const { handleSegments } = require('./commands/segments.cjs');

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
  \x1b[36mlist-agents\x1b[0m                      Lister les 26 personas IA configurés
  \x1b[36mrun\x1b[0m                              Exécuter un agent IA avec un prompt
  \x1b[36mprospect search\x1b[0m                  Recherche de leads ad-hoc (Google Maps, GoAfrica, Annuaire CI)
  \x1b[36mpipeline create|prospect|save-contacts|generate-messages|organize|cards|run\x1b[0m
                                   Wizard de prospection -> liste -> messages -> planning
  \x1b[36mdocuments list|get|create|update|delete\x1b[0m
                                   Gérer les documents texte générés par l'IA
  \x1b[36mphoto generate\x1b[0m                  Générer une photo produit/mannequin (persona + image)
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
  $ wacopilote quotes create --client-name "Boutique X" --data '{"items":[{"description":"Robe","qty":2,"price":15000}]}'
  $ wacopilote quotes export-pdf 5 --out ./devis-5.pdf
  $ wacopilote instances list --json
  $ wacopilote instances open-chat --instance wa-tab-123 --phone 2250700000000 --message "Bonjour !"
  $ wacopilote mcp
`);
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

main().then(() => {
    // Si la commande n'est pas 'mcp' (serveur stdio persistant), sortir
    // proprement — mais seulement APRÈS le vidage effectif de stdout.
    // Un process.exit() immédiat coupe le tampon du pipe avant que Node
    // n'ait flushé les écritures volumineuses : `list-agents --json`
    // (≈ 158 Ko) arrivait ainsi tronqué, de façon non déterministe, chez
    // les consommateurs programmatiques (scripts, IDE agentiques, tests).
    // L'écriture d'une chaîne vide ordonne le drain de tous les écrits
    // précédents (FIFO) ; le callback ne part qu'une fois tout vidé.
    if (process.argv[2] !== 'mcp') {
        process.stdout.once('error', () => process.exit(0)); // EPIPE : lecteur parti, quitter sans trace
        process.stdout.write('', () => process.exit(0));
    }
}).catch((err) => {
    console.error(`\x1b[31mErreur inattendue : ${err.message}\x1b[0m`);
    process.exit(1);
});
