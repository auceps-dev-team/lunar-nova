const { chromium } = require('playwright');

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

// Indicatifs téléphoniques par pays
const COUNTRY_PHONE_CODES = {
    ci: '225', tg: '228', sn: '221', bj: '229', bf: '226',
    ml: '223', ne: '227', cm: '237', cg: '242', cd: '243',
    ga: '241', gn: '224', ma: '212', dz: '213', za: '27'
};

// Préfixes de numéros fixes par pays (pour filtrage)
const LANDLINE_PREFIXES = {
    ci: ['21', '25', '27'],
    tg: ['22', '23'],
    sn: ['33'],
    bj: ['21'],
    bf: ['20', '25'],
    cm: ['22', '23', '24', '33'],
    cg: ['22'],
    ga: ['01'],
    ma: ['05'],
    dz: ['02', '03', '04']
};

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
            
            const currentLeads = await page.evaluate(({ phoneCode, countryName }) => {
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
                        const name = nameEl.innerText.trim();
                        
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
            }, { phoneCode, countryName });

            console.log(`[GoAfricaOnline] ${currentLeads.length} leads trouvés sur la page ${p}`);
            
            // Filtrage préalable (fixes et doublons)
            const landlinePrefixes = LANDLINE_PREFIXES[country] || [];
            const validLeads = [];
            
            for (const lead of currentLeads) {
                // --- Déduplication par numéro ---
                if (seenPhones.has(lead.numero)) {
                    if (onProgress) onProgress({ phase: 'extract', current: validLeads.length, total: currentLeads.length, message: `Doublon ignoré : ${lead.nom}` });
                    continue;
                }
                
                // --- Filtrage des numéros fixes ---
                const cleanNumber = lead.numero.replace(/\D/g, '');
                let isLandline = false;
                
                for (const prefix of landlinePrefixes) {
                    if (cleanNumber.startsWith(prefix) || cleanNumber.startsWith((COUNTRY_PHONE_CODES[country] || '') + prefix)) {
                        isLandline = true;
                        break;
                    }
                }

                if (ignoreLandlines && isLandline) {
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
                            });
                            
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
