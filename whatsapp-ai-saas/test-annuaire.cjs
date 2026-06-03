const annuaireCiScraper = require('./backend/scrapers/annuaireCiScraper.js');

async function run() {
    const leads = await annuaireCiScraper.search('communication publicite abidjan', false, 1);
    console.log(leads);
}

run().catch(console.error);
