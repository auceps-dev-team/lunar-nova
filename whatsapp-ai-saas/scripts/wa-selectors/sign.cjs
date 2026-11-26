#!/usr/bin/env node
// Signe un fichier de sélecteurs WhatsApp, après l'avoir validé exactement
// comme l'application le fera (même module).
//
//   node scripts/wa-selectors/sign.cjs <wa-selectors.json> <clé privée .pem>
//
// Écrit <wa-selectors.json>.sig (base64, sur les octets exacts du fichier),
// relit la signature avec la clé publique dérivée, et dit si cette clé est
// reconnue par la version de l'application de ce dépôt (TRUSTED_KEYS).
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const { validateSelectorFile, verifyAndParse, TRUSTED_KEYS, FILE_NAME } = require('../../backend/wa/waSelectors');

const [fichierJson, fichierCle] = process.argv.slice(2);
if (!fichierJson || !fichierCle) {
    console.error('Usage : node scripts/wa-selectors/sign.cjs <wa-selectors.json> <clé privée .pem>');
    process.exit(2);
}
if (path.basename(fichierJson) !== FILE_NAME) {
    console.error(`Refus : l'application télécharge « ${FILE_NAME} » — renommer le fichier avant de signer.`);
    process.exit(2);
}

const octets = fs.readFileSync(fichierJson);
let contenu;
try {
    contenu = JSON.parse(octets.toString('utf8'));
} catch (e) {
    console.error(`JSON illisible : ${e.message}`);
    process.exit(1);
}
const v = validateSelectorFile(contenu);
if (!v.ok) {
    console.error('Fichier refusé par le validateur de l\'application :');
    for (const e of v.erreurs) console.error(`  - ${e}`);
    process.exit(1);
}

const privee = crypto.createPrivateKey(fs.readFileSync(fichierCle));
const signature = crypto.sign(null, octets, privee).toString('base64');
const publique = crypto.createPublicKey(privee).export({ format: 'der', type: 'spki' }).toString('base64');
const relu = verifyAndParse(octets, signature, { cles: [publique] });
if (!relu.ok) {
    console.error(`Relecture de la signature en échec : ${relu.erreurs.join(' ; ')}`);
    process.exit(1);
}
fs.writeFileSync(`${fichierJson}.sig`, signature);

console.log(`Signé : version ${v.version}, ${Object.keys(v.selectors).length} clé(s) de sélecteurs.`);
if (v.ignorees.length) console.log(`Clés inconnues de cette version de l'application (ignorées par elle) : ${v.ignorees.join(', ')}`);
console.log(TRUSTED_KEYS.includes(publique)
    ? 'Clé publique reconnue par cette version de l\'application.'
    : 'ATTENTION : cette clé publique n\'est PAS dans TRUSTED_KEYS — les applications refuseront ce fichier.');
console.log('Publication (pré-version : elle ne doit jamais devenir la « latest » que lit l\'updater) :');
console.log(`  gh release upload wa-selectors "${fichierJson}" "${fichierJson}.sig" --clobber -R auceps-dev-team/wacopilote-releases`);
