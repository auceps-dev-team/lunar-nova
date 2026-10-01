/**
 * CLI WaCopilote — Génération photo.
 *
 * Extrait de bin/wacopilote.cjs (constat R10 de l’audit du 29/09/2026), à
 * l’identique : seuls les chemins require ont gagné un niveau.
 */

const fs = require('fs');
const path = require('path');
const db = require('../../backend/db');
const { readStdin, parseNamedArgs } = require('../lib/helpers.cjs');

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
        const aiController = require('../../backend/aiController');

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

module.exports = { handlePhoto };
