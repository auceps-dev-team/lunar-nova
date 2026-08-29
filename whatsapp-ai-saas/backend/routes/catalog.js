const express = require('express');
const router = express.Router();
const fs = require('fs');
const path = require('path');
const puppeteer = require('puppeteer-core');


/**
 * POST /api/catalog/upload — Prépare la publication d'un article au catalogue
 * WhatsApp Business.
 *
 * Portée volontairement limitée : la route ouvre le catalogue, clique sur
 * « Ajouter un article » et **injecte uniquement l'image** dans le formulaire.
 * Le nom, le prix et la description ne sont pas saisis par l'automatisation ;
 * ils sont affichés à l'utilisateur par le copilote, qui les colle lui-même.
 *
 * Ce n'est pas une limitation technique mais un choix : faire taper
 * l'automatisation dans les champs de WhatsApp Web est précisément le genre de
 * comportement qui déclenche une restriction de compte. Le reste du fichier est
 * d'ailleurs parsemé de délais « humains » pour la même raison.
 *
 * La route recevait auparavant productDescription et productPrice sans jamais
 * les utiliser, ce qui laissait penser à une fonctionnalité inachevée.
 */
router.post('/upload', async (req, res) => {
    const { instance_id, productName, imageBase64 } = req.body;

    if (!instance_id || !productName || !imageBase64) {
        return res.status(400).json({ error: 'Missing required fields (instance_id, productName, imageBase64).' });
    }

    let browser;
    let tempImagePath = null;

    // Helper functions for human-like behavior
    const humanDelay = async (min = 1500, max = 3500) => {
        const ms = Math.floor(Math.random() * (max - min + 1)) + min;
        return new Promise(resolve => setTimeout(resolve, ms));
    };

    try {
        // 1. Prepare the temporary image file
        const os = require('os');
        const tempDir = process.env.USER_DATA_PATH ? path.join(process.env.USER_DATA_PATH, '.temp') : path.join(os.tmpdir(), 'wacopilote_temp');
        if (!fs.existsSync(tempDir)) {
            fs.mkdirSync(tempDir, { recursive: true });
        }

        // Strip out base64 header if present
        const base64Data = imageBase64.replace(/^data:image\/\w+;base64,/, "");
        const fileName = `catalog_product_${Date.now()}.png`;
        tempImagePath = path.join(tempDir, fileName);

        fs.writeFileSync(tempImagePath, base64Data, 'base64');
        console.error(`[Catalog] Saved temporary image to ${tempImagePath} `);

        // 2. Connect to Puppeteer
        browser = await puppeteer.connect({ browserURL: 'http://127.0.0.1:8315', defaultViewport: null });

    } catch (error) {
        if (tempImagePath && fs.existsSync(tempImagePath)) {
            fs.unlinkSync(tempImagePath); // Cleanup on fail
        }
        console.error('Image Error:', error);
        return res.status(500).json({ error: 'Failed writing file.' });
    }

    try {
        const targets = browser.targets();
        let targetPage = null;

        for (const target of targets) {
            if (target.url().includes('web.whatsapp.com') && target.type() === 'webview') {
                try {
                    const page = await target.page();
                    if (page) {
                        const pageInstanceId = await page.evaluate(() => window.__whatsapp_instance_id).catch(() => null);
                        if (pageInstanceId === instance_id) {
                            targetPage = page;
                            break;
                        }
                    }
                } catch { }
            }
        }

        if (!targetPage) {
            throw new Error(`Target Page Context could not be located.Ensure the Webview for instance ${instance_id} is mounted.`);
        }

        console.error(`[Catalog] Connected to instance: ${instance_id} `);

        // --- ADAPTIVE CHECK (avant le contrôle Business) ---
        // Si l'utilisateur est DÉJÀ sur la page « Ajouter un article » (champ
        // fichier présent), son accès au formulaire prouve qu'il s'agit d'un
        // compte Business : on saute alors le contrôle d'icônes, qui serait un
        // faux négatif (le formulaire ouvert ne montre pas le menu catalogue).
        const isAlreadyOnAddItemPage = await (async () => {
            try {
                return !!(await targetPage.$('input[type="file"]'));
            } catch {
                return false;
            }
        })();
        if (isAlreadyOnAddItemPage) {
            console.error(`[Catalog] Adaptive check: User is already on the Add Item page. Skipping navigation.`);
        }

        // 3. Pre-flight Check: Is it a Business Account?
        // Le contrôle est bloquant — publier dans le catalogue d'un compte
        // personnel est précisément le comportement qui déclenche des
        // restrictions de compte. On attend jusqu'à 5 s l'apparition des
        // icônes Business (le DOM de WhatsApp se construit progressivement) ;
        // si elles n'apparaissent pas, le compte n'est pas éligible.
        if (!isAlreadyOnAddItemPage) {
            const businessSelectors = 'span[data-icon="catalog"], span[data-icon="storefront"], span[data-icon="smb-store"], span[data-icon="labels"], span[data-icon="smb-labels-header"]';
            let isBusinessAccount = false;
            try {
                await targetPage.waitForSelector(businessSelectors, { timeout: 5000 });
                isBusinessAccount = true;
            } catch {
                isBusinessAccount = false;
            }

            if (!isBusinessAccount) {
                throw new Error(
                    "SECURITY BLOCK: Cette instance n'est pas un compte WhatsApp Business (icônes catalogue/étiquettes introuvables). " +
                    "Les actions de catalogue ne peuvent pas être exécutées. Connectez-vous avec un compte Business ou ouvrez manuellement le catalogue."
                );
            }
            console.error(`[Catalog] Pre-flight Check Passed: compte Business confirmé.`);
        }

        // In Puppeteer, focus using bringToFront or focus
        await targetPage.bringToFront().catch(() => { });

        try {
            await humanDelay(1000, 2000); // Breathe

            if (!isAlreadyOnAddItemPage) {
                // Click Catalog Icon (could be 'catalog', 'smb-store', or 'storefront')
                const storefrontSelectors = 'span[data-icon="catalog"], span[data-icon="smb-store"], span[data-icon="storefront"]';
                try {
                    await targetPage.waitForSelector(storefrontSelectors, { timeout: 6000 });
                } catch {
                    throw new Error("Veuillez ouvrir la page d'accueil de WhatsApp ou le menu de votre Catalogue avant de publier.");
                }

                await targetPage.evaluate((sel) => {
                    const icon = document.querySelector(sel);
                    if (icon) {
                        const btn = icon.closest('div[role="button"]') || icon.closest('button') || icon;
                        btn.click();
                    }
                }, storefrontSelectors);
                console.error(`[Catalog] Clicked Catalog/Storefront Icon`);

                // Wait a moment for navigation (human reading time)
                await humanDelay(2500, 4500);

                // Step 2: Intermediate Catalogue Click if we are on "Outils professionnels" (Business Tools sidebar)
                await targetPage.evaluate(() => {
                    const spans = Array.from(document.querySelectorAll('span, div'));
                    const catSpan = spans.find(s => {
                        const txt = s.innerText ? s.innerText.trim().toLowerCase() : '';
                        return (txt === 'catalogue' || txt === 'catalog') && s.closest('div[role="button"]');
                    });
                    if (catSpan) {
                        const btn = catSpan.closest('div[role="button"]');
                        btn.click();
                    }
                });
                console.error(`[Catalog] Checked for intermediate Catalogue menu`);

                await humanDelay(2000, 3000);

                // Wait for "Add a new item" button and click using xpath or evaluate
                const clicked = await targetPage.evaluate(() => {
                    // Exact match from user HTML DOM dump
                    const exactAddBtn = document.querySelector(
                        'button[aria-label*="Ajouter un nouvel article"], button[aria-label*="Add a new item"], ' +
                        'div[aria-label*="Ajouter un nouvel article"], div[aria-label*="Add a new item"], ' +
                        'button[title*="Ajouter un nouvel article"], button[title*="Add a new item"]'
                    );

                    if (exactAddBtn) {
                        const btn = exactAddBtn.closest('div[role="button"]') || exactAddBtn.closest('button') || exactAddBtn;
                        btn.click();
                        return 'exact-aria-label';
                    }

                    // Try to find the "Plus" icon used by WhatsApp for adding items
                    const plusIcon = document.querySelector('span[data-icon="plus"]');
                    if (plusIcon) {
                        const btn = plusIcon.closest('div[role="button"]') || plusIcon.closest('button') || plusIcon;
                        btn.click();
                        return 'icon';
                    }

                    // Fallback to text matching: Meta might use a large div without a standard role
                    const allElements = Array.from(document.querySelectorAll('div, span, button'));
                    const addButton = allElements.find(el => {
                        if (el.children.length > 2 && el.tagName !== 'BUTTON') return false; // Avoid matching parent containers
                        const txt = el.innerText ? el.innerText.trim().toLowerCase() : '';
                        return txt === 'add a new item' || txt === 'ajouter un nouvel article' ||
                            txt === 'ajouter un article' || txt === 'add new item';
                    });

                    if (addButton) {
                        const btn = addButton.closest('div[role="button"]') || addButton.closest('button') || addButton;
                        btn.click();
                        return 'text';
                    }

                    return false;
                });

                if (!clicked) {
                    // Log all buttons to figure out what Meta changed it to
                    const allButtons = await targetPage.evaluate(() => Array.from(document.querySelectorAll('button, div[role="button"]')).map(b => b.innerText || b.getAttribute('aria-label')).filter(Boolean));
                    console.error(`[Catalog] Available buttons:`, allButtons);
                    throw new Error("Impossible de trouver le bouton 'Ajouter un article'. Essayez d'ouvrir la page du catalogue manuellement.");
                }
                console.error(`[Catalog] Clicked Add Item Button via ${clicked}`);

                // Wait for form to appear (animation time + human visual register)
                await humanDelay(2500, 4000);
            }

            // We will upload using setInputFiles, wait for input[type="file"]
            const fileInputSelector = 'input[type="file"]';
            await targetPage.waitForSelector(fileInputSelector, { timeout: 10000 });

            const fileInput = await targetPage.$(fileInputSelector);
            if (fileInput) {
                await fileInput.uploadFile(tempImagePath);
                console.error(`[Catalog] Image injected from disk: ${tempImagePath} `);
            } else {
                throw new Error("File input not found in DOM");
            }

            // Wait for image thumbnail to render and load (avoid suspicious speed)
            await humanDelay(3000, 5000);

            // Wait for image thumbnail to render and load (avoid suspicious speed)
            await humanDelay(3000, 5000);

            console.error(`[Catalog] Image upload complete. Handing off to user via Copilot...`);

        } catch (e) {
            console.error("Puppeteer Catalog Interaction Error", e);
            throw new Error(`Catalog interaction failed: ${e.message} `);
        }

        res.json({
            status: 'success',
            message: 'Product successfully pushed to WhatsApp Business Catalog.'
        });

    } catch (error) {
        console.error('Catalog Automation Error:', error);
        res.status(500).json({ error: 'Failed to automate WhatsApp Catalog. Exception: ' + error.message });
    } finally {
        // Le nettoyage doit aussi couvrir le chemin nominal : tant qu'il ne vivait
        // que dans les blocs d'erreur, chaque publication réussie laissait un PNG
        // derrière elle (d'où les fichiers accumulés dans backend/.temp).
        if (tempImagePath && fs.existsSync(tempImagePath)) {
            try {
                fs.unlinkSync(tempImagePath);
            } catch (cleanupErr) {
                console.error('[Catalog] Temp file cleanup failed:', cleanupErr.message);
            }
        }
        if (browser) browser.disconnect();
    }
});
module.exports = router;
