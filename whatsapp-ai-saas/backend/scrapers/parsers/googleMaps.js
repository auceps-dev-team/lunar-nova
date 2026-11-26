/**
 * Parseur des fiches Google Maps (pages /maps/place/…), extrait du scraper —
 * constat R2 de l'audit du 29/09/2026, dans la lignée de parsers/annuaireCi.js
 * et parsers/goAfrica.js : la fonction est auto-portante (uniquement
 * `document`) pour être sérialisée par Playwright ET appelée telle quelle dans
 * les tests sur un document jsdom.
 *
 * Auparavant, chaque champ coûtait une cascade d'allers-retours Playwright
 * (`page.$`, puis `innerText`, puis `getAttribute`, sélecteur par sélecteur),
 * impossible à tester sans navigateur. L'extraction se fait désormais en un
 * seul `page.evaluate`, avec exactement les mêmes sélecteurs dans le même ordre.
 *
 * INNERTEXT, PAS TEXTCONTENT — à l'inverse des deux autres parseurs. Le scraper
 * lisait `innerText`, et passer à `textContent` pourrait remonter du texte
 * masqué (glyphes d'icônes, libellés d'accessibilité) sur des pages que l'on
 * n'a pas pu observer en direct pour ce changement. On garde donc `innerText`
 * quand le navigateur le fournit — en production rien ne change — et
 * `textContent` seulement à défaut, c'est-à-dire sous jsdom qui n'implémente
 * pas `innerText`.
 */

/**
 * @returns {{ name: string, phone: string, website: string, address: string }}
 *          `phone` est réduit aux chiffres et au « + » ; `name` vide signale
 *          une page qui n'est pas une fiche exploitable.
 */
function extractPlaceDetails() {
    const text = (el) => {
        if (!el) return '';
        const t = typeof el.innerText === 'string' ? el.innerText : el.textContent;
        return (t || '').trim();
    };

    const name = text(document.querySelector('h1'));

    let phone = '';
    for (const sel of [
        'button[data-item-id^="phone:tel:"]',
        'a[data-item-id^="phone:tel:"]',
        'button[aria-label*="Téléphone"]',
        'button[aria-label*="Phone"]',
        '[data-tooltip="Copier le numéro de téléphone"]'
    ]) {
        const el = document.querySelector(sel);
        if (!el) continue;
        const t = text(el);
        if (t) { phone = t; break; }
        const ariaLabel = el.getAttribute('aria-label');
        if (ariaLabel && /[\d+]/.test(ariaLabel)) {
            phone = ariaLabel.replace(/[^\d+\s]/g, '').trim();
            break;
        }
    }

    let website = '';
    for (const sel of ['a[data-item-id="authority"]', 'a[aria-label*="Site Web"]', 'a[aria-label*="Website"]']) {
        const el = document.querySelector(sel);
        if (el) {
            website = el.getAttribute('href') || '';
            if (website) break;
        }
    }

    let address = '';
    for (const sel of ['button[data-item-id="address"]', 'button[aria-label*="Adresse"]', 'button[aria-label*="Address"]']) {
        const el = document.querySelector(sel);
        if (!el) continue;
        const t = text(el);
        if (t) { address = t; break; }
        const ariaLabel = el.getAttribute('aria-label');
        if (ariaLabel) { address = ariaLabel.replace(/^Adresse:\s*/i, '').trim(); break; }
    }

    // Google préfixe l'adresse d'un glyphe d'icône (zone à usage privé) et
    // parfois d'espaces de largeur nulle.
    if (address) address = address.replace(/^[\s\uE000-\uF8FF\u200B-\u200D\uFEFF]+/, '').trim();
    if (phone) phone = phone.replace(/[^\d+]/g, '');

    return { name, phone, website, address };
}

module.exports = { extractPlaceDetails };
