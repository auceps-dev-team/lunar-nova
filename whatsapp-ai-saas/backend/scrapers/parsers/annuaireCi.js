/**
 * Parseurs d'Annuaire CI, extraits des callbacks `page.evaluate()` du scraper
 * (P2-3). Chaque fonction de ce fichier est AUTO-PORTANTE : elle ne référence
 * que `document` (global du contexte navigateur) et ses arguments, jamais la
 * portée du module. Playwright sérialise ainsi son code source tel quel pour
 * l'exécuter dans la page (`page.evaluate(collectCompanyLinks)`), et les tests
 * unitaires l'appellent directement sur un document jsdom.
 *
 * NB : les lectures de texte utilisent `textContent` (et non `innerText`) :
 * indépendant du rendu/layout, disponible sur les <script> JSON-LD, et
 * identique entre la vraie page et jsdom — c'est aussi le choix usuel des
 * scrapers car il inclut le contenu masqué, jamais franchement dommageable
 * pour de l'extraction de coordonnées.
 */

// Villes connues pour extraire la ville de la requête
const KNOWN_CITIES = [
    'abidjan', 'bouake', 'cocody', 'san-pedro', 'yamoussoukro',
    'grand-bassam', 'treichville', 'marcory', 'plateau', 'daloa',
    'bingerville', 'yopougon', 'sassandra', 'korhogo', 'abengourou',
    'gagnoa', 'koumassi', 'dabou', 'divo', 'soubre', 'soubré'
];

/**
 * Slugifie un libellé : minuscules, sans accents, espaces -> tirets.
 * @param {string} text
 */
function slugify(text) {
    return text.toString().toLowerCase().trim()
        .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
        .replace(/\s+/g, '-')
        .replace(/[^\w-]+/g, '')
        .replace(/--+/g, '-');
}

/**
 * Découpe la requête utilisateur en (ville, catégorie) et construit l'URL de
 * base du répertoire Annuaire CI correspondant.
 *
 * @param {string} query Terme de recherche brut, ex. « pharmacies abidjan »
 * @returns {{ city: string, categorySlug: string, baseUrl: string }}
 */
function resolveQueryLocation(query) {
    let category = query.toLowerCase().trim();
    let city = '';

    for (const c of KNOWN_CITIES) {
        if (category.includes(c)) {
            city = c === 'soubré' ? 'soubre' : c;
            category = category.replace(new RegExp(c, 'g'), '').trim();
            break;
        }
    }

    const categorySlug = slugify(category);
    let baseUrl = `https://annuaireci.com/categorie/${categorySlug}/`;
    if (city) {
        baseUrl += `${city}/`;
    }
    return { city, categorySlug, baseUrl };
}

/**
 * Étape 1 (exécutée dans la page) : collecte les URLs des fiches entreprise
 * présentes sur une page de résultats.
 * @returns {string[]}
 */
function collectCompanyLinks() {
    const links = [];
    const items = document.querySelectorAll('.v2-card, .v2-listing-card, article, .listing-item, .type-business');

    items.forEach(item => {
        // Chercher un lien vers la fiche de l'entreprise
        const linkEl = item.querySelector('a[href*="/entreprises/"]');
        if (linkEl) {
            links.push(linkEl.href);
        }
    });
    // Dé-dupliquer les liens
    return [...new Set(links)];
}

/**
 * Étape 2 (exécutée dans la page de fiche entreprise) : extraction des
 * coordonnées — d'abord le schéma JSON-LD (le plus fiable), puis repli sur les
 * sélecteurs DOM pour chaque champ manquant.
 * @returns {{ name: string, phone: string, address: string, website: string, email: string }}
 */
function extractCompanyDetails() {
    let name = '';
    let phone = '';
    let address = 'Non précisé';
    let website = '';
    let email = '';

    // 1. Try to extract from JSON-LD schema (most reliable)
    const scripts = document.querySelectorAll('script[type="application/ld+json"]');
    for (const script of scripts) {
        try {
            const data = JSON.parse(script.textContent);
            // Sometime data is an array or object
            const processSchema = (obj) => {
                if (obj['@type'] === 'LocalBusiness' || obj['@type'] === 'Pharmacy' || obj.telephone) {
                    if (obj.name) name = obj.name;
                    if (obj.telephone) phone = obj.telephone;
                    if (obj.email) email = obj.email;
                    if (obj.url) website = obj.url;

                    // Handle sameAs which might contain website/social
                    if (!website && obj.sameAs) {
                        website = Array.isArray(obj.sameAs) ? obj.sameAs[0] : obj.sameAs;
                    }

                    if (obj.address) {
                        if (typeof obj.address === 'string') address = obj.address;
                        else if (obj.address.streetAddress) address = obj.address.streetAddress + (obj.address.addressLocality ? ', ' + obj.address.addressLocality : '');
                    }
                    return true;
                }
                return false;
            };

            if (Array.isArray(data)) {
                for (const item of data) {
                    if (processSchema(item)) break;
                }
            } else if (data['@graph']) {
                for (const item of data['@graph']) {
                    if (processSchema(item)) break;
                }
            } else {
                processSchema(data);
            }
        } catch {}
    }

    // 2. Fallback to DOM parsing if missing
    if (!name) {
        const nameEl = document.querySelector('h1, .entry-title, .v2-listing-title, .title-biz');
        name = nameEl ? nameEl.textContent.trim() : '';
    }

    if (!phone) {
        const phoneEl = document.querySelector('a[href^="tel:"], .phone, .contact-phone');
        if (phoneEl) {
            if (phoneEl.href && phoneEl.href.includes('tel:')) {
                phone = phoneEl.href.replace('tel:', '').replace(/\s+/g, '');
            } else {
                phone = phoneEl.textContent.trim();
            }
        }
        // Si pas de numéro "tel:", chercher dans le texte
        if (!phone || phone.length < 8) {
            const bodyText = document.body.textContent;
            const phoneMatch = bodyText.match(/(?:\+225)?\s*[0-9]{2}\s*[0-9]{2}\s*[0-9]{2}\s*[0-9]{2}\s*[0-9]{2}/);
            if (phoneMatch) {
                phone = phoneMatch[0].replace(/\s+/g, '');
            }
        }
    }

    if (!address || address === 'Non précisé') {
        const addressEl = document.querySelector('.address, .location, [class*="address"], .v2-listing-address');
        if (addressEl) address = addressEl.textContent.trim();
    }

    if (!website) {
        const websiteEl = document.querySelector('a[href^="http"]:not([href*="annuaireci.com"]):not([href*="facebook.com"]), .website, .v2-listing-website a');
        if (websiteEl) website = websiteEl.href;
    }

    if (!email) {
        const emailEl = document.querySelector('a[href^="mailto:"]');
        if (emailEl) email = emailEl.href.replace('mailto:', '');
    }

    return {
        name,
        phone,
        address,
        website,
        email
    };
}

module.exports = {
    KNOWN_CITIES,
    slugify,
    resolveQueryLocation,
    collectCompanyLinks,
    extractCompanyDetails
};
