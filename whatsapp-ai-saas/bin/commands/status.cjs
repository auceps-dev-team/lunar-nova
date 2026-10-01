/**
 * CLI WaCopilote — État de l’installation.
 *
 * Extrait de bin/wacopilote.cjs (constat R10 de l’audit du 29/09/2026), à
 * l’identique : seuls les chemins require ont gagné un niveau.
 */

const orchestrator = require('../../backend/agents/orchestrator');
const db = require('../../backend/db');
const pkg = require('../../package.json');

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

module.exports = { handleStatus };
