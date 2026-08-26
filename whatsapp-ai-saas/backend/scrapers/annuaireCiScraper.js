const { chromium } = require('playwright');
const { isLandline, normalizeDigits } = require('./phoneRules');
// Parseurs extraits des page.evaluate (P2-3) : testables sous jsdom, et
// sérialisables par Playwright car auto-portants (aucune portée de module).
const { resolveQueryLocation, collectCompanyLinks, extractCompanyDetails } = require('./parsers/annuaireCi');

/**
 * Scraper pour Annuaire CI
 * @param {string} query Terme de recherche
 * @param {boolean} ignoreLandlines Ignorer les numéros fixes
 * @param {number} pages Quantité de pages à scraper
 */
async function search(query, ignoreLandlines, pages) {
    let browser;
    const leads = [];

    try {
        console.log(`[AnnuaireCI] Préparation de la recherche pour: "${query}"`);

        const { categorySlug, baseUrl } = resolveQueryLocation(query);
        if (!categorySlug) {
            console.error('[AnnuaireCI] Erreur: Catégorie introuvable après extraction.');
            return [];
        }

        console.log(`[AnnuaireCI] Lancement du navigateur. URL de base: ${baseUrl}`);
        browser = await chromium.launch({ headless: true });
        const context = await browser.newContext({
            userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
        });
        const page = await context.newPage();

        for (let p = 1; p <= pages; p++) {
            let searchUrl = baseUrl;
            if (p > 1) {
                searchUrl = `${baseUrl}page/${p}/`;
            }

            console.log(`[AnnuaireCI] Navigation vers la page ${p} : ${searchUrl}`);
            const response = await page.goto(searchUrl, { waitUntil: 'domcontentloaded', timeout: 30000 });
            
            if (response && response.status() === 404) {
                console.log(`[AnnuaireCI] 404 - Aucun résultat trouvé pour cette catégorie/ville.`);
                break;
            }

            await page.waitForTimeout(2000);

            // Étape 1 : Récupérer les URLs des entreprises sur la page de résultats
            const companyLinks = await page.evaluate(collectCompanyLinks);

            console.log(`[AnnuaireCI] ${companyLinks.length} entreprises trouvées sur la page ${p}. Scraping des détails...`);
            
            if (companyLinks.length === 0) {
                console.log(`[AnnuaireCI] Aucun résultat sur la page ${p}, arrêt de la pagination.`);
                break;
            }

            // Étape 2 : Visiter chaque page d'entreprise pour extraire les vrais contacts
            for (const link of companyLinks) {
                try {
                    const companyPage = await context.newPage();
                    await companyPage.goto(link, { waitUntil: 'domcontentloaded', timeout: 20000 });
                    await companyPage.waitForTimeout(1000);

                    const details = await companyPage.evaluate(extractCompanyDetails);

                    await companyPage.close();

                    if (details.name && details.phone && details.phone.length >= 8) {
                        const cleanNumber = normalizeDigits(details.phone);

                        // Le filtrage était écrit en dur ici, et ne reconnaissait
                        // les numéros nationaux que sur exactement 10 chiffres.
                        // phoneRules couvre les deux formats et sert désormais les
                        // trois scrapers.
                        if (ignoreLandlines && isLandline(cleanNumber, 'ci')) {
                            continue;
                        }
                        
                        leads.push({
                            nom: details.name,
                            numero: cleanNumber,
                            pays: 'Côte d\'Ivoire',
                            source: 'Annuaire CI',
                            details: {
                                adresse: details.address,
                                siteWeb: details.website,
                                email: details.email
                            }
                        });
                    }
                } catch (err) {
                    console.error(`[AnnuaireCI] Erreur lors du scraping de la page ${link}:`, err.message);
                }
            }
        }
        
    } catch (error) {
        console.error('[AnnuaireCI] Erreur globale de scraping:', error);
    } finally {
        if (browser) {
            await browser.close();
        }
    }
    
    return leads;
}

module.exports = { search };
