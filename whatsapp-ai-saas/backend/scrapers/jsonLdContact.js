/**
 * Extraction de coordonnées (email / site web) depuis des données JSON-LD.
 *
 * Extracted from `goAfricaScraper.js` (P2-3 / a) : la logique de parsing vivait
 * dans un `page.evaluate()` inline, donc non testable sans navigateur. Elle est
 * désormais une fonction pure, couverte par `backend/__tests__/jsonLdContact.test.js`.
 *
 * @param {object|object[]} data Un objet (ou tableau) JSON-LD déjà parsé.
 * @returns {{ website: string, email: string }}
 */
function extractContactFromJsonLd(data) {
    let website = '';
    let email = '';

    const processSchema = (obj) => {
        if (!obj || typeof obj !== 'object') return;
        if (obj['@type'] === 'Organization' || obj['@type'] === 'LocalBusiness') {
            if (obj.email) email = obj.email;
            if (obj.url) website = obj.url;
        }
    };

    if (Array.isArray(data)) {
        data.forEach(processSchema);
    } else {
        processSchema(data);
    }

    return { website, email };
}

module.exports = { extractContactFromJsonLd };
