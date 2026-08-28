const googleMapScraper = require('../scrapers/googleMapScraper');
const annuaireCiScraper = require('../scrapers/annuaireCiScraper');
const goAfricaScraper = require('../scrapers/goAfricaScraper');

/**
 * Recherche de leads (non streaming), partagée par POST /api/prospection/search
 * et la commande CLI `prospect search`.
 *
 * @param {object} params
 * @returns {Promise<{ count: number, leads: Array<object> }>}
 */
async function search({
    query,
    ignoreLandlines,
    source = 'google',
    pages = 1,
    zone = '',
    duration = 5,
    quantity = 20,
    knownLinks = [],
    country,
    subcategorySlug
} = {}) {
    if (!query && source !== 'goafrica') {
        const err = new Error('La requête (query) est obligatoire.');
        err.statusCode = 400;
        throw err;
    }

    let leads = [];
    if (source === 'google') {
        leads = await googleMapScraper.search(query, ignoreLandlines, quantity, duration, zone, knownLinks);
    } else if (source === 'annuaireci') {
        leads = await annuaireCiScraper.search(query, ignoreLandlines, pages);
    } else if (source === 'goafrica') {
        leads = await goAfricaScraper.search(query, ignoreLandlines, pages, country, subcategorySlug);
    } else {
        const err = new Error('Source de prospection invalide.');
        err.statusCode = 400;
        throw err;
    }

    return { count: leads.length, leads };
}

module.exports = { search };
