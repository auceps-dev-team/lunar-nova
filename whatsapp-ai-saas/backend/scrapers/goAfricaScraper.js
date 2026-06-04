const { chromium } = require('playwright');

/**
 * Scraper pour Go Africa Online
 * @param {string} query Terme de recherche
 * @param {boolean} ignoreLandlines Ignorer les numéros fixes
 * @param {number} pages Quantité de pages à scraper
 */
async function search(query, ignoreLandlines, pages) {
    let browser;
    const leads = [];
    
    try {
        console.log(`[GoAfricaOnline] Lancement du navigateur pour la requête: ${query}`);
        browser = await chromium.launch({ headless: true });
        const context = await browser.newContext({
            userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
        });
        const page = await context.newPage();

        for (let p = 1; p <= pages; p++) {
            // URL de recherche correcte sur Go Africa Online
            const searchUrl = `https://www.goafricaonline.com/ci/annuaire-resultat?type=company&whatWho=${encodeURIComponent(query)}&page=${p}`;
            
            console.log(`[GoAfricaOnline] Navigation vers la page ${p} : ${searchUrl}`);
            await page.goto(searchUrl, { waitUntil: 'domcontentloaded', timeout: 30000 });
            
            // GoAfricaOnline a souvent des mécanismes anti-bot. On attend un peu.
            await page.waitForTimeout(3000);

            // Extraction des données de base + lien de l'entreprise
            const currentLeads = await page.evaluate(() => {
                const results = [];
                // GoAfricaOnline utilise souvent la balise <article> ou des div spécifiques
                const items = document.querySelectorAll('article, div.bg-white.rounded-\\[24px\\]');
                
                items.forEach(item => {
                    const nameEl = item.querySelector('h2, h3, a[href*="/societe/"]');
                    const phoneEls = item.querySelectorAll('a[href^="tel:"]');
                    const addressEl = item.querySelector('address, [itemprop="address"], span[class*="address"], div[class*="address"]');
                    
                    // Récupérer le lien vers la fiche entreprise
                    let companyLink = '';
                    const linkEl = item.querySelector('a[href*="-"]'); // Ex: boyoot-promoteur-immobilier
                    if (linkEl && linkEl.href && !linkEl.href.includes('tel:')) {
                        companyLink = linkEl.href;
                    } else if (nameEl && nameEl.tagName === 'A') {
                        companyLink = nameEl.href;
                    } else if (nameEl && nameEl.parentElement && nameEl.parentElement.tagName === 'A') {
                        companyLink = nameEl.parentElement.href;
                    }

                    if (nameEl && phoneEls.length > 0) {
                        const name = nameEl.innerText.trim();
                        
                        // Extraire le premier numéro valide
                        let phone = '';
                        for (let el of phoneEls) {
                            phone = el.textContent.trim() || el.href.replace('tel:', '');
                            if (phone) break;
                        }
                        
                        // Nettoyer le numéro (enlever Gsm:, Tel: etc)
                        phone = phone.replace(/^(Gsm:|Tel:)\s*/i, '').replace(/\s+/g, '').replace(/\D+/g, '');
                        if (phone.startsWith('225')) {
                            phone = phone.substring(3);
                        }
                        
                        if (phone && phone.length >= 8) {
                            results.push({
                                nom: name,
                                numero: phone,
                                pays: 'Côte d\'Ivoire', 
                                source: 'Go Africa Online',
                                details: {
                                    adresse: addressEl ? addressEl.innerText.trim().replace(/\n/g, ', ') : 'Non précisé',
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
            });

            console.log(`[GoAfricaOnline] ${currentLeads.length} leads trouvés sur la page ${p}`);
            
            // Filtrage des numéros fixes ivoiriens et extraction des détails additionnels
            for (const lead of currentLeads) {
                const cleanNumber = lead.numero.replace(/\D/g, '');
                let isLandline = false;
                
                if (cleanNumber.length === 10) {
                    if (cleanNumber.startsWith('21') || cleanNumber.startsWith('25') || cleanNumber.startsWith('27')) {
                        isLandline = true;
                    }
                } else if (cleanNumber.startsWith('22521') || cleanNumber.startsWith('22525') || cleanNumber.startsWith('22527')) {
                    isLandline = true;
                }

                if (ignoreLandlines && isLandline) {
                    continue;
                }
                
                // Visiter la page de l'entreprise pour extraire le Site Web et l'Email si on a un lien
                if (lead.details.companyUrl) {
                    try {
                        const companyPage = await context.newPage();
                        await companyPage.goto(lead.details.companyUrl, { waitUntil: 'domcontentloaded', timeout: 20000 });
                        await companyPage.waitForTimeout(1000);

                        const extraDetails = await companyPage.evaluate(() => {
                            let website = '';
                            let email = '';
                            
                            // JSON-LD schema
                            const scripts = document.querySelectorAll('script[type="application/ld+json"]');
                            for (const script of scripts) {
                                try {
                                    const data = JSON.parse(script.innerText);
                                    const processSchema = (obj) => {
                                        if (obj['@type'] === 'Organization' || obj['@type'] === 'LocalBusiness') {
                                            if (obj.email) email = obj.email;
                                            if (obj.url) website = obj.url;
                                        }
                                    };
                                    if (Array.isArray(data)) data.forEach(processSchema);
                                    else processSchema(data);
                                } catch(e) {}
                            }
                            
                            // Fallback extraction
                            if (!website) {
                                const links = document.querySelectorAll('a');
                                for (let a of links) {
                                    if (a.href && !a.href.includes('goafricaonline') && a.href.includes('http')) {
                                        website = a.href;
                                        break;
                                    }
                                }
                                if (!website) {
                                    const walk = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT, null, false);
                                    let node;
                                    while (node = walk.nextNode()) {
                                        if (node.nodeValue.includes('www.') || (node.nodeValue.includes('.com') && !node.nodeValue.includes(' '))) {
                                            let text = node.nodeValue.trim();
                                            if (text.length < 50 && text.includes('.')) {
                                                website = text;
                                                break;
                                            }
                                        }
                                    }
                                }
                            }
                            
                            if (!email) {
                                const mail = document.querySelector('a[href^="mailto:"]');
                                if (mail) email = mail.href.replace('mailto:', '');
                            }
                            
                            return { website, email };
                        });
                        
                        if (extraDetails.website) lead.details.siteWeb = extraDetails.website;
                        if (extraDetails.email) lead.details.email = extraDetails.email;
                        
                        await companyPage.close();
                    } catch (e) {
                        console.error(`[GoAfricaOnline] Erreur extraction page entreprise pour ${lead.nom}`);
                    }
                }
                
                leads.push(lead);
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
