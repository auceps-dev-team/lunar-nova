/**
 * Logique pure de mise à jour — extraite de electron/updater.cjs pour être
 * testable unitairement (sans dépendance à Electron).
 */
const crypto = require('crypto');
const fs = require('fs');
const { Transform } = require('stream');
const { pipeline } = require('stream/promises');

/**
 * Compare deux versions sémantiques « x.y.z ». Retire un préfixe 'v' éventuel
 * et n'extrait que la partie numérique pure (les suffixes de pré-release
 * « 1.42.11-beta.1 » sont ignorés → comparés comme « 1.42.11 »).
 * @returns {number} 1 si v1 > v2, -1 si v1 < v2, 0 si égales.
 */
function compareVersions(v1, v2) {
    const extract = (v) => {
        const cleaned = String(v).replace(/^v/i, '').match(/\d+(?:\.\d+)*/);
        return (cleaned ? cleaned[0] : '0').split('.').map(n => parseInt(n, 10) || 0);
    };
    const p1 = extract(v1);
    const p2 = extract(v2);
    for (let i = 0; i < Math.max(p1.length, p2.length); i++) {
        const n1 = p1[i] || 0;
        const n2 = p2[i] || 0;
        if (n1 > n2) return 1;
        if (n1 < n2) return -1;
    }
    return 0;
}

/**
 * Normalise le tag d'une release GitHub (« v1.2.3 » → « 1.2.3 »).
 * Ne retire que le préfixe 'v' — l'ancien replace('v','') retirait tous les 'v'.
 */
function parseReleaseTag(tag) {
    return String(tag || '').replace(/^v/i, '');
}

/**
 * Sélectionne l'asset de mise à jour correspondant à la plateforme courante.
 *
 * Windows : l'installeur NSIS, et lui seul — son nom suit l'artifactName de
 * package.json (« ${productName}_Setup.${ext} »). Mesuré le 26/11/2026 : la
 * release v1.49.0 portait deux .exe, l'installeur Inno Setup EN PREMIER
 * (« WaCopilote.1.49.0.exe »), puis le NSIS. L'ancienne règle « premier .exe »
 * prenait l'Inno et le lançait avec /S, l'option silencieuse de NSIS. Un .exe
 * qui n'est pas l'installeur NSIS n'est plus jamais retenu.
 *
 * macOS et Linux reçoivent l'artefact adapté (.dmg/.zip et .AppImage/.deb) et
 * l'ouvrent pour installation manuelle guidée.
 */
const NSIS_INSTALLER = /_Setup\.exe$/i;

function pickAssetForPlatform(assets, platform = process.platform) {
    const named = (assets || []).filter((a) => a && a.name);
    if (platform === 'win32') {
        const found = named.find((a) => NSIS_INSTALLER.test(a.name));
        return { asset: found || null, platform };
    }
    const patterns = {
        darwin: ['.dmg', '.zip'],
        linux: ['.AppImage', '.appimage', '.deb'],
    };
    for (const ext of patterns[platform] || []) {
        const found = named.find((a) => a.name.toLowerCase().endsWith(ext.toLowerCase()));
        if (found) return { asset: found, platform };
    }
    return { asset: null, platform };
}

/**
 * Empreinte publiée par GitHub pour un asset (« sha256:<hex> », champ
 * `digest` de l'API des releases — relevé le 26/11/2026 sur la v1.49.0).
 * @returns {string|null} l'empreinte SHA-256 en hexadécimal minuscule, ou null.
 */
function parseSha256Digest(digest) {
    const m = /^sha256:([0-9a-f]{64})$/i.exec(String(digest || '').trim());
    return m ? m[1].toLowerCase() : null;
}

/**
 * Écrit un flux téléchargé dans `dest`, en calculant son empreinte au passage,
 * puis vérifie taille et SHA-256. Toute erreur — flux coupé, taille ou
 * empreinte différente — supprime le fichier et LÈVE : l'appelant ne reçoit
 * jamais un installeur douteux.
 *
 * Remplace un défaut de updater.cjs : la promesse du téléchargement était
 * rendue hors du try/catch, si bien qu'un flux interrompu rejetait jusqu'au
 * renderer sans réponse — l'écran restait sur « Téléchargement… » et le
 * fichier partiel n'était jamais effacé.
 *
 * @param {{ data: import('stream').Readable, headers?: object }} response
 * @param {{ dest: string, expectedSize?: number, expectedSha256?: string|null,
 *           onProgress?: (percent: number) => void }} options
 * @returns {Promise<{ bytes: number, sha256: string }>}
 */
async function downloadVerified(response, { dest, expectedSize = null, expectedSha256 = null, onProgress } = {}) {
    const announced = parseInt(response.headers && response.headers['content-length'], 10);
    const total = expectedSize || (announced > 0 ? announced : null);
    const hash = crypto.createHash('sha256');
    let bytes = 0;
    let lastPercent = -1;

    const tap = new Transform({
        transform(chunk, _enc, callback) {
            bytes += chunk.length;
            hash.update(chunk);
            if (onProgress && total) {
                const percent = Math.min(100, Math.round((bytes / total) * 100));
                if (percent > lastPercent) { lastPercent = percent; onProgress(percent); }
            }
            callback(null, chunk);
        }
    });

    try {
        await pipeline(response.data, tap, fs.createWriteStream(dest));
        if (total && bytes !== total) {
            throw new Error(`Téléchargement incomplet (${bytes}/${total} octets).`);
        }
        const sha256 = hash.digest('hex');
        if (expectedSha256 && sha256 !== expectedSha256) {
            throw new Error("Empreinte SHA-256 différente de celle publiée : le fichier téléchargé n'est pas l'installeur attendu.");
        }
        return { bytes, sha256 };
    } catch (err) {
        try { if (fs.existsSync(dest)) fs.unlinkSync(dest); } catch { /* best effort */ }
        throw err;
    }
}

module.exports = { compareVersions, parseReleaseTag, pickAssetForPlatform, parseSha256Digest, downloadVerified, NSIS_INSTALLER };
