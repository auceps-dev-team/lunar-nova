const express = require('express');
const router = express.Router();
const { pool } = require('../db');
const puppeteer = require('puppeteer-core');
const { isValidPhoneFormat } = require('../services/contactAgent');
const waInstancesService = require('../services/waInstancesService');

// Mutex global pour sécuriser l'accès concurrentiel à l'instance WhatsApp

// Validation de format des numéros en entrée (open-chat, verify-contact) :
// sans elle, n'importe quelle chaîne — y compris une payload malveillante ou
// malformée — était injectée dans l'URL web.whatsapp.com/send?phone=….
// La règle (8 à 15 chiffres après normalisation) est partagée avec le pipeline
// (backend/services/contactAgent.js) et testée unitairement.
const isValidPhoneInput = isValidPhoneFormat;
const waMutexQueue = [];
let isWaMutexLocked = false;

const acquireWaMutex = () => {
    return new Promise(resolve => {
        if (!isWaMutexLocked) {
            isWaMutexLocked = true;
            resolve();
        } else {
            waMutexQueue.push(resolve);
        }
    });
};

const releaseWaMutex = () => {
    if (waMutexQueue.length > 0) {
        const next = waMutexQueue.shift();
        next();
    } else {
        isWaMutexLocked = false;
    }
};

// --- Instances : miroir en écriture du store Zustand du renderer (voir
// src/App.jsx, src/components/OnboardingModal.jsx) — permet au CLI/MCP de
// lister/piloter les instances sans dépendre de l'état du renderer Electron.
router.get('/instances', async (req, res) => {
    try {
        const data = await waInstancesService.listInstances();
        res.json({ status: 'success', data });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

router.post('/instances', async (req, res) => {
    const { id, name, status } = req.body || {};
    if (!id) return res.status(400).json({ error: 'Missing id.' });
    try {
        const data = await waInstancesService.upsertInstance(id, name, status);
        res.json({ status: 'success', data });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

router.delete('/instances/:id', async (req, res) => {
    try {
        await waInstancesService.removeInstance(req.params.id);
        res.json({ status: 'success' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// --- Phase 13: WhatsApp Contacts APIs ---
router.get('/contact-lists', async (req, res) => {
    try {
        const result = await pool.query('SELECT * FROM wa_contact_lists ORDER BY id DESC');
        res.json({ status: 'success', data: result.rows });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

router.post('/contact-lists', async (req, res) => {
    const { name } = req.body;
    try {
        const result = await pool.query('INSERT INTO wa_contact_lists (name) VALUES ($1) RETURNING *', [name]);
        res.json({ status: 'success', data: result.rows[0] });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

router.put('/contact-lists/:id', async (req, res) => {
    const { name } = req.body;
    try {
        const result = await pool.query('UPDATE wa_contact_lists SET name = $1 WHERE id = $2 RETURNING *', [name, req.params.id]);
        if (result.rows.length === 0) return res.status(404).json({ error: 'List not found' });
        res.json({ status: 'success', data: result.rows[0] });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

router.delete('/contact-lists/:id', async (req, res) => {
    try {
        await pool.query('UPDATE wa_contacts SET list_id = NULL WHERE list_id = $1', [req.params.id]);
        await pool.query('DELETE FROM wa_contact_lists WHERE id = $1', [req.params.id]);
        res.json({ status: 'success', message: 'List deleted' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

router.get('/segments', async (req, res) => {
    try {
        const result = await pool.query('SELECT * FROM wa_segments ORDER BY id DESC');
        res.json({ status: 'success', data: result.rows });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

router.post('/segments', async (req, res) => {
    const { name } = req.body;
    try {
        const result = await pool.query('INSERT INTO wa_segments (name) VALUES ($1) RETURNING *', [name]);
        res.json({ status: 'success', data: result.rows[0] });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

router.put('/segments/:id', async (req, res) => {
    const { name } = req.body;
    try {
        const result = await pool.query('UPDATE wa_segments SET name = $1 WHERE id = $2 RETURNING *', [name, req.params.id]);
        if (result.rows.length === 0) return res.status(404).json({ error: 'Segment not found' });
        res.json({ status: 'success', data: result.rows[0] });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

router.delete('/segments/:id', async (req, res) => {
    try {
        await pool.query('UPDATE wa_contacts SET segment_id = NULL WHERE segment_id = $1', [req.params.id]);
        await pool.query('DELETE FROM wa_segments WHERE id = $1', [req.params.id]);
        res.json({ status: 'success', message: 'Segment deleted' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

router.get('/contacts', async (req, res) => {
    try {
        const result = await pool.query(`
            SELECT c.*, s.name as segment_name, l.name as list_name
            FROM wa_contacts c
            LEFT JOIN wa_segments s ON c.segment_id = s.id
            LEFT JOIN wa_contact_lists l ON c.list_id = l.id
            ORDER BY c.id DESC
        `);
        res.json({ status: 'success', data: result.rows });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

router.post('/contacts/bulk', async (req, res) => {
    const { contacts } = req.body;

    if (!Array.isArray(contacts) || contacts.length === 0) {
        return res.status(400).json({ error: 'No valid contacts provided' });
    }

    const client = await pool.connect();

    try {
        await client.query('BEGIN');

        // Ensure unique index on phone exists (idempotent)
        await client.query(`
            CREATE UNIQUE INDEX IF NOT EXISTS idx_wa_contacts_phone_unique 
            ON wa_contacts (phone) 
            WHERE phone IS NOT NULL AND phone != ''
        `).catch(() => { /* Index may already exist */ });

        let imported = 0;
        let skipped = 0;
        let updated = 0;

        for (const contact of contacts) {
            const { name, phone, segment_name, email, address, list_id, segment_id: explicit_segment_id } = contact;
            
            // Skip contacts without a valid phone number
            if (!phone || phone.trim() === '') {
                skipped++;
                continue;
            }

            let segment_id = explicit_segment_id || null;

            // Auto-resolve segment by name
            if (segment_name && !segment_id) {
                const segCheck = await client.query('SELECT id FROM wa_segments WHERE name = $1', [segment_name]);
                if (segCheck.rows.length > 0) {
                    segment_id = segCheck.rows[0].id;
                } else {
                    const newSeg = await client.query('INSERT INTO wa_segments (name) VALUES ($1) RETURNING id', [segment_name]);
                    segment_id = newSeg.rows[0].id;
                }
            }

            // Check if contact already exists to track import vs update
            const existing = await client.query('SELECT id FROM wa_contacts WHERE phone = $1', [phone]);
            const isNew = existing.rows.length === 0;

            // Insert or update on phone conflict
            await client.query(`
                INSERT INTO wa_contacts (name, phone, segment_id, list_id, email, address) 
                VALUES ($1, $2, $3, $4, $5, $6)
                ON CONFLICT (phone) WHERE phone IS NOT NULL AND phone != ''
                DO UPDATE SET 
                    name = COALESCE(NULLIF(EXCLUDED.name, ''), wa_contacts.name),
                    segment_id = COALESCE(EXCLUDED.segment_id, wa_contacts.segment_id),
                    list_id = COALESCE(EXCLUDED.list_id, wa_contacts.list_id),
                    email = COALESCE(NULLIF(EXCLUDED.email, ''), wa_contacts.email),
                    address = COALESCE(NULLIF(EXCLUDED.address, ''), wa_contacts.address)
            `, [name || 'Inconnu', phone, segment_id, list_id || null, email || null, address || null]);

            if (isNew) {
                imported++;
            } else {
                updated++;
            }
        }

        await client.query('COMMIT');
        res.json({ 
            status: 'success', 
            imported, 
            updated,
            skipped,
            message: `${imported} nouveaux contacts, ${updated} mis à jour, ${skipped} ignorés (sans téléphone)`
        });
    } catch (err) {
        await client.query('ROLLBACK');
        console.error("Bulk Import Error: ", err);
        res.status(500).json({ error: 'Database error during bulk insert', details: err.message });
    } finally {
        client.release();
    }
});

router.post('/contacts', async (req, res) => {
    const { name, phone, list_id, segment_id, email, address } = req.body;
    try {
        const result = await pool.query(
            'INSERT INTO wa_contacts (name, phone, list_id, segment_id, email, address) VALUES ($1, $2, $3, $4, $5, $6) RETURNING *',
            [name, phone, list_id || null, segment_id || null, email || null, address || null]
        );
        res.json({ status: 'success', data: result.rows[0] });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

router.get('/contacts/:id', async (req, res) => {
    try {
        const result = await pool.query('SELECT * FROM wa_contacts WHERE id = $1', [req.params.id]);
        if (result.rows.length === 0) return res.status(404).json({ error: 'Not found' });
        res.json({ status: 'success', data: result.rows[0] });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});



router.put('/contacts/bulk-update', async (req, res) => {
    const { contactIds, segmentId } = req.body;
    if (!Array.isArray(contactIds) || contactIds.length === 0) {
        return res.status(400).json({ error: 'contactIds array is required and cannot be empty' });
    }

    try {
        // Build parameterized query for the IN clause
        const idPlaceholders = contactIds.map((_, i) => `$${i + 2}`).join(',');
        const query = `
            UPDATE wa_contacts 
            SET segment_id = $1 
            WHERE id IN (${idPlaceholders}) 
            RETURNING *
        `;

        const values = [segmentId || null, ...contactIds];
        const result = await pool.query(query, values);

        console.error(`[WA] Bulk updated ${result.rowCount} contacts`);
        res.json({ status: 'success', data: result.rows, updatedCount: result.rowCount });
    } catch (err) {
        console.error('[WA] Error bulk updating contacts:', err);
        res.status(500).json({ error: err.message });
    }
});

router.put('/contacts/bulk-update-list', async (req, res) => {
    const { contactIds, listId } = req.body;
    if (!Array.isArray(contactIds) || contactIds.length === 0) {
        return res.status(400).json({ error: 'contactIds array is required and cannot be empty' });
    }

    try {
        const idPlaceholders = contactIds.map((_, i) => `$${i + 2}`).join(',');
        const query = `
            UPDATE wa_contacts 
            SET list_id = $1 
            WHERE id IN (${idPlaceholders}) 
            RETURNING *
        `;

        const values = [listId || null, ...contactIds];
        const result = await pool.query(query, values);

        console.error(`[WA] Bulk updated lists for ${result.rowCount} contacts`);
        res.json({ status: 'success', data: result.rows, updatedCount: result.rowCount });
    } catch (err) {
        console.error('[WA] Error bulk updating lists:', err);
        res.status(500).json({ error: err.message });
    }
});

router.put('/contacts/:id', async (req, res) => {
    const { name, phone, list_id, segment_id, email, address } = req.body;
    try {
        // Try with email/address columns first
        const result = await pool.query(
            'UPDATE wa_contacts SET name = $1, phone = $2, list_id = $3, segment_id = $4, email = $5, address = $6 WHERE id = $7 RETURNING *',
            [name, phone, list_id || null, segment_id || null, email || null, address || null, req.params.id]
        );
        console.error(`[WA] Updated contact ${req.params.id}`);
        res.json({ status: 'success', data: result.rows[0] });
    } catch (err) {
        // Fallback: if email/address columns don't exist yet
        if (err.message?.includes('column') && (err.message?.includes('email') || err.message?.includes('address'))) {
            try {
                const result = await pool.query(
                    'UPDATE wa_contacts SET name = $1, phone = $2, list_id = $3, segment_id = $4 WHERE id = $5 RETURNING *',
                    [name, phone, list_id || null, segment_id || null, req.params.id]
                );
                console.error(`[WA] Updated contact ${req.params.id} (legacy mode)`);
                res.json({ status: 'success', data: result.rows[0] });
            } catch (err2) {
                console.error(`[WA] Error updating contact:`, err2);
                res.status(500).json({ error: err2.message });
            }
        } else {
            console.error(`[WA] Error updating contact:`, err);
            res.status(500).json({ error: err.message });
        }
    }
});

router.delete('/contacts/bulk-delete', async (req, res) => {
    const { contactIds } = req.body;
    if (!Array.isArray(contactIds) || contactIds.length === 0) {
        return res.status(400).json({ error: 'contactIds array is required and cannot be empty' });
    }

    try {
        const idPlaceholders = contactIds.map((_, i) => `$${i + 1}`).join(',');
        const query = `DELETE FROM wa_contacts WHERE id IN (${idPlaceholders})`;

        const result = await pool.query(query, contactIds);

        console.error(`[WA] Bulk deleted ${result.rowCount} contacts`);
        res.json({ status: 'success', deletedCount: result.rowCount });
    } catch (err) {
        console.error('[WA] Error bulk deleting contacts:', err);
        res.status(500).json({ error: err.message });
    }
});

router.delete('/contacts/:id', async (req, res) => {
    try {
        await pool.query('DELETE FROM wa_contacts WHERE id = $1', [req.params.id]);
        res.json({ status: 'success', message: 'Deleted' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

router.post('/open-chat', async (req, res) => {
    const { instance_id, phone, contact_id, country_code, text } = req.body;
    if (!instance_id || !phone) return res.status(400).json({ error: 'Missing instance_id or phone' });
    if (!isValidPhoneInput(phone)) {
        return res.status(400).json({ error: 'Numéro de téléphone invalide (8 à 15 chiffres attendus).' });
    }

    try {
        const result = await waInstancesService.openChat({
            instanceId: instance_id,
            phone,
            contactId: contact_id,
            countryCode: country_code,
            text
        });
        res.json({ status: 'success', ...result });
    } catch (err) {
        console.error("Open chat error:", err);
        res.status(err.statusCode || 500).json({ error: err.message });
    }
});

router.post('/verify-contact', async (req, res) => {
    const { instance_id, contact_id, phone, country_code } = req.body;

    if (!instance_id || !phone) {
        return res.status(400).json({ error: 'Missing required fields (instance_id, phone).' });
    }
    if (!isValidPhoneInput(phone)) {
        return res.status(400).json({ error: 'Numéro de téléphone invalide (8 à 15 chiffres attendus).' });
    }

    /**
     * Écrit le statut de vérification sur le contact concerné.
     *
     * Avec `contact_id` la cible est exacte. Sans lui, on retombe sur un
     * rapprochement par suffixe de numéro — mais borné à UNE ligne : la version
     * précédente faisait un UPDATE ... WHERE phone LIKE '%<9 chiffres>%' sans
     * limite, qui réécrivait le statut de tous les contacts partageant ces
     * chiffres (numéros avec/sans indicatif, doublons de listes importées).
     */
    const markContactStatus = async (status, cleanPhone) => {
        try {
            if (contact_id) {
                await pool.query('UPDATE wa_contacts SET status = $1 WHERE id = $2', [status, contact_id]);
            } else {
                await pool.query(
                    'UPDATE wa_contacts SET status = $1 WHERE id = (SELECT id FROM wa_contacts WHERE phone LIKE $2 LIMIT 1)',
                    [status, `%${cleanPhone.slice(-9)}`]
                );
            }
        } catch (dbErr) {
            console.error('DB Update Error:', dbErr);
        }
    };

    const startTime = Date.now();
    const logTime = (msg) => console.error(`[Verifier] [${((Date.now() - startTime) / 1000).toFixed(1)}s] ${msg}`);

    let browser;
    try {
        logTime(`Waiting for Mutex...`);
        await acquireWaMutex();
        logTime(`Mutex acquired. Connecting to CDP...`);
        const cdpUrl = `http://localhost:8315`;
        browser = await puppeteer.connect({
            browserURL: cdpUrl,
            defaultViewport: null
        });

        const targets = await browser.targets();
        let targetPage = null;

        for (const target of targets) {
            if (target.type() === 'webview' && target.url().includes('whatsapp')) {
                const p = await target.page();
                if (p) {
                    try {
                        const id = await p.evaluate(() => window.__whatsapp_instance_id);
                        if (id === instance_id) {
                            targetPage = p;
                            break;
                        }
                    } catch { }
                    if (!targetPage) targetPage = p;
                }
            }
        }

        if (!targetPage) {
            browser.disconnect();
            logTime(`Not Found: Could not find WhatsApp Web tab.`);
            return res.status(404).json({ error: `Not Found: Could not find WhatsApp Web tab for instance_id: ${instance_id}` });
        }

        const hasInternationalPrefix = /^\s*\+/.test(phone);
        let cleanPhone = phone.replace(/[^0-9]/g, '');
        if (!hasInternationalPrefix && country_code && country_code !== 'none' && !cleanPhone.startsWith(country_code)) {
            cleanPhone = country_code + cleanPhone;
        }
        
        logTime(`Navigating to URL for ${cleanPhone}...`);
        const verifyUrl = `https://web.whatsapp.com/send/?phone=${cleanPhone}`;

        // First, dismiss any lingering OK modal from a previous contact check
        try {
            await targetPage.evaluate(() => {
                const buttons = document.querySelectorAll('button');
                for (const btn of buttons) {
                    const t = (btn.innerText || btn.textContent || '').trim().toUpperCase();
                    if (t === 'OK') { btn.click(); break; }
                }
            });
            await new Promise(r => setTimeout(r, 300));
        } catch { }

        try {
            logTime(`Starting targetPage.goto...`);
            await targetPage.goto(verifyUrl, { waitUntil: 'domcontentloaded', timeout: 10000 });
            logTime(`targetPage.goto OK.`);
        } catch (gotoErr) {
            logTime(`Navigation lente ou erreur goto (${gotoErr.message}), mais on continue...`);
        }

        logTime(`Racing chatbox vs error modal...`);

        let result = 'TIMEOUT';
        const deadline = Date.now() + 18000; // 18s max

        while (Date.now() < deadline) {
            await new Promise(r => setTimeout(r, 600));
            try {
                const state = await targetPage.evaluate(() => {
                    // Valid chat: conversation panel visible
                    if (document.querySelector('#main header, #main footer, [data-testid="conversation-panel-wrapper"], div[title="Type a message"], div[title="Tapez un message"]')) {
                        return 'VALIDE';
                    }
                    // Error modal
                    const modalBody = document.querySelector('[data-animate-modal-body="true"]');
                    if (modalBody) {
                        const text = (modalBody.innerText || modalBody.textContent || '').toLowerCase();
                        if (text.includes("n'est pas sur whatsapp") || text.includes("is not on whatsapp") || text.includes("invalide") || text.includes("phone number")) {
                            // Dismiss modal
                            const buttons = document.querySelectorAll('button');
                            for (const btn of buttons) {
                                const t = (btn.innerText || btn.textContent || '').trim().toUpperCase();
                                if (t === 'OK') { btn.click(); break; }
                            }
                            return 'INVALIDE';
                        }
                    }
                    return 'PENDING';
                });
                if (state === 'VALIDE' || state === 'INVALIDE') {
                    result = state;
                    break;
                }
            } catch {
                // Execution context destroyed (page navigating) — wait and retry
                console.warn('[Verifier] Context destroyed, waiting...');
                await new Promise(r => setTimeout(r, 800));
            }
        }
        
        logTime(`Loop finished. Result: ${result}`);

        if (result === 'VALIDE') {
            logTime(`✅ Le numéro ${cleanPhone} est valide.`);
            await markContactStatus('valid', cleanPhone);
            res.json({ status: 'success', is_valid: true, message: `The number ${cleanPhone} is registered on WhatsApp.` });
        } else if (result === 'INVALIDE') {
            logTime(`❌ Le numéro ${cleanPhone} n'est pas sur WhatsApp.`);
            await markContactStatus('invalid', cleanPhone);
            res.json({ status: 'success', is_valid: false, message: `The number ${cleanPhone} is NOT registered on WhatsApp.` });
        } else if (result === 'TIMEOUT') {
            logTime(`❌ Timeout vérification.`);
            res.json({ status: 'success', is_valid: false, message: `Timeout vérification pour ${cleanPhone}` });
        }

    } catch (error) {
        logTime(`Erreur globale: ${error.message}`);
        res.status(500).json({ error: 'System error during WhatsApp validation.', details: error.message });
    } finally {
        logTime(`Cleaning up (browser disconnect, mutex release)...`);
        if (browser) browser.disconnect();
        releaseWaMutex();
        logTime(`Done.`);
    }
});

// --- Phase 19.5: Contact Analytics Endpoint ---
router.get('/analytics', async (req, res) => {
    try {
        const totalRes = await pool.query('SELECT COUNT(*) as count FROM wa_contacts');
        const segmentRes = await pool.query(`
            SELECT s.name, COUNT(c.id) as count 
            FROM wa_segments s 
            LEFT JOIN wa_contacts c ON s.id = c.segment_id 
            GROUP BY s.id, s.name
        `);
        const listRes = await pool.query(`
            SELECT l.name, COUNT(c.id) as count 
            FROM wa_contact_lists l 
            LEFT JOIN wa_contacts c ON l.id = c.list_id 
            GROUP BY l.id, l.name
        `);
        const statusRes = await pool.query(`
            SELECT status, COUNT(id) as count 
            FROM wa_contacts 
            GROUP BY status
        `);
        const messagesRes = await pool.query('SELECT COUNT(*) as count FROM wa_message_logs');

        // AI Consumption Statistics
        const aiProviderRes = await pool.query('SELECT provider, COUNT(id) as count FROM copilot_logs GROUP BY provider');
        const aiModelRes = await pool.query('SELECT model, COUNT(id) as count FROM copilot_logs GROUP BY model');
        const aiRecentRes = await pool.query("SELECT date(created_at) as date, COUNT(id) as count FROM copilot_logs WHERE created_at >= date('now', '-7 days') GROUP BY date(created_at) ORDER BY date(created_at) ASC");

        res.json({
            status: 'success',
            data: {
                totalContacts: parseInt(totalRes.rows[0]?.count || 0, 10),
                bySegment: segmentRes.rows.map(r => ({ name: r.name, count: parseInt(r.count, 10) })),
                byList: listRes.rows.map(r => ({ name: r.name, count: parseInt(r.count, 10) })),
                byStatus: statusRes.rows.map(r => ({ name: r.status, count: parseInt(r.count, 10) })),
                totalMessagesSent: parseInt(messagesRes.rows[0]?.count || 0, 10),
                aiByProvider: aiProviderRes.rows.map(r => ({ name: r.provider || 'unknown', count: parseInt(r.count, 10) })),
                aiByModel: aiModelRes.rows.map(r => ({ name: r.model || 'unknown', count: parseInt(r.count, 10) })),
                aiRecentActivity: aiRecentRes.rows.map(r => ({ date: r.date, count: parseInt(r.count, 10) }))
            }
        });
    } catch (err) {
        console.error('[WA] Error fetching analytics:', err);
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;
