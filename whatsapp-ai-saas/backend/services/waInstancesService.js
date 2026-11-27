const fs = require('fs');
const path = require('path');
const { pool } = require('../db');
const { isValidPhoneFormat } = require('./contactAgent');
const { getWaDriver, isBackendProcess } = require('../wa/waDriver');

// Mutex local au process : protège les navigations concurrentes de webview
// lancées par CE process (Express ou CLI). Un CLI et le serveur Express
// tournant dans deux process séparés ne peuvent pas se coordonner via un
// mutex en mémoire — limitation acceptée, cohérente avec le fait que ces
// deux usages sont rarement simultanés en pratique.
const mutexQueue = [];
let mutexLocked = false;
const acquireMutex = () => new Promise((resolve) => {
    if (!mutexLocked) { mutexLocked = true; resolve(); }
    else mutexQueue.push(resolve);
});
const releaseMutex = () => {
    if (mutexQueue.length > 0) mutexQueue.shift()();
    else mutexLocked = false;
};

async function listInstances() {
    const result = await pool.query('SELECT * FROM wa_instances ORDER BY last_seen_at DESC');
    return result.rows;
}

/**
 * Enregistre/rafraîchit une instance. Appelé en write-through par le renderer
 * (src/App.jsx, OnboardingModal.jsx) à la création/suppression d'une instance,
 * pour que la table reflète l'état réel du store Zustand côté UI.
 */
async function upsertInstance(id, name, status = 'offline') {
    // Le shim SQLite (backend/db.js) convertit chaque $N en '?' positionnel
    // indépendamment : réutiliser $2/$3 (valide en Postgres) désaligne les
    // valeurs liées dès qu'un placeholder apparaît plus d'une fois. Chaque
    // paramètre a donc son propre numéro, y compris répété dans le tableau.
    const finalName = name || id;
    const result = await pool.query(
        `INSERT INTO wa_instances (id, name, status, last_seen_at)
         VALUES ($1, $2, $3, CURRENT_TIMESTAMP)
         ON CONFLICT (id) DO UPDATE SET name = $4, status = $5, last_seen_at = CURRENT_TIMESTAMP
         RETURNING *`,
        [id, finalName, status, finalName, status]
    );
    return result.rows[0];
}

async function removeInstance(id) {
    await pool.query('DELETE FROM wa_instances WHERE id = $1', [id]);
    return { success: true };
}

/** Jeton de l'API locale de l'application en cours d'exécution, ou null. */
function lireJetonApi() {
    const { resolveUserDataDir } = require('../secretStore');
    const dossiers = [process.env.USER_DATA_PATH, resolveUserDataDir(), path.join(__dirname, '..', '..')].filter(Boolean);
    for (const dossier of dossiers) {
        try {
            const jeton = fs.readFileSync(path.join(dossier, 'api-token'), 'utf8').trim();
            if (jeton) return jeton;
        } catch { /* dossier suivant */ }
    }
    return null;
}

const DELAI_API_LOCALE_MS = 60000;

/**
 * POST JSON vers l'API locale, par node:http et sans agent (aucune connexion
 * gardée ouverte). Pas `fetch` : le CLI appelle process.exit() juste après, et
 * sous Windows cette sortie plantait (« Assertion failed: !(handle->flags &
 * UV_HANDLE_CLOSING), file src\win\async.c, line 94 », code 3221226505).
 *
 * Mesuré le 27/11/2026, application v1.52.0 ouverte, Node 24.16.0, 4 essais par
 * variante : fetch → 4 plantages, base SQLite ouverte ou non ; node:http sans
 * agent → 4 sorties propres ; fetch sous --liftoff-only (ligne de commande) →
 * 4 sorties propres. Cause probable, non démontrée : une tâche de V8 en
 * arrière-plan achevée pendant la destruction de l'environnement. Non reproduit
 * contre un faux serveur minimal, reproduit contre le backend lancé seul. La
 * sortie du CLI est désormais naturelle (bin/wacopilote.cjs, terminer) ; ce
 * client reste en node:http, sans connexion gardée ouverte.
 */
function posterJson(url, jeton, corps) {
    const cible = new URL(url);
    const client = cible.protocol === 'https:' ? require('https') : require('http');
    const donnees = JSON.stringify(corps);
    return new Promise((resolve, reject) => {
        const req = client.request({
            hostname: cible.hostname.replace(/^\[|\]$/g, ''),
            port: cible.port || undefined,
            path: `${cible.pathname}${cible.search}`,
            method: 'POST',
            agent: false,
            headers: {
                Authorization: `Bearer ${jeton}`,
                'Content-Type': 'application/json',
                'Content-Length': Buffer.byteLength(donnees),
            },
        }, (res) => {
            let texte = '';
            res.setEncoding('utf8');
            res.on('data', (morceau) => { texte += morceau; });
            res.on('end', () => resolve({ statut: res.statusCode, texte }));
            res.on('error', reject);
        });
        req.setTimeout(DELAI_API_LOCALE_MS, () => req.destroy(new Error(`pas de réponse en ${DELAI_API_LOCALE_MS / 1000} s`)));
        req.on('error', reject);
        req.end(donnees);
    });
}

/**
 * CLI et MCP : ils tournent hors de l'application et n'ont plus d'accès direct
 * aux webviews (le port de débogage 8315 est fermé depuis la v1.52.0). Ils
 * demandent l'ouverture au backend de l'application, par son API authentifiée.
 */
async function openChatViaBackend({ instanceId, phone, contactId, countryCode, text }) {
    const jeton = lireJetonApi();
    const base = process.env.WACOPILOTE_API_URL || `http://127.0.0.1:${process.env.PORT || 3000}`;
    const echec = (message, statusCode) => Object.assign(new Error(message), { statusCode });
    if (!jeton) throw echec('Jeton de l\'API locale introuvable : WaCopilote doit être ouvert pour piloter WhatsApp.', 503);

    let reponse;
    try {
        reponse = await posterJson(`${base}/api/wa/open-chat`, jeton,
            { instance_id: instanceId, phone, contact_id: contactId, country_code: countryCode, text });
    } catch (e) {
        throw echec(`WaCopilote injoignable sur ${base} (${e.message}) : l'application est-elle ouverte ?`, 503);
    }
    let corps = {};
    try { corps = JSON.parse(reponse.texte); } catch { /* réponse non JSON */ }
    if (reponse.statut < 200 || reponse.statut >= 300) {
        throw echec(corps.error || `Réponse HTTP ${reponse.statut} de l'application`, reponse.statut);
    }
    return { message: corps.message, formattedMessage: corps.formattedMessage };
}

/**
 * Ouvre une conversation WhatsApp sur une instance déjà authentifiée.
 *
 * Dans le backend : par le pilote WhatsApp (wa/waDriver.js, canal privé en
 * production). Ailleurs (CLI, MCP) : par l'API du backend, qui fait tout —
 * formatage, journal et ouverture — une seule fois.
 */
async function openChat({ instanceId, phone, contactId, countryCode, text }) {
    if (!instanceId || !phone) {
        const err = new Error('instanceId et phone sont obligatoires.');
        err.statusCode = 400;
        throw err;
    }
    if (!isValidPhoneFormat(phone)) {
        const err = new Error('Numéro de téléphone invalide (8 à 15 chiffres attendus).');
        err.statusCode = 400;
        throw err;
    }

    if (!isBackendProcess()) {
        return openChatViaBackend({ instanceId, phone, contactId, countryCode, text });
    }

    let formattedMessage = text || '';

    if (contactId && !text) {
        try {
            const contactRes = await pool.query('SELECT * FROM wa_contacts WHERE id = $1', [contactId]);
            const settingsRes = await pool.query("SELECT setting_value FROM app_settings WHERE setting_key = 'dynamic_message_template'");
            if (contactRes.rows.length > 0 && settingsRes.rows.length > 0) {
                const contact = contactRes.rows[0];
                const template = settingsRes.rows[0].setting_value;
                if (template) {
                    formattedMessage = template
                        .replace(/\[Nom\]/gi, contact.name || '')
                        .replace(/\[Email\]/gi, contact.email || '')
                        .replace(/\[Adresse\]/gi, contact.address || '');
                }
            }
        } catch (dbErr) {
            console.error('[WaInstancesService] Erreur formatage du template:', dbErr);
        }
    }

    if (contactId) {
        try {
            await pool.query(
                'INSERT INTO wa_message_logs (contact_id, message) VALUES ($1, $2)',
                [contactId, formattedMessage || 'Direct link manually opened']
            );
        } catch (logErr) {
            console.error('[WaInstancesService] Erreur silencieuse de log de message:', logErr);
        }
    }

    try {
        await acquireMutex();
        const [targetPage] = await getWaDriver().findPages(instanceId);

        if (!targetPage) {
            const err = new Error('WhatsApp instance not found or not ready.');
            err.statusCode = 404;
            throw err;
        }

        const hasInternationalPrefix = /^\s*\+/.test(phone);
        let cleanPhone = phone.replace(/[^0-9]/g, '');
        if (!hasInternationalPrefix && countryCode && countryCode !== 'none' && !cleanPhone.startsWith(countryCode)) {
            cleanPhone = countryCode + cleanPhone;
        }
        let url = `https://web.whatsapp.com/send?phone=${cleanPhone}`;
        if (formattedMessage) {
            url += `&text=${encodeURIComponent(formattedMessage)}`;
        }
        await targetPage.goto(url);

        return { message: 'Chat opened', formattedMessage };
    } catch (err) {
        if (!err.statusCode) {
            const wrapped = new Error(err.message);
            wrapped.statusCode = 502;
            throw wrapped;
        }
        throw err;
    } finally {
        releaseMutex();
    }
}

module.exports = { listInstances, upsertInstance, removeInstance, openChat };
