const { chromium } = require('playwright');
const { isLandline, COUNTRY_PHONE_CODES } = require('./phoneRules');
// Parseurs extraits des page.evaluate (P2-3) : auto-portants, donc sérialisables
// par Playwright et testables directement sous jsdom.
const { COUNTRY_NAMES, extractListingLeads, extractCompanyExtraDetails } = require('./parsers/goAfrica');

/**
 * Scraper pour Go Africa Online
 * @param {string} query Terme de recherche
 * @param {boolean} ignoreLandlines Ignorer les numéros fixes
 * @param {number} pages Quantité de pages à scraper
 * @param {string} country Code pays (ex: 'ci', 'tg')
 * @param {string} subcategorySlug Slug de la sous-catégorie
 * @param {Function} onProgress Callback optionnel pour la progression
 */
async function search(query, ignoreLandlines, pages, country = 'ci', subcategorySlug = '', onProgress = null) {
    let browser;
    const leads = [];
    const seenPhones = new Set(); // Déduplication par numéro de téléphone entre les pages
    
    try {
        console.log(`[GoAfricaOnline] Lancement du navigateur pour la requête: ${query}`);
        browser = await chromium.launch({ headless: true });
        const context = await browser.newContext({
            userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
        });
        const page = await context.newPage();

        for (let p = 1; p <= pages; p++) {
            // Si une sous-catégorie est fournie, on cherche dans cette catégorie
            let searchUrl = '';
            if (subcategorySlug) {
                searchUrl = `https://www.goafricaonline.com/${country}/annuaire/${subcategorySlug}?page=${p}`;
            } else if (query) {
                // Recherche par mots-clés
                searchUrl = `https://www.goafricaonline.com/${country || 'ci'}/annuaire-resultat?whatWho=${encodeURIComponent(query)}&page=${p}`;
            } else {
                throw new Error("Aucune sous-catégorie ou requête fournie");
            }
            
            let success = false;
            for (let attempt = 1; attempt <= 3; attempt++) {
                try {
                    console.log(`[GoAfricaOnline] Navigation vers la page ${p} (Essai ${attempt}) : ${searchUrl}`);
                    if (onProgress) onProgress({ phase: 'scroll', newCount: p, target: pages, message: `Navigation page ${p}/${pages} (Essai ${attempt}/3)...` });
                    await page.goto(searchUrl, { waitUntil: 'domcontentloaded', timeout: 30000 });
                    
                    // GoAfricaOnline a souvent des mécanismes anti-bot. On attend un peu.
                    await page.waitForTimeout(3000);
                    success = true;
                    break;
                } catch (err) {
                    console.error(`[GoAfricaOnline] Erreur page ${p}, tentative ${attempt}/3 :`, err.message);
                    if (attempt === 3) throw err;
                    await page.waitForTimeout(2000);
                }
            }
            if (!success) continue;

            // Extraction des données de base + lien de l'entreprise
            const phoneCode = COUNTRY_PHONE_CODES[country] || '225';
            const countryName = COUNTRY_NAMES[country] || country;
            
            const currentLeads = await page.evaluate(extractListingLeads, { phoneCode, countryName });

            console.log(`[GoAfricaOnline] ${currentLeads.length} leads trouvés sur la page ${p}`);
            
            // Filtrage préalable (fixes et doublons)
            const validLeads = [];
            
            for (const lead of currentLeads) {
                // --- Déduplication par numéro ---
                if (seenPhones.has(lead.numero)) {
                    if (onProgress) onProgress({ phase: 'extract', current: validLeads.length, total: currentLeads.length, message: `Doublon ignoré : ${lead.nom}` });
                    continue;
                }
                
                // --- Filtrage des numéros fixes ---
                // Délégué à phoneRules, qui retire l'indicatif avant de comparer.
                // La comparaison directe qui se trouvait ici classait « fixe »
                // tout numéro togolais ou camerounais en format international,
                // l'indicatif de ces pays commençant par leur propre préfixe fixe.
                if (ignoreLandlines && isLandline(lead.numero, country)) {
                    if (onProgress) onProgress({ phase: 'extract', current: validLeads.length, total: currentLeads.length, message: `Numéro fixe ignoré : ${lead.nom}` });
                    continue;
                }
                
                seenPhones.add(lead.numero);
                validLeads.push(lead);
            }
            
            if (onProgress) onProgress({ phase: 'extract', current: 0, total: validLeads.length, message: `Extraction détaillée de ${validLeads.length} leads (par lots)...` });

            // Traitement par lots (Parallélisme contrôlé) pour optimiser la vitesse
            const BATCH_SIZE = 5;
            let processedCount = 0;
            
            for (let i = 0; i < validLeads.length; i += BATCH_SIZE) {
                const batch = validLeads.slice(i, i + BATCH_SIZE);
                
                await Promise.all(batch.map(async (lead) => {
                    if (lead.details.companyUrl) {
                        try {
                            const companyPage = await context.newPage();
                            await companyPage.goto(lead.details.companyUrl, { waitUntil: 'domcontentloaded', timeout: 20000 });
                            
                            const extraDetails = await companyPage.evaluate(extractCompanyExtraDetails);
                            
                            if (extraDetails.website) lead.details.siteWeb = extraDetails.website;
                            if (extraDetails.email) lead.details.email = extraDetails.email;
                            
                            await companyPage.close();
                        } catch {
                            console.error(`[GoAfricaOnline] Erreur extraction page entreprise pour ${lead.nom}`);
                        }
                    }
                    
                    processedCount++;
                    if (onProgress) onProgress({ phase: 'extract', current: processedCount, total: validLeads.length, message: `Détails récupérés pour ${lead.nom}` });
                }));
                
                leads.push(...batch);
            }

            if (currentLeads.length === 0) {
                console.log(`[GoAfricaOnline] Aucun résultat sur la page ${p}, arrêt de la pagination.`);
                break;
            }
        }
        
    } catch (error) {
        console.error('[GoAfricaOnline] Erreur de scraping:', error);
    } finally {
        if (browser) {
            await browser.close();
        }
    }
    
    return leads;
}

module.exports = { search };
