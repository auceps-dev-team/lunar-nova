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

function resolveUserDataDir() {
    if (process.env.USER_DATA_PATH) {
        return process.env.USER_DATA_PATH;
    }
    if (process.env.WACOPILOTE_LOCAL_DB === '1' || process.env.NODE_ENV === 'test') {
        return path.join(__dirname, '..');
    }
    const appData = process.env.APPDATA || (
        process.platform === 'darwin'
            ? path.join(process.env.HOME || '', 'Library', 'Application Support')
            : path.join(process.env.XDG_CONFIG_HOME || path.join(process.env.HOME || '', '.config'))
    );
    if (appData) {
        const appDir = path.join(appData, 'WaCopilote');
        const dbCandidate = path.join(appDir, 'database.sqlite');
        if (fs.existsSync(dbCandidate)) {
            return appDir;
        }
    }
    return path.join(__dirname, '..');
}

const keyFilePath = path.join(resolveUserDataDir(), 'master-key');

function loadOrCreateMasterKey() {
    const fromEnv = process.env.WACOPILOTE_MASTER_KEY;
    if (fromEnv && /^[0-9a-f]{64}$/i.test(fromEnv)) {
        return Buffer.from(fromEnv, 'hex');
    }

    const baseDir = resolveUserDataDir();
    const sealedPath = path.join(baseDir, 'master-key.enc');
    const plainPath = path.join(baseDir, 'master-key');

    // 1. Si master-key.enc existe (dossier Electron production), déchiffrer via electron safeStorage helper
    if (fs.existsSync(sealedPath)) {
        try {
            const electronBinary = require('electron');
            if (electronBinary && typeof electronBinary === 'string' && fs.existsSync(electronBinary)) {
                const helperScript = path.join(__dirname, '.temp_electron_key.cjs');
                fs.writeFileSync(helperScript, `
const { app, safeStorage } = require('electron');
const fs = require('fs');
app.setPath('userData', process.argv[3]);
app.whenReady().then(() => {
    try {
        if (safeStorage.isEncryptionAvailable() && fs.existsSync(process.argv[2])) {
            process.stdout.write(safeStorage.decryptString(fs.readFileSync(process.argv[2])));
        }
    } catch (e) {}
    app.quit();
});
`, 'utf8');
                try {
                    const { execFileSync } = require('child_process');
                    const out = execFileSync(electronBinary, [helperScript, sealedPath, baseDir], {
                        encoding: 'utf8',
                        timeout: 5000,
                        windowsHide: true,
                        stdio: ['ignore', 'pipe', 'ignore']
                    }).trim();
                    if (/^[0-9a-f]{64}$/i.test(out)) {
                        return Buffer.from(out, 'hex');
                    }
                } finally {
                    if (fs.existsSync(helperScript)) {
                        try { fs.unlinkSync(helperScript); } catch {}
                    }
                }
            }
        } catch (e) {
            // Repli gracieux
        }
    }

    // 2. Si master-key en clair existe dans le dossier cible
    if (fs.existsSync(plainPath)) {
        try {
            const content = fs.readFileSync(plainPath, 'utf8').trim();
            if (/^[0-9a-f]{64}$/i.test(content)) {
                return Buffer.from(content, 'hex');
            }
        } catch {}
    }

    // 3. Repli sur le fichier master-key du projet s'il existe
    const workspacePlain = path.join(__dirname, '..', 'master-key');
    if (fs.existsSync(workspacePlain)) {
        try {
            const content = fs.readFileSync(workspacePlain, 'utf8').trim();
            if (/^[0-9a-f]{64}$/i.test(content)) {
                return Buffer.from(content, 'hex');
            }
        } catch {}
    }

    // 4. Génération d'une nouvelle clé si rien n'existe
    const generated = crypto.randomBytes(32).toString('hex');
    try {
        fs.mkdirSync(path.dirname(plainPath), { recursive: true });
        fs.writeFileSync(plainPath, generated, { encoding: 'utf8', flag: 'wx', mode: 0o600 });
        return Buffer.from(generated, 'hex');
    } catch (err) {
        if (err.code !== 'EEXIST') throw err;
        return Buffer.from(fs.readFileSync(plainPath, 'utf8').trim(), 'hex');
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

let hasWarnedDecryptionFailure = false;

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
        if (!hasWarnedDecryptionFailure) {
            console.error('[SecretStore] Déchiffrement impossible (clé maître absente ou modifiée) :', err.message);
            hasWarnedDecryptionFailure = true;
        }
        return '';
    }
}

module.exports = { encrypt, decrypt, isEncrypted, keyFilePath, PREFIX, resolveUserDataDir };
