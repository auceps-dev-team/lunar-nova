const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

/**
 * Chiffrement au repos des secrets stockés en base (clés d'API, mots de passe
 * d'application WordPress).
 *
 * AES-256-GCM : confidentialité + authentification. Une valeur altérée en base
 * fait échouer le déchiffrement au lieu de produire silencieusement du contenu
 * erroné qu'on enverrait à un fournisseur tiers.
 *
 * La clé maître ne vit jamais dans la base qu'elle protège :
 *   - en production, le processus Electron la scelle via safeStorage (DPAPI sur
 *     Windows, Trousseau sur macOS, libsecret sur Linux) et la transmet au
 *     backend à son démarrage — copier database.sqlite sur une autre machine ne
 *     suffit alors pas à lire les secrets ;
 *   - en développement (backend lancé seul), elle est écrite dans un fichier
 *     local, ce qui protège les sauvegardes et les dossiers synchronisés, mais
 *     pas un attaquant qui lit déjà le disque.
 */

const PREFIX = 'enc:v1:';
const IV_BYTES = 12;
const TAG_BYTES = 16;

const userDataPath = process.env.USER_DATA_PATH;
const keyFilePath = userDataPath
    ? path.join(userDataPath, 'master-key')
    : path.join(__dirname, '..', 'master-key');

function loadOrCreateMasterKey() {
    const fromEnv = process.env.WACOPILOTE_MASTER_KEY;
    if (fromEnv && /^[0-9a-f]{64}$/i.test(fromEnv)) {
        return Buffer.from(fromEnv, 'hex');
    }

    // Même création exclusive que pour le token d'API : si deux process
    // démarrent en parallèle, le second relit la clé du premier au lieu de
    // l'écraser — écraser la clé rendrait tous les secrets illisibles.
    const generated = crypto.randomBytes(32).toString('hex');
    try {
        fs.mkdirSync(path.dirname(keyFilePath), { recursive: true });
        fs.writeFileSync(keyFilePath, generated, { encoding: 'utf8', flag: 'wx', mode: 0o600 });
        return Buffer.from(generated, 'hex');
    } catch (err) {
        if (err.code !== 'EEXIST') throw err;
        return Buffer.from(fs.readFileSync(keyFilePath, 'utf8').trim(), 'hex');
    }
}

const MASTER_KEY = loadOrCreateMasterKey();

function isEncrypted(value) {
    return typeof value === 'string' && value.startsWith(PREFIX);
}

/** Chiffre une valeur. Les chaînes vides restent vides (absence de secret). */
function encrypt(plaintext) {
    if (plaintext === null || plaintext === undefined || plaintext === '') return '';
    if (isEncrypted(plaintext)) return plaintext; // déjà chiffrée, ne pas empiler

    const iv = crypto.randomBytes(IV_BYTES);
    const cipher = crypto.createCipheriv('aes-256-gcm', MASTER_KEY, iv);
    const ciphertext = Buffer.concat([cipher.update(String(plaintext), 'utf8'), cipher.final()]);
    const tag = cipher.getAuthTag();

    return PREFIX + Buffer.concat([iv, tag, ciphertext]).toString('base64');
}

/**
 * Déchiffre une valeur. Une valeur non préfixée est renvoyée telle quelle : les
 * bases antérieures à cette version contiennent du texte clair, et la migration
 * les rattrape au démarrage.
 *
 * En cas d'échec (clé maître perdue ou changée), on renvoie une chaîne vide
 * plutôt que de propager l'exception : l'utilisateur voit un champ vide à
 * ressaisir au lieu d'une application qui refuse de démarrer.
 */
function decrypt(value) {
    if (!isEncrypted(value)) return value;

    try {
        const raw = Buffer.from(value.slice(PREFIX.length), 'base64');
        const iv = raw.subarray(0, IV_BYTES);
        const tag = raw.subarray(IV_BYTES, IV_BYTES + TAG_BYTES);
        const ciphertext = raw.subarray(IV_BYTES + TAG_BYTES);

        const decipher = crypto.createDecipheriv('aes-256-gcm', MASTER_KEY, iv);
        decipher.setAuthTag(tag);
        return Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString('utf8');
    } catch (err) {
        console.error('[SecretStore] Déchiffrement impossible (clé maître absente ou modifiée) :', err.message);
        return '';
    }
}

module.exports = { encrypt, decrypt, isEncrypted, keyFilePath, PREFIX };
