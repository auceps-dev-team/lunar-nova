const { chromium } = require('playwright');
const { isLandline, normalizeDigits } = require('./phoneRules');

/**
 * Scraper pour Annuaire CI
 * @param {string} query Terme de recherche
 * @param {boolean} ignoreLandlines Ignorer les numéros fixes
 * @param {number} pages Quantité de pages à scraper
 */
async function search(query, ignoreLandlines, pages) {
    let browser;
    const leads = [];
    
    // Villes connues pour extraire la ville de la requête
    const CITIES = [
        'abidjan', 'bouake', 'cocody', 'san-pedro', 'yamoussoukro', 
        'grand-bassam', 'treichville', 'marcory', 'plateau', 'daloa', 
        'bingerville', 'yopougon', 'sassandra', 'korhogo', 'abengourou', 
        'gagnoa', 'koumassi', 'dabou', 'divo', 'soubre', 'soubré'
    ];

    const slugify = (text) => text.toString().toLowerCase().trim()
        .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
        .replace(/\s+/g, '-')
        .replace(/[^\w-]+/g, '')
        .replace(/--+/g, '-');

    try {
        console.log(`[AnnuaireCI] Préparation de la recherche pour: "${query}"`);
        
        let category = query.toLowerCase().trim();
        let city = '';

        for (const c of CITIES) {
            if (category.includes(c)) {
                city = c === 'soubré' ? 'soubre' : c;
                category = category.replace(new RegExp(c, 'g'), '').trim();
                break;
            }
        }

        const categorySlug = slugify(category);
        if (!categorySlug) {
            console.error('[AnnuaireCI] Erreur: Catégorie introuvable après extraction.');
            return [];
        }

        let baseUrl = `https://annuaireci.com/categorie/${categorySlug}/`;
        if (city) {
            baseUrl += `${city}/`;
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
            const companyLinks = await page.evaluate(() => {
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
            });

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

                    const details = await companyPage.evaluate(() => {
                        let name = '';
                        let phone = '';
                        let address = 'Non précisé';
                        let website = '';
                        let email = '';

                        // 1. Try to extract from JSON-LD schema (most reliable)
                        const scripts = document.querySelectorAll('script[type="application/ld+json"]');
                        for (const script of scripts) {
                            try {
                                const data = JSON.parse(script.innerText);
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
                            name = nameEl ? nameEl.innerText.trim() : '';
                        }
                        
                        if (!phone) {
                            const phoneEl = document.querySelector('a[href^="tel:"], .phone, .contact-phone');
                            if (phoneEl) {
                                if (phoneEl.href && phoneEl.href.includes('tel:')) {
                                    phone = phoneEl.href.replace('tel:', '').replace(/\s+/g, '');
                                } else {
                                    phone = phoneEl.innerText.trim();
                                }
                            }
                            // Si pas de numéro "tel:", chercher dans le texte
                            if (!phone || phone.length < 8) {
                                const bodyText = document.body.innerText;
                                const phoneMatch = bodyText.match(/(?:\+225)?\s*[0-9]{2}\s*[0-9]{2}\s*[0-9]{2}\s*[0-9]{2}\s*[0-9]{2}/);
                                if (phoneMatch) {
                                    phone = phoneMatch[0].replace(/\s+/g, '');
                                }
                            }
                        }

                        if (!address || address === 'Non précisé') {
                            const addressEl = document.querySelector('.address, .location, [class*="address"], .v2-listing-address');
                            if (addressEl) address = addressEl.innerText.trim();
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
                    });

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
