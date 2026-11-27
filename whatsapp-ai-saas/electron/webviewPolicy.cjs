/**
 * Webviews autorisées à s'attacher à la fenêtre principale (will-attach-webview).
 *
 * Seules deux pages ont le droit d'être ouvertes dans une webview, sans
 * preload ni Node : un renderer compromis ne peut pas y attacher une page de
 * son choix (correctif S7, PR #8).
 *
 *   - WhatsApp Web (https://web.whatsapp.com), dans la partition de son instance ;
 *   - la carte de la prospection, depuis la v1.51.2 : Google Maps sans clé
 *     (src/components/ProspectionMap.jsx). Condition ÉTROITE : origine
 *     https://www.google.com, chemin /maps, ET partition « persist:google-maps »
 *     — ses cookies Google restent séparés de ceux des instances WhatsApp, et
 *     aucune autre page Google ne passe.
 */
const WHATSAPP_ORIGIN = 'https://web.whatsapp.com';
const MAPS_ORIGIN = 'https://www.google.com';
const MAPS_PARTITION = 'persist:google-maps';

/**
 * @param {string} src adresse demandée par la webview
 * @param {string} [partition] attribut partition de la webview
 * @returns {'whatsapp'|'maps'|null} le type autorisé, ou null (refus).
 */
function webviewKind(src, partition) {
    let url;
    try { url = new URL(src); } catch { return null; }
    if (url.origin === WHATSAPP_ORIGIN) return partition === MAPS_PARTITION ? null : 'whatsapp';
    const cheminCarte = url.pathname === '/maps' || url.pathname.startsWith('/maps/');
    if (url.origin === MAPS_ORIGIN && cheminCarte && partition === MAPS_PARTITION) return 'maps';
    return null;
}

module.exports = { webviewKind, MAPS_PARTITION, WHATSAPP_ORIGIN, MAPS_ORIGIN };
