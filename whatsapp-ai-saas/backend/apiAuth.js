const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

// Le token vit à côté de la base SQLite : userData en production (fork depuis
// main.cjs), racine du projet en développement — exactement la même convention
// que db.js, pour que le process Electron et le backend résolvent le même chemin.
const userDataPath = process.env.USER_DATA_PATH;
const tokenFilePath = userDataPath
    ? path.join(userDataPath, 'api-token')
    : path.join(__dirname, '..', 'api-token');

/**
 * Charge le token partagé, ou le crée s'il n'existe pas encore.
 *
 * En développement (`start:all`) le backend et Electron démarrent en parallèle et
 * peuvent tous deux tenter la création : le flag 'wx' rend l'écriture exclusive,
 * donc le perdant reçoit EEXIST et relit la valeur du gagnant. Les deux process
 * convergent sur le même token sans verrou externe.
 */
function loadOrCreateToken() {
    const token = crypto.randomBytes(32).toString('hex');
    try {
        fs.mkdirSync(path.dirname(tokenFilePath), { recursive: true });
        fs.writeFileSync(tokenFilePath, token, { encoding: 'utf8', flag: 'wx', mode: 0o600 });
        return token;
    } catch (err) {
        if (err.code !== 'EEXIST') throw err;
        return fs.readFileSync(tokenFilePath, 'utf8').trim();
    }
}

const API_TOKEN = loadOrCreateToken();

// Comparaison à temps constant. On hache d'abord : timingSafeEqual exige deux
// buffers de même longueur et lèverait sur un token tronqué.
const expectedDigest = crypto.createHash('sha256').update(API_TOKEN).digest();

function isValidToken(provided) {
    if (typeof provided !== 'string' || provided.length === 0) return false;
    const providedDigest = crypto.createHash('sha256').update(provided).digest();
    return crypto.timingSafeEqual(providedDigest, expectedDigest);
}

/**
 * Les flux SSE sont consommés via `EventSource`, qui ne permet pas de poser
 * d'en-tête. Ces routes-là (et elles seules) acceptent `?token=` en query.
 * Le token ne quitte jamais la boucle locale : le serveur n'écoute que sur
 * 127.0.0.1 et aucune de ces URL n'est envoyée à un tiers.
 */
const SSE_PATHS = [/^\/api\/orders\/stream\//];

/**
 * Routes nécessairement publiques.
 *
 * Le callback OAuth Google est ouvert par le navigateur externe de l'utilisateur
 * après redirection depuis Google : cette requête ne peut pas porter le token.
 * C'est le fonctionnement normal d'un flux loopback — la protection y repose sur
 * le paramètre `state` et sur le code d'autorisation à usage unique, pas sur le
 * token local. `/status`, lui, est appelé par l'app et reste protégé.
 */
const PUBLIC_PATHS = [/^\/api\/auth\/google\/callback$/];

function requireApiToken(req, res, next) {
    if (PUBLIC_PATHS.some((re) => re.test(req.path))) return next();

    const header = req.get('authorization') || '';
    let provided = header.startsWith('Bearer ') ? header.slice(7).trim() : '';

    if (!provided && SSE_PATHS.some((re) => re.test(req.path))) {
        provided = typeof req.query.token === 'string' ? req.query.token : '';
    }

    if (isValidToken(provided)) return next();

    res.status(401).json({ error: 'Unauthorized: missing or invalid API token.' });
}

module.exports = { API_TOKEN, requireApiToken, tokenFilePath };
