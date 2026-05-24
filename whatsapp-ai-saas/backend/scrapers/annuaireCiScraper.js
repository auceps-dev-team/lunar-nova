const { chromium } = require('playwright');

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
        console.log(`[AnnuaireCI] Lancement du navigateur pour la requête: ${query}`);
        browser = await chromium.launch({ headless: true });
        const context = await browser.newContext({
            userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
        });
        const page = await context.newPage();

        for (let p = 1; p <= pages; p++) {
            // Construction de l'URL de recherche (gestion basique de la pagination)
            // L'URL de base est ?s=...&post_type=business. 
            // S'il y a des pages, ce sera généralement /page/2/?s=...&post_type=business
            let searchUrl = `https://annuaireci.com/?s=${encodeURIComponent(query)}&post_type=business`;
            if (p > 1) {
                searchUrl = `https://annuaireci.com/page/${p}/?s=${encodeURIComponent(query)}&post_type=business`;
            }

            console.log(`[AnnuaireCI] Navigation vers la page ${p} : ${searchUrl}`);
            await page.goto(searchUrl, { waitUntil: 'domcontentloaded', timeout: 30000 });
            
            // Attendre que les résultats se chargent (ou qu'aucun résultat ne s'affiche)
            await page.waitForTimeout(2000);

            // Extraction des données sur la page courante
            const currentLeads = await page.evaluate(() => {
                const results = [];
                // Sélecteurs génériques pour un thème WordPress type annuaire
                // Les classes peuvent varier, on essaie de capturer les structures communes (.listing-item, .business-card, article)
                const items = document.querySelectorAll('article, .listing-item, .business-card, .type-business');
                
                items.forEach(item => {
                    const nameEl = item.querySelector('h2, h3, .entry-title');
                    const phoneEl = item.querySelector('a[href^="tel:"], .phone, .contact-phone');
                    const addressEl = item.querySelector('.address, .location, [class*="address"]');
                    const websiteEl = item.querySelector('a[href^="http"]:not([href*="annuaireci.com"]), .website');

                    if (nameEl) {
                        const name = nameEl.innerText.trim();
                        // Nettoyage basique du numéro
                        let phone = phoneEl ? phoneEl.innerText.trim() : '';
                        if (phoneEl && phoneEl.href && phoneEl.href.includes('tel:')) {
                            phone = phoneEl.href.replace('tel:', '').replace(/\s+/g, '');
                        }
                        
                        if (phone && phone.length >= 8) { // Minimum pour un numéro valide
                            results.push({
                                nom: name,
                                numero: phone,
                                pays: 'Côte d\'Ivoire', // Par défaut
                                source: 'Annuaire CI',
                                details: {
                                    adresse: addressEl ? addressEl.innerText.trim() : 'Non précisé',
                                    siteWeb: websiteEl ? websiteEl.href : ''
                                }
                            });
                        }
                    }
                });
                return results;
            });

            console.log(`[AnnuaireCI] ${currentLeads.length} leads trouvés sur la page ${p}`);
            
            // Filtrage des numéros fixes ivoiriens (commencent par 21, 25, 27, etc.)
            for (const lead of currentLeads) {
                const cleanNumber = lead.numero.replace(/\D/g, '');
                let isLandline = false;
                
                // Si format 10 chiffres (nouveau plan de numérotation CI)
                if (cleanNumber.length === 10) {
                    if (cleanNumber.startsWith('21') || cleanNumber.startsWith('25') || cleanNumber.startsWith('27')) {
                        isLandline = true;
                    }
                } 
                // Format international +225 27...
                else if (cleanNumber.startsWith('22521') || cleanNumber.startsWith('22525') || cleanNumber.startsWith('22527')) {
                    isLandline = true;
                }

                if (ignoreLandlines && isLandline) {
                    continue;
                }
                
                leads.push(lead);
            }

            // S'il n'y a pas de leads sur cette page, c'est probablement la fin des résultats
            if (currentLeads.length === 0) {
                console.log(`[AnnuaireCI] Aucun résultat sur la page ${p}, arrêt de la pagination.`);
                break;
            }
        }
        
    } catch (error) {
        console.error('[AnnuaireCI] Erreur de scraping:', error);
    } finally {
        if (browser) {
            await browser.close();
        }
    }
    
    return leads;
}

module.exports = { search };
