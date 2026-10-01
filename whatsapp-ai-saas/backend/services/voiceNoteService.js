/**
 * Extraction des notes vocales WhatsApp (messages de type `ptt`).
 *
 * TOUT CE QUI SUIT EST MESURÉ, pas déduit — relevé le 19 septembre 2026 sur une
 * instance réelle (Chromium 146, WhatsApp Web), avec `backend/diagnostics/waVoiceProbe.cjs` :
 *
 *   - Un vocal ne porte PAS `.copyable-text[data-pre-plain-text]`.
 *
 *     CORRIGÉ le 1er octobre 2026 : on en avait conclu que l'observateur de
 *     commandes ne voyait jamais les vocaux. C'était aller plus loin que la
 *     mesure. L'observateur a trois ancrages — ce sélecteur historique, les
 *     `[data-id]` préfixés `true_`/`false_`, et les `div[role="row"]` hors liste
 *     de conversations — et la sonde n'avait testé que le premier. Les deux
 *     autres attrapent vraisemblablement la ligne vocale ; ce qu'il en extrait
 *     comme « texte » n'a pas été mesuré (probablement la durée ou l'heure, que
 *     le filtre par mots-clés rejette). Le résultat net est inchangé — le
 *     contenu du vocal n'atteint jamais la classification — mais le mécanisme
 *     n'est pas l'aveuglement. D'où le choix de détecter le vocal AVANT
 *     l'extraction de texte, dans l'observateur, et de l'aiguiller ici.
 *   - Aucune balise <audio> n'est montée tant que l'utilisateur n'a pas appuyé
 *     sur lecture. Lire un blob depuis le DOM est donc impossible passivement.
 *   - L'ancre stable de la ligne est `[data-testid="ptt-status"]` ; l'identifiant
 *     du message est porté par `[data-testid^="conv-msg-"]`.
 *   - Le modèle de message complet est atteignable depuis le nœud DOM en
 *     remontant la fibre React (`memoizedProps.msg`, 5 niveaux au-dessus), et il
 *     expose `downloadMedia()` ainsi que mediaKey / directPath / encFilehash.
 *   - Après téléchargement, les octets déchiffrés vivent dans
 *     `msg.mediaData.__x_mediaBlob` (une enveloppe dont la clé `blob` porte le
 *     Blob). Relevé : 20 330 octets, `audio/ogg; codecs=opus`, entête « OggS ».
 *
 * POURQUOI PAS UN CLIC — simuler un clic sur « Lire le message vocal » monterait
 * la balise <audio> et donnerait le blob, mais marquerait le vocal comme ÉCOUTÉ
 * chez l'expéditeur. Dans une vraie conversation client, c'est un signal faux
 * envoyé à un tiers. La voie par le modèle évite cet effet de bord.
 *
 * FRAGILITÉ ASSUMÉE — ce code dépend d'internes de WhatsApp Web (clés de fibre
 * React, nom `__x_mediaBlob`). Une refonte côté WhatsApp le cassera. Les échecs
 * sont donc explicites et nommés, jamais silencieux : mieux vaut « je n'ai pas
 * su lire ce vocal » qu'un vocal qui disparaît du flux.
 *
 * CONFIDENTIALITÉ — aucun octet audio ni aucune transcription n'est journalisé.
 */

const puppeteer = require('puppeteer-core');

const CDP_URL = process.env.WACOPILOTE_CDP_URL || 'http://localhost:8315';

/** Au-delà, on renonce : un « vocal » de cette taille n'en est pas un. */
const MAX_VOICE_BYTES = 16 * 1024 * 1024;

/** Temps laissé à WhatsApp pour déchiffrer le média après downloadMedia(). */
const DOWNLOAD_TIMEOUT_MS = 15000;

/**
 * Exécuté dans le contexte de la page WhatsApp.
 * Renvoie l'audio en base64, ou un objet d'erreur nommé — jamais une valeur
 * vide ambiguë.
 */
/* eslint-disable no-undef */
async function extractInPage(messageId, timeoutMs) {
    const rows = Array.from(document.querySelectorAll('div[role="row"]'))
        .filter((r) => r.querySelector('[data-testid="ptt-status"]'));

    if (rows.length === 0) return { ok: false, raison: 'AUCUN_VOCAL_VISIBLE' };

    const row = messageId
        ? rows.find((r) => r.querySelector(`[data-testid="conv-msg-${messageId}"]`))
        : rows[rows.length - 1];

    if (!row) return { ok: false, raison: 'VOCAL_INTROUVABLE' };

    // Remontée de la fibre React jusqu'au modèle de message.
    const fiberKey = Object.keys(row).find((k) => k.startsWith('__reactFiber'));
    if (!fiberKey) return { ok: false, raison: 'FIBRE_REACT_ABSENTE' };

    let msg = null;
    let node = row[fiberKey];
    for (let hops = 0; node && hops < 30; hops++, node = node.return) {
        const props = node.memoizedProps;
        if (props && props.msg && typeof props.msg === 'object' && 'type' in props.msg) {
            msg = props.msg;
            break;
        }
    }
    if (!msg) return { ok: false, raison: 'MODELE_MESSAGE_INTROUVABLE' };
    if (msg.type !== 'ptt') return { ok: false, raison: `TYPE_INATTENDU:${msg.type}` };

    const lireBlob = () => {
        const md = msg.mediaData;
        if (!md) return null;
        const enveloppe = md.mediaBlob ?? md.__x_mediaBlob;
        if (!enveloppe) return null;
        const b = enveloppe.blob ?? enveloppe._blob ?? enveloppe;
        return b && typeof b.arrayBuffer === 'function' ? b : null;
    };

    // Déclenche le téléchargement si les octets ne sont pas déjà là. Sans effet
    // si le média est déjà en cache.
    if (!lireBlob() && typeof msg.downloadMedia === 'function') {
        try {
            await msg.downloadMedia({ downloadEvenIfExpensive: true, rmrReason: 1 });
        } catch (e) {
            return { ok: false, raison: 'TELECHARGEMENT_REFUSE', detail: String(e && e.message) };
        }
    }

    const echeance = Date.now() + timeoutMs;
    let blob = lireBlob();
    while (!blob && Date.now() < echeance) {
        await new Promise((r) => setTimeout(r, 200));
        blob = lireBlob();
    }
    if (!blob) return { ok: false, raison: 'BLOB_INDISPONIBLE_APRES_ATTENTE' };

    const buf = await blob.arrayBuffer();
    const u8 = new Uint8Array(buf);
    let bin = '';
    for (let i = 0; i < u8.length; i++) bin += String.fromCharCode(u8[i]);

    return {
        ok: true,
        base64: btoa(bin),
        bytes: buf.byteLength,
        mimeType: blob.type || msg.mimetype || 'audio/ogg',
        // `duration` est une chaîne côté modèle ; on la normalise ici.
        durationSec: Number(msg.duration) || null,
        messageId: (row.querySelector('[data-testid^="conv-msg-"]')
            ?.getAttribute('data-testid') || '').replace('conv-msg-', '') || null
    };
}
/* eslint-enable no-undef */

/** Retrouve la page de l'instance, comme waInstancesService.openChat. */
async function resolvePage(browser, instanceId) {
    const targets = await browser.targets();
    let fallback = null;
    for (const target of targets) {
        if (target.type() !== 'webview' || !target.url().includes('whatsapp')) continue;
        const p = await target.page();
        if (!p) continue;
        if (!instanceId) return p;
        try {
            // eslint-disable-next-line no-undef
            const id = await p.evaluate(() => window.__whatsapp_instance_id);
            if (id === instanceId) return p;
        } catch { /* frame détachée */ }
        if (!fallback) fallback = p;
    }
    return fallback;
}

const RAISONS = {
    AUCUN_VOCAL_VISIBLE: "Aucune note vocale n'est affichée dans la conversation ouverte.",
    VOCAL_INTROUVABLE: "La note vocale demandée n'est pas affichée à l'écran.",
    FIBRE_REACT_ABSENTE: "Structure interne de WhatsApp Web non reconnue (fibre React absente) — WhatsApp a probablement changé.",
    MODELE_MESSAGE_INTROUVABLE: "Structure interne de WhatsApp Web non reconnue (modèle de message introuvable) — WhatsApp a probablement changé.",
    TELECHARGEMENT_REFUSE: 'WhatsApp a refusé le téléchargement du média.',
    BLOB_INDISPONIBLE_APRES_ATTENTE: "Le média n'a pas été déchiffré dans le délai imparti."
};

/**
 * Extrait un vocal depuis une page déjà connue — le cas de l'observateur de
 * commandes, qui détient la page et n'a pas à rouvrir une connexion CDP.
 *
 * @param {import('puppeteer-core').Page} page
 * @param {string} [messageId] à défaut, le vocal le plus récent affiché
 * @returns {Promise<{ audio: Buffer, mimeType: string, bytes: number, durationSec: number|null, messageId: string|null }>}
 * @throws  avec un message explicite (propriétés `statusCode` et `reason`)
 */
async function extractVoiceNoteFromPage(page, messageId) {
    const res = await page.evaluate(extractInPage, messageId || null, DOWNLOAD_TIMEOUT_MS);

    if (!res.ok) {
        const cle = String(res.raison || '').split(':')[0];
        const e = new Error(RAISONS[cle] || `Extraction impossible (${res.raison}).`);
        e.statusCode = cle === 'AUCUN_VOCAL_VISIBLE' || cle === 'VOCAL_INTROUVABLE' ? 404 : 502;
        e.reason = res.raison;
        throw e;
    }

    if (res.bytes > MAX_VOICE_BYTES) {
        const e = new Error(`Note vocale de ${res.bytes} octets, au-delà de la limite de ${MAX_VOICE_BYTES}.`);
        e.statusCode = 413;
        throw e;
    }

    return {
        audio: Buffer.from(res.base64, 'base64'),
        mimeType: res.mimeType,
        bytes: res.bytes,
        durationSec: res.durationSec,
        messageId: res.messageId
    };
}

/**
 * Récupère les octets d'une note vocale.
 *
 * @param {object} params
 * @param {string} [params.instanceId] instance ciblée ; à défaut, la première trouvée
 * @param {string} [params.messageId]  identifiant du message ; à défaut, le vocal le plus récent
 * @returns {Promise<{ audio: Buffer, mimeType: string, bytes: number, durationSec: number|null, messageId: string|null }>}
 * @throws  avec un message explicite — jamais de retour vide ambigu
 */
async function extractVoiceNote({ instanceId, messageId } = {}) {
    let browser;
    try {
        browser = await puppeteer.connect({ browserURL: CDP_URL, defaultViewport: null });
    } catch (err) {
        const e = new Error(`Navigateur WhatsApp injoignable sur ${CDP_URL} : ${err.message}`);
        e.statusCode = 503;
        throw e;
    }

    try {
        const page = await resolvePage(browser, instanceId);
        if (!page) {
            const e = new Error('Aucune instance WhatsApp connectée.');
            e.statusCode = 404;
            throw e;
        }

        return await extractVoiceNoteFromPage(page, messageId);
    } finally {
        browser.disconnect();
    }
}

module.exports = { extractVoiceNote, extractVoiceNoteFromPage, MAX_VOICE_BYTES, DOWNLOAD_TIMEOUT_MS };
