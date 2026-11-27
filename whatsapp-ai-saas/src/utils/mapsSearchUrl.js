/**
 * Adresse Google Maps affichée dans la carte de la prospection.
 *
 * Depuis le 27/11/2026, la carte n'utilise plus l'API Maps Embed, et donc plus
 * de clé : elle affiche directement google.com/maps dans une webview. La
 * recherche est composée comme celle de l'extracteur
 * (backend/scrapers/googleMapScraper.js : la requête, puis la zone, sur
 * /maps/search/), pour que la carte montre ce qui sera extrait.
 */

/** En deçà, aucune carte : une ou deux lettres ne désignent rien. */
export const MAPS_MIN_QUERY = 3;

/**
 * @param {string} query activité recherchée (« pharmacie »)
 * @param {string} [zone] lieu (« Yopougon »)
 * @param {string} [langue] langue de l'interface (« fr », « en-US »…) — paramètre hl
 * @returns {string|null} l'adresse, ou null si la recherche est trop courte.
 */
export function mapsSearchUrl(query, zone, langue) {
    const texte = [query, zone].map((s) => String(s || '').trim()).filter(Boolean).join(' ');
    if (texte.length < MAPS_MIN_QUERY) return null;
    const hl = String(langue || '').toLowerCase().split(/[-_]/)[0] || 'fr';
    return `https://www.google.com/maps/search/${encodeURIComponent(texte)}?hl=${encodeURIComponent(hl)}`;
}
