const express = require('express');
const router = express.Router();
const multer = require('multer');
const fs = require('fs');
const path = require('path');
const { pool } = require('../db');


// Endpoint to automatically push an item to WhatsApp Business Catalog via Playwright
router.post('/api/catalog/upload', async (req, res) => {
    const { instance_id, productName, productDescription, productPrice, imageBase64 } = req.body;

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
    const humanTypeDelay = () => Math.floor(Math.random() * (120 - 40 + 1)) + 40;

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
        console.log(`[Catalog] Saved temporary image to ${tempImagePath} `);

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
                } catch (e) { }
            }
        }

        if (!targetPage) {
            throw new Error(`Target Page Context could not be located.Ensure the Webview for instance ${instance_id} is mounted.`);
        }

        console.log(`[Catalog] Connected to instance: ${instance_id} `);

        // 3. Pre-flight Check: Is it a Business Account?
        const isBusinessAccount = await targetPage.evaluate(() => {
            // Business accounts have specific data-icon available on the top header/menu area
            const catalogMenuIcon = document.querySelector('span[data-icon="catalog"], span[data-icon="storefront"], span[data-icon="smb-store"]');
            const labelsIcon = document.querySelector('span[data-icon="labels"], span[data-icon="smb-labels-header"]');
            return !!(catalogMenuIcon || labelsIcon);
        });

        if (!isBusinessAccount) {
            console.warn(`[Catalog] SECURITY WARNING: Business icons ('catalog', 'smb-store', 'labels') not found. Proceeding with caution.`);
            // throw new Error("SECURITY BLOCK: The selected instance is not a WhatsApp Business account. Catalog actions cannot be performed.");
        }

        console.log(`[Catalog] Pre - flight Check Passed.Proceeding with upload...`);

        // In Puppeteer, focus using bringToFront or focus
        await targetPage.bringToFront().catch(() => { });

        try {
            await humanDelay(1000, 2000); // Breathe

            // --- ADAPTIVE CHECK ---
            // If the user is ALREADY on the "Add Item" page, we can skip navigation entirely.
            // We know we are there if the file input already exists.
            let isAlreadyOnAddItemPage = false;
            try {
                const immediateFileInput = await targetPage.$('input[type="file"]');
                if (immediateFileInput) {
                    isAlreadyOnAddItemPage = true;
                    console.log(`[Catalog] Adaptive check: User is already on the Add Item page. Skipping navigation.`);
                }
            } catch (e) {
                // Ignore, we will proceed with normal navigation
            }

            if (!isAlreadyOnAddItemPage) {
                // Click Catalog Icon (could be 'catalog', 'smb-store', or 'storefront')
                const storefrontSelectors = 'span[data-icon="catalog"], span[data-icon="smb-store"], span[data-icon="storefront"]';
                try {
                    await targetPage.waitForSelector(storefrontSelectors, { timeout: 6000 });
                } catch (e) {
                    throw new Error("Veuillez ouvrir la page d'accueil de WhatsApp ou le menu de votre Catalogue avant de publier.");
                }

                await targetPage.evaluate((sel) => {
                    const icon = document.querySelector(sel);
                    if (icon) {
                        const btn = icon.closest('div[role="button"]') || icon.closest('button') || icon;
                        btn.click();
                    }
                }, storefrontSelectors);
                console.log(`[Catalog] Clicked Catalog/Storefront Icon`);

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
                console.log(`[Catalog] Checked for intermediate Catalogue menu`);

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
                console.log(`[Catalog] Clicked Add Item Button via ${clicked}`);

                // Wait for form to appear (animation time + human visual register)
                await humanDelay(2500, 4000);
            }

            // We will upload using setInputFiles, wait for input[type="file"]
            const fileInputSelector = 'input[type="file"]';
            await targetPage.waitForSelector(fileInputSelector, { timeout: 10000 });

            const fileInput = await targetPage.$(fileInputSelector);
            if (fileInput) {
                await fileInput.uploadFile(tempImagePath);
                console.log(`[Catalog] Image injected from disk: ${tempImagePath} `);
            } else {
                throw new Error("File input not found in DOM");
            }

            // Wait for image thumbnail to render and load (avoid suspicious speed)
            await humanDelay(3000, 5000);

            // Wait for image thumbnail to render and load (avoid suspicious speed)
            await humanDelay(3000, 5000);

            console.log(`[Catalog] Image upload complete. Handing off to user via Copilot...`);

        } catch (e) {
            console.error("Puppeteer Catalog Interaction Error", e);
            throw new Error(`Catalog interaction failed: ${e.message} `);
        }

        res.json({
            status: 'success',
            message: 'Product successfully pushed to WhatsApp Business Catalog.'
        });

    } catch (error) {
        if (tempImagePath && fs.existsSync(tempImagePath)) {
            fs.unlinkSync(tempImagePath); // Cleanup on fail
        }
        console.error('Catalog Automation Error:', error);
        res.status(500).json({ error: 'Failed to automate WhatsApp Catalog. Exception: ' + error.message });
    }
});
module.exports = router;
