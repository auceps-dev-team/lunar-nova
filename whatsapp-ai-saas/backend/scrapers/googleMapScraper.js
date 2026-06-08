const { chromium } = require('playwright');
const EventEmitter = require('events');

const MAX_SESSIONS = 10;
const SESSION_TTL_MS = 60 * 60 * 1000; // 1 hour

class GoogleMapScraper extends EventEmitter {
    constructor() {
        super();
        this._sessionCache = {};
        this._isRunning = false;
    }

    _cacheKey(query, zone) {
        return `${(query || '').trim().toLowerCase()}|${(zone || '').trim().toLowerCase()}`;
    }

    _getSession(key) {
        const now = Date.now();
        if (this._sessionCache[key]) {
            const session = this._sessionCache[key];
            if ((now - session.createdAt) > SESSION_TTL_MS) {
                console.log(`[GoogleMapScraper] Session expired for "${key}" (>1h). Starting fresh.`);
                delete this._sessionCache[key];
            } else {
                session.lastUsed = now;
                return session;
            }
        }

        const keys = Object.keys(this._sessionCache);
        if (keys.length >= MAX_SESSIONS) {
            let oldestKey = keys[0];
            let oldestTime = this._sessionCache[keys[0]].lastUsed;
            for (const k of keys) {
                if (this._sessionCache[k].lastUsed < oldestTime) {
                    oldestKey = k;
                    oldestTime = this._sessionCache[k].lastUsed;
                }
            }
            console.log(`[GoogleMapScraper] LRU eviction: removing session "${oldestKey}"`);
            delete this._sessionCache[oldestKey];
        }

        this._sessionCache[key] = {
            scrapedLinks: new Set(),
            collectedLinks: new Set(),
            totalExtracted: 0,
            createdAt: now,
            lastUsed: now
        };
        return this._sessionCache[key];
    }

    clearSession(query, zone) {
        if (query) {
            const key = this._cacheKey(query, zone);
            delete this._sessionCache[key];
            console.log(`[GoogleMapScraper] Session cleared for "${key}"`);
        } else {
            this._sessionCache = {};
            console.log('[GoogleMapScraper] All sessions cleared.');
        }
    }

    /**
     * Emit a progress event for SSE consumers
     * @param {string} phase - 'scroll' | 'extract' | 'done' | 'info'
     * @param {object} data    // Helper pour envoyer les événements
     */
    _emitProgress(phase, data) {
        console.log(`[GoogleMapScraper] EMITTING PROGRESS: ${phase}`);
        this.emit('progress', { phase, ...data });
    }

    async search(query, ignoreLandlines = false, quantity = 20, duration = 5, zone = '', knownLinks = []) {
        if (this._isRunning) {
            throw new Error('Un scraping Google Maps est déjà en cours. Veuillez patienter la fin de la recherche actuelle.');
        }
        this._isRunning = true;

        const searchQuery = zone ? `${query} ${zone}` : query;
        const cacheKey = this._cacheKey(query, zone);
        const session = this._getSession(cacheKey);

        for (const link of knownLinks) {
            session.scrapedLinks.add(link);
        }

        const isResume = session.scrapedLinks.size > 0;
        if (isResume) {
            console.log(`[GoogleMapScraper] ♻ Resuming session for "${searchQuery}" — ${session.scrapedLinks.size} links already known`);
            this._emitProgress('info', { message: `Reprise de session — ${session.scrapedLinks.size} leads déjà connus` });
        } else {
            console.log(`[GoogleMapScraper] 🆕 New session for "${searchQuery}" | max: ${quantity} leads | max duration: ${duration}min`);
            this._emitProgress('info', { message: `Nouvelle recherche: "${searchQuery}"` });
        }

        const leads = [];
        const startTime = Date.now();
        const durationMs = duration * 60 * 1000;
        const browser = await chromium.launch({ headless: true });

        try {
            const context = await browser.newContext({
                locale: 'fr-FR',
                userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36'
            });
            const page = await context.newPage();

            this._emitProgress('scroll', { message: 'Ouverture de Google Maps...', discovered: 0, newCount: 0, target: quantity });

            const searchUrl = `https://www.google.com/maps/search/${encodeURIComponent(searchQuery)}`;
            await page.goto(searchUrl, { waitUntil: 'domcontentloaded', timeout: 30000 });

            try {
                const acceptBtn = page.locator('button:has-text("Tout accepter")');
                await acceptBtn.click({ timeout: 4000 });
                await page.waitForTimeout(1000);
            } catch (_) {}

            await page.waitForTimeout(3000);

            // === PHASE 1: Scroll & collect links ===
            const allDiscoveredLinks = new Set();
            const feedSelector = 'div[role="feed"]';

            try {
                await page.waitForSelector(feedSelector, { timeout: 15000 });

                let noNewLinksCount = 0;
                const getNewLinkCount = () => {
                    let count = 0;
                    for (const link of allDiscoveredLinks) {
                        if (!session.scrapedLinks.has(link)) count++;
                    }
                    return count;
                };

                while (getNewLinkCount() < quantity && (Date.now() - startTime) < durationMs) {
                    const currentLinks = await page.$$eval(
                        'a[href*="/maps/place/"]',
                        els => [...new Set(els.map(a => a.href))]
                    );
                    const prevSize = allDiscoveredLinks.size;
                    for (const link of currentLinks) {
                        allDiscoveredLinks.add(link);
                    }

                    const newCount = getNewLinkCount();
                    // Emit scroll progress
                    this._emitProgress('scroll', {
                        message: `Scroll... ${allDiscoveredLinks.size} liens trouvés (${newCount} nouveaux)`,
                        discovered: allDiscoveredLinks.size,
                        newCount,
                        target: quantity
                    });

                    if (newCount >= quantity) break;

                    if (allDiscoveredLinks.size === prevSize) {
                        noNewLinksCount++;
                        if (noNewLinksCount >= 3) {
                            console.log('[GoogleMapScraper] No more new results after 3 scroll attempts.');
                            break;
                        }
                    } else {
                        noNewLinksCount = 0;
                    }

                    await page.evaluate((sel) => {
                        const container = document.querySelector(sel);
                        if (container) container.scrollTop = container.scrollHeight;
                    }, feedSelector);

                    await page.waitForTimeout(2000);

                    const endMarker = await page.$('span.HlvSq');
                    if (endMarker) {
                        console.log('[GoogleMapScraper] End of list reached.');
                        break;
                    }
                }
            } catch (e) {
                console.log('[GoogleMapScraper] Feed not found. Checking if single place page...');
                const currentUrl = page.url();
                if (currentUrl.includes('/maps/place/')) {
                    allDiscoveredLinks.add(currentUrl);
                }
            }

            const newLinks = Array.from(allDiscoveredLinks).filter(link => !session.scrapedLinks.has(link));
            const linksToProcess = newLinks.slice(0, quantity);
            const skippedCount = allDiscoveredLinks.size - newLinks.length;

            console.log(`[GoogleMapScraper] Discovered ${allDiscoveredLinks.size} total | ${skippedCount} known | ${linksToProcess.length} new`);

            this._emitProgress('extract', {
                message: `Extraction de ${linksToProcess.length} nouveaux leads...`,
                current: 0,
                total: linksToProcess.length,
                leadName: ''
            });

            if (linksToProcess.length === 0) {
                this._emitProgress('info', { message: 'Aucun nouveau lead trouvé. Essayez une autre zone.' });
            }

            // === PHASE 2: Extract details ===
            for (let i = 0; i < linksToProcess.length; i++) {
                const link = linksToProcess[i];
                if ((Date.now() - startTime) > durationMs) {
                    console.log(`[GoogleMapScraper] Max duration reached. ${leads.length}/${linksToProcess.length}`);
                    this._emitProgress('info', { message: `Durée max atteinte. ${leads.length} leads extraits.` });
                    break;
                }

                try {
                    await page.goto(link, { waitUntil: 'domcontentloaded', timeout: 20000 });
                    await page.waitForTimeout(1500);

                    const name = await page.$eval('h1', el => el.innerText.trim()).catch(() => '');
                    if (!name) {
                        session.scrapedLinks.add(link);
                        continue;
                    }

                    // Emit extraction progress with business name
                    this._emitProgress('extract', {
                        message: `Extraction ${i + 1}/${linksToProcess.length} — ${name}`,
                        current: i + 1,
                        total: linksToProcess.length,
                        leadName: name
                    });

                    // Extract phone
                    let phone = '';
                    for (const sel of [
                        'button[data-item-id^="phone:tel:"]',
                        'a[data-item-id^="phone:tel:"]',
                        'button[aria-label*="Téléphone"]',
                        'button[aria-label*="Phone"]',
                        '[data-tooltip="Copier le numéro de téléphone"]'
                    ]) {
                        try {
                            const el = await page.$(sel);
                            if (el) {
                                phone = await el.innerText();
                                if (phone && phone.trim()) { phone = phone.trim(); break; }
                                const ariaLabel = await el.getAttribute('aria-label');
                                if (ariaLabel && ariaLabel.match(/[\d+]/)) {
                                    phone = ariaLabel.replace(/[^\d+\s]/g, '').trim();
                                    break;
                                }
                            }
                        } catch (_) {}
                    }

                    // Extract website
                    let website = '';
                    for (const sel of ['a[data-item-id="authority"]', 'a[aria-label*="Site Web"]', 'a[aria-label*="Website"]']) {
                        try {
                            const el = await page.$(sel);
                            if (el) { website = await el.getAttribute('href') || ''; if (website) break; }
                        } catch (_) {}
                    }

                    // Extract address
                    let address = '';
                    for (const sel of ['button[data-item-id="address"]', 'button[aria-label*="Adresse"]', 'button[aria-label*="Address"]']) {
                        try {
                            const el = await page.$(sel);
                            if (el) {
                                address = await el.innerText();
                                if (address && address.trim()) { address = address.trim(); break; }
                                const ariaLabel = await el.getAttribute('aria-label');
                                if (ariaLabel) { address = ariaLabel.replace(/^Adresse:\s*/i, '').trim(); break; }
                            }
                        } catch (_) {}
                    }

                    if (phone) phone = phone.replace(/[^\d+]/g, '');

                    // Filter landlines
                    if (ignoreLandlines && phone) {
                        let isMobile = true;
                        if (phone.startsWith('+33')) {
                            if (!phone.match(/^\+33\s*[67]/)) isMobile = false;
                        } else if (phone.startsWith('+225')) {
                            if (!phone.match(/^\+225\s*(01|05|07)/)) isMobile = false;
                        } else if (phone.startsWith('+221') && phone.match(/^\+221\s*33/)) {
                            isMobile = false; // Sénégal fixe
                        } else if (phone.startsWith('+228') && phone.match(/^\+228\s*(22|23)/)) {
                            isMobile = false; // Togo fixe
                        } else if (phone.startsWith('+237') && phone.match(/^\+237\s*(22|23|24|33)/)) {
                            isMobile = false; // Cameroun fixe
                        } else if (phone.startsWith('+226') && phone.match(/^\+226\s*(20|25)/)) {
                            isMobile = false; // Burkina Faso fixe
                        } else if (phone.startsWith('+229') && phone.match(/^\+229\s*21/)) {
                            isMobile = false; // Bénin fixe
                        } else if (phone.startsWith('+241') && phone.match(/^\+241\s*01/)) {
                            isMobile = false; // Gabon fixe
                        } else if (phone.startsWith('+212') && phone.match(/^\+212\s*5/)) {
                            isMobile = false; // Maroc fixe
                        } else if (phone.startsWith('+213') && phone.match(/^\+213\s*(02|03|04)/)) {
                            isMobile = false; // Algérie fixe
                        }
                        if (!isMobile) {
                            console.log(`[GoogleMapScraper] Skipping landline: ${phone}`);
                            session.scrapedLinks.add(link);
                            continue;
                        }
                    }

                    session.scrapedLinks.add(link);
                    session.totalExtracted++;
                    leads.push({ name, phone: phone || '', address: address || '', website: website || '', link });

                    console.log(`[GoogleMapScraper] ✓ ${leads.length}/${linksToProcess.length} — ${name} | ${phone || 'No phone'}`);

                } catch (e) {
                    console.error(`[GoogleMapScraper] Error extracting ${link}:`, e.message);
                }
            }

        } catch (error) {
            console.error('[GoogleMapScraper] Main error:', error);
            throw error;
        } finally {
            await browser.close();
            this._isRunning = false;
        }

        const elapsed = Math.round((Date.now() - startTime) / 1000);
        console.log(`[GoogleMapScraper] Done. ${leads.length} NEW leads in ${elapsed}s. Session total: ${session.totalExtracted}.`);
        this._emitProgress('done', {
            message: `Terminé ! ${leads.length} nouveaux leads en ${elapsed}s`,
            leadsCount: leads.length,
            elapsed
        });
        return leads;
    }
}

module.exports = new GoogleMapScraper();
