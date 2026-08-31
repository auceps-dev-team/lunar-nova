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

// C7 : traçabilité de la GÉNÉRATION d'une nouvelle clé maître (dernier repli
// de loadOrCreateMasterKey, appelé au chargement du module — d'où la
// déclaration ici, avant tout appel). C'est l'événement qui rend silencieusement
// illisibles tous les secrets chiffrés existants ; sans trace, sa cause
// (dossier de données perdu, helper de déchiffrement trop lent, changement de
// machine) restait indiagnosticable a posteriori.
let masterKeyGeneratedAt = null;
let masterKeyGeneratedReason = null;

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
                // Helper écrit dans le répertoire temporaire système : en build
                // packagé, backend/ vit dans app.asar (lecture seule) et toute
                // écriture dans __dirname échouait silencieusement — le canal de
                // déchiffrement CLI/MCP était inopérant. Exécuté PAR le binaire
                // Electron, le script résout `require('electron')` comme module
                // natif : son emplacement est sans effet sur la résolution.
                const os = require('os');
                const helperScript = path.join(os.tmpdir(), `wacopilote-key-${process.pid}.cjs`);
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
                        // 15 s (C2) : au démarrage à froid (antivirus Windows,
                        // disque saturé), le binaire Electron peut dépasser les
                        // 5 s initiales. Un timeout trop court laissait le
                        // déchiffrement échouer silencieusement, puis la clé
                        // maître était RÉGÉNÉRÉE au repli — rendant tous les
                        // secrets existants illisibles (« Unsupported state or
                        // unable to authenticate data »). 15 s de pire cas au
                        // démarrage valent mieux qu'une base de secrets perdue.
                        timeout: 15000,
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
        } catch {
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
    // C7 : trace horodatée + motif — une régénération rend illisibles tous les
    // secrets chiffrés existants ; sans cette trace, la cause (clé .enc perdue,
    // helper safeStorage trop lent, répertoire de données changé) était
    // invisible jusqu'au constat « Unsupported state or unable to
    // authenticate data » côté decrypt().
    masterKeyGeneratedAt = new Date().toISOString();
    masterKeyGeneratedReason = 'aucune clé maître résoluble : WACOPILOTE_MASTER_KEY absente, master-key.enc absent ou indéchiffrable, master-key absent du répertoire de données et du dossier projet';
    console.error(`[SecretStore] ${masterKeyGeneratedAt} — NOUVELLE clé maître générée dans '${plainPath}' (${masterKeyGeneratedReason}). Si des secrets chiffrés existent en base, ils seront illisibles jusqu'à leur ressaisie (ils seront alors rechiffrés avec cette clé).`);
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
// C4 : une fois qu'un déchiffrement a échoué dans ce processus, la clé maître
// résolue ne correspond plus aux secrets stockés — c'est structurel (la clé
// est fixée au chargement du module), pas ponctuel. L'état est donc mémorisé
// et exposé à l'UI via GET /api/settings/channels-status pour afficher une
// bannière invitant à ressaisir les clés, au lieu du symptôme trompeur
// « champ vide / clé non configurée ».
let decryptionDegraded = false;
let decryptionFailedAt = null;

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
        decryptionDegraded = true;
        decryptionFailedAt = decryptionFailedAt || new Date().toISOString();
        return '';
    }
}

/**
 * État de dégradation du déchiffrement pour CE processus (C4).
 * `degraded` passe à true dès qu'une valeur `enc:v1:` n'a pas pu être
 * déchiffrée ; l'horodatage conserve la première occurrence.
 * `generatedAt`/`generatedReason` (C7) sont renseignés si CE processus a dû
 * générer une nouvelle clé maître — l'événement amont qui explique une
 * dégradation ultérieure.
 */
function getDecryptionStatus() {
    return {
        degraded: decryptionDegraded,
        failedAt: decryptionFailedAt,
        generatedAt: masterKeyGeneratedAt,
        generatedReason: masterKeyGeneratedReason
    };
}

module.exports = { encrypt, decrypt, isEncrypted, keyFilePath, PREFIX, resolveUserDataDir, getDecryptionStatus };
