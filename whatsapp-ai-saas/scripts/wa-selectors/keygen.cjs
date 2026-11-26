#!/usr/bin/env node
// Génère la paire de clés Ed25519 qui signe les sélecteurs WhatsApp.
//
// La clé PRIVÉE est écrite HORS du dépôt git (refus sinon) et jamais
// écrasée. La clé publique est imprimée : la coller dans TRUSTED_KEYS
// (backend/wa/waSelectors.js), puis publier une version de l'application.
//
//   node scripts/wa-selectors/keygen.cjs <dossier hors du dépôt>
//
// Sous Windows, le mode 0600 n'a pas d'effet : protéger le dossier lui-même
// (coffre de mots de passe, disque chiffré).
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const cible = process.argv[2];
if (!cible) {
    console.error('Usage : node scripts/wa-selectors/keygen.cjs <dossier hors du dépôt>');
    process.exit(2);
}

let racine;
try {
    racine = execSync('git rev-parse --show-toplevel', { cwd: __dirname, encoding: 'utf8' }).trim();
} catch {
    racine = path.resolve(__dirname, '..', '..', '..');
}
const dossier = path.resolve(cible);
const relatif = path.relative(path.resolve(racine), dossier);
if (!relatif.startsWith('..') && !path.isAbsolute(relatif)) {
    console.error(`Refus : ${dossier} est dans le dépôt (${racine}). La clé privée ne doit jamais y être.`);
    process.exit(2);
}

fs.mkdirSync(dossier, { recursive: true });
const fichier = path.join(dossier, 'wa-selectors-signing-key.pem');
if (fs.existsSync(fichier)) {
    console.error(`Refus : ${fichier} existe déjà — pas d'écrasement d'une clé en service.`);
    process.exit(2);
}

const { publicKey, privateKey } = crypto.generateKeyPairSync('ed25519');
fs.writeFileSync(fichier, privateKey.export({ format: 'pem', type: 'pkcs8' }), { mode: 0o600, flag: 'wx' });
console.log(`Clé privée écrite : ${fichier}`);
console.log('Clé publique, à coller dans TRUSTED_KEYS (backend/wa/waSelectors.js) :');
console.log(publicKey.export({ format: 'der', type: 'spki' }).toString('base64'));
