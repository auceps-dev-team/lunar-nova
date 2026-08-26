/**
 * Parseurs GoAfrica Online, extraits des callbacks `page.evaluate()` du
 * scraper (P2-3). Même contrat que parsers/annuaireCi.js : chaque fonction est
 * auto-portante (uniquement `document` + arguments) pour être sérialisable par
 * Playwright ET appelable directement depuis les tests sur un document jsdom.
 * Lectures de texte via `textContent` — voir la note dans parsers/annuaireCi.js.
 */

// Mapping code pays -> nom complet pour les résultats
const COUNTRY_NAMES = {
    ci: "Côte d'Ivoire",
    tg: "Togo",
    sn: "Sénégal",
    bj: "Bénin",
    bf: "Burkina Faso",
    ml: "Mali",
    ne: "Niger",
    cm: "Cameroun",
    cg: "Congo",
    cd: "RDC",
    ga: "Gabon",
    gn: "Guinée",
    ma: "Maroc",
    dz: "Algérie",
    za: "Afrique du Sud"
};

/**
 * Étape 1 (exécutée dans la page de résultats) : extraction des fiches de
 * l'annuaire — nom, téléphone nettoyé de son indicatif, adresse, lien fiche.
 *
 * @param {{ phoneCode: string, countryName: string }} ctx
 * @returns {Array<{ nom: string, numero: string, pays: string, source: string, details: object }>}
 */
function extractListingLeads({ phoneCode, countryName }) {
    const results = [];
    // Sélecteurs robustes avec fallbacks multiples
    const items = document.querySelectorAll(
        'article, ' +
        'div.bg-white.rounded-\\[24px\\], ' +
        'div[class*="company"], ' +
        'div[class*="annuaire"] > div, ' +
        'li[class*="result"], ' +
        '.search-result-item'
    );

    items.forEach(item => {
        // Sélecteurs de nom renforcés
        const nameEl = item.querySelector(
            'h2, h3, ' +
            'a[href*="/societe/"], ' +
            'a[href*="-"][class*="title"], ' +
            '[class*="company-name"], ' +
            '[class*="nom"]'
        );
        const phoneEls = item.querySelectorAll('a[href^="tel:"]');
        // Sélecteurs d'adresse renforcés
        const addressEl = item.querySelector(
            'address, ' +
            '[itemprop="address"], ' +
            'span[class*="address"], ' +
            'div[class*="address"], ' +
            '[class*="location"], ' +
            '[class*="adresse"]'
        );

        // Récupérer le lien vers la fiche entreprise
        let companyLink = '';
        // D'abord chercher un lien dans le titre (h2/h3 ou parent <a>)
        if (nameEl && nameEl.tagName === 'A') {
            companyLink = nameEl.href;
        } else if (nameEl && nameEl.parentElement && nameEl.parentElement.tagName === 'A') {
            companyLink = nameEl.parentElement.href;
        } else {
            // Fallback : chercher un lien avec un chiffre (ID d'entreprise GoAfrica)
            const linkEl = item.querySelector('a[href*="/"][href$="-cote-ivoire"], a[href*="/"][href$="-togo"], a[href*="/"][href$="-senegal"]');
            if (linkEl && linkEl.href && !linkEl.href.includes('tel:')) {
                companyLink = linkEl.href;
            }
        }

        if (nameEl && phoneEls.length > 0) {
            const name = nameEl.textContent.trim();

            // Extraire le premier numéro valide
            let phone = '';
            for (let el of phoneEls) {
                phone = el.textContent.trim() || el.href.replace('tel:', '');
                if (phone) break;
            }

            // Nettoyer le numéro (enlever Gsm:, Tel: etc)
            phone = phone.replace(/^(Gsm:|Tel:)\s*/i, '').replace(/\s+/g, '').replace(/\D+/g, '');
            // Retirer l'indicatif du pays si présent
            if (phone.startsWith(phoneCode)) {
                phone = phone.substring(phoneCode.length);
            }

            if (phone && phone.length >= 8) {
                results.push({
                    nom: name,
                    numero: phone,
                    pays: countryName,
                    source: 'Go Africa Online',
                    details: {
                        adresse: addressEl ? addressEl.textContent.trim().replace(/\n/g, ', ') : 'Non précisé',
                        siteWeb: '',
                        email: '',
                        companyUrl: companyLink,
                        link: companyLink
                    }
                });
            }
        }
    });
    return results;
}

/**
 * Étape 2 (exécutée dans la page de fiche entreprise) : site web et email
 * complémentaires — JSON-LD d'abord, repli sur les liens sortants en excluant
 * les réseaux sociaux et l'annuaire lui-même.
 * @returns {{ website: string, email: string }}
 */
function extractCompanyExtraDetails() {
    let website = '';
    let email = '';

    // JSON-LD schema
    const scripts = document.querySelectorAll('script[type="application/ld+json"]');
    for (const script of scripts) {
        try {
            const data = JSON.parse(script.textContent);
            const processSchema = (obj) => {
                if (obj['@type'] === 'Organization' || obj['@type'] === 'LocalBusiness') {
                    if (obj.email) email = obj.email;
                    if (obj.url) website = obj.url;
                }
            };
            if (Array.isArray(data)) data.forEach(processSchema);
            else processSchema(data);
        } catch {}
    }

    // Fallback extraction sans réseaux sociaux
    if (!website) {
        const links = document.querySelectorAll('a');
        const excludeDomains = ['goafricaonline.com', 'facebook.com', 'twitter.com', 'instagram.com', 'linkedin.com', 'google.com', 'youtube.com', 'wa.me', 'api.whatsapp.com'];

        for (let a of links) {
            if (a.href && a.href.includes('http')) {
                const isExcluded = excludeDomains.some(domain => a.href.toLowerCase().includes(domain));
                if (!isExcluded) {
                    website = a.href;
                    break;
                }
            }
        }
    }

    if (!email) {
        const mail = document.querySelector('a[href^="mailto:"]');
        if (mail) email = mail.href.replace('mailto:', '');
    }

    return { website, email };
}

module.exports = {
    COUNTRY_NAMES,
    extractListingLeads,
    extractCompanyExtraDetails
};
