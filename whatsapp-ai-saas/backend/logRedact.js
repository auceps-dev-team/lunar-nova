/**
 * Masquage des données clients dans les journaux.
 *
 * Le moteur de détection de commandes journalisait le texte intégral des
 * messages WhatsApp et le nom des contacts. Ces traces atterrissent dans
 * `backend_out.log`, un fichier que le gabarit de signalement de bug demande
 * justement aux utilisateurs de joindre à leurs issues — publiques. Le contenu
 * des conversations de leurs clients s'y retrouvait donc en clair.
 *
 * Les journaux restent indispensables : les sélecteurs de WhatsApp Web changent
 * à chaque refonte et le diagnostic passe par là. Ce qu'on retire, c'est le
 * contenu, pas l'information de flux — on conserve la longueur du message, ce
 * qui suffit à savoir qu'un message a bien été capté et à repérer une extraction
 * tronquée.
 *
 * Pour diagnostiquer un cas précis, relancer le backend avec
 * WACOPILOTE_LOG_MESSAGES=1 rétablit les traces complètes.
 */

const VERBOSE = process.env.WACOPILOTE_LOG_MESSAGES === '1';

/** Remplace le texte d'un message par sa seule longueur. */
function redactMessage(text) {
    if (VERBOSE) return text;
    if (text === null || text === undefined || text === '') return '(vide)';
    return `(${String(text).length} car., masqué)`;
}

/** Ne conserve que l'initiale du nom d'un contact. */
function redactContact(name) {
    if (VERBOSE) return name;
    const s = String(name ?? '').trim();
    if (!s) return '(inconnu)';
    if (s.length === 1) return '*';
    return s[0] + '*'.repeat(Math.min(s.length - 1, 5));
}

module.exports = { redactMessage, redactContact, VERBOSE };
