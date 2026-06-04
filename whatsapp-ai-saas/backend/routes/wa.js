const express = require('express');
const router = express.Router();
const { pool } = require('../db');
const puppeteer = require('puppeteer-core');


// --- Phase 13: WhatsApp Contacts APIs ---
router.get('/api/wa/contact-lists', async (req, res) => {
    try {
        const result = await pool.query('SELECT * FROM wa_contact_lists ORDER BY id DESC');
        res.json({ status: 'success', data: result.rows });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

router.post('/api/wa/contact-lists', async (req, res) => {
    const { name } = req.body;
    try {
        const result = await pool.query('INSERT INTO wa_contact_lists (name) VALUES ($1) RETURNING *', [name]);
        res.json({ status: 'success', data: result.rows[0] });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

router.put('/api/wa/contact-lists/:id', async (req, res) => {
    const { name } = req.body;
    try {
        const result = await pool.query('UPDATE wa_contact_lists SET name = $1 WHERE id = $2 RETURNING *', [name, req.params.id]);
        if (result.rows.length === 0) return res.status(404).json({ error: 'List not found' });
        res.json({ status: 'success', data: result.rows[0] });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

router.delete('/api/wa/contact-lists/:id', async (req, res) => {
    try {
        await pool.query('UPDATE wa_contacts SET list_id = NULL WHERE list_id = $1', [req.params.id]);
        await pool.query('DELETE FROM wa_contact_lists WHERE id = $1', [req.params.id]);
        res.json({ status: 'success', message: 'List deleted' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

router.get('/api/wa/segments', async (req, res) => {
    try {
        const result = await pool.query('SELECT * FROM wa_segments ORDER BY id DESC');
        res.json({ status: 'success', data: result.rows });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

router.post('/api/wa/segments', async (req, res) => {
    const { name } = req.body;
    try {
        const result = await pool.query('INSERT INTO wa_segments (name) VALUES ($1) RETURNING *', [name]);
        res.json({ status: 'success', data: result.rows[0] });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

router.put('/api/wa/segments/:id', async (req, res) => {
    const { name } = req.body;
    try {
        const result = await pool.query('UPDATE wa_segments SET name = $1 WHERE id = $2 RETURNING *', [name, req.params.id]);
        if (result.rows.length === 0) return res.status(404).json({ error: 'Segment not found' });
        res.json({ status: 'success', data: result.rows[0] });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

router.delete('/api/wa/segments/:id', async (req, res) => {
    try {
        await pool.query('UPDATE wa_contacts SET segment_id = NULL WHERE segment_id = $1', [req.params.id]);
        await pool.query('DELETE FROM wa_segments WHERE id = $1', [req.params.id]);
        res.json({ status: 'success', message: 'Segment deleted' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

router.get('/api/wa/contacts', async (req, res) => {
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

router.post('/api/wa/contacts/bulk', async (req, res) => {
    const { contacts } = req.body;

    if (!Array.isArray(contacts) || contacts.length === 0) {
        return res.status(400).json({ error: 'No valid contacts provided' });
    }

    const client = await pool.connect();

    try {
        await client.query('BEGIN');

        for (const contact of contacts) {
            const { name, phone, segment_name, email, address, list_id, segment_id: explicit_segment_id } = contact;
            let segment_id = explicit_segment_id || null;

            // Simple Auto-Resolution: if a segment is typed (and no explicit segment_id), find or create it
            if (segment_name && !segment_id) {
                const segCheck = await client.query('SELECT id FROM wa_segments WHERE name = $1', [segment_name]);
                if (segCheck.rows.length > 0) {
                    segment_id = segCheck.rows[0].id;
                } else {
                    const newSeg = await client.query('INSERT INTO wa_segments (name) VALUES ($1) RETURNING id', [segment_name]);
                    segment_id = newSeg.rows[0].id;
                }
            }

            // Insert the contact
            await client.query(
                'INSERT INTO wa_contacts (name, phone, segment_id, list_id, email, address) VALUES ($1, $2, $3, $4, $5, $6)',
                [name || 'Inconnu', phone || '', segment_id, list_id || null, email || null, address || null]
            );
        }

        await client.query('COMMIT');
        res.json({ status: 'success', imported: contacts.length });
    } catch (err) {
        await client.query('ROLLBACK');
        console.error("Bulk Import Error: ", err);
        res.status(500).json({ error: 'Database error during bulk insert', details: err.message });
    } finally {
        client.release();
    }
});

router.post('/api/wa/contacts', async (req, res) => {
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

router.get('/api/wa/contacts/:id', async (req, res) => {
    try {
        const result = await pool.query('SELECT * FROM wa_contacts WHERE id = $1', [req.params.id]);
        if (result.rows.length === 0) return res.status(404).json({ error: 'Not found' });
        res.json({ status: 'success', data: result.rows[0] });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});



router.put('/api/wa/contacts/bulk-update', async (req, res) => {
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

        console.log(`[WA] Bulk updated ${result.rowCount} contacts`);
        res.json({ status: 'success', data: result.rows, updatedCount: result.rowCount });
    } catch (err) {
        console.error('[WA] Error bulk updating contacts:', err);
        res.status(500).json({ error: err.message });
    }
});

router.put('/api/wa/contacts/bulk-update-list', async (req, res) => {
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

        console.log(`[WA] Bulk updated lists for ${result.rowCount} contacts`);
        res.json({ status: 'success', data: result.rows, updatedCount: result.rowCount });
    } catch (err) {
        console.error('[WA] Error bulk updating lists:', err);
        res.status(500).json({ error: err.message });
    }
});

router.put('/api/wa/contacts/:id', async (req, res) => {
    const { name, phone, list_id, segment_id, email, address } = req.body;
    try {
        // Try with email/address columns first
        const result = await pool.query(
            'UPDATE wa_contacts SET name = $1, phone = $2, list_id = $3, segment_id = $4, email = $5, address = $6 WHERE id = $7 RETURNING *',
            [name, phone, list_id || null, segment_id || null, email || null, address || null, req.params.id]
        );
        console.log(`[WA] Updated contact ${req.params.id}`);
        res.json({ status: 'success', data: result.rows[0] });
    } catch (err) {
        // Fallback: if email/address columns don't exist yet
        if (err.message?.includes('column') && (err.message?.includes('email') || err.message?.includes('address'))) {
            try {
                const result = await pool.query(
                    'UPDATE wa_contacts SET name = $1, phone = $2, list_id = $3, segment_id = $4 WHERE id = $5 RETURNING *',
                    [name, phone, list_id || null, segment_id || null, req.params.id]
                );
                console.log(`[WA] Updated contact ${req.params.id} (legacy mode)`);
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

router.delete('/api/wa/contacts/bulk-delete', async (req, res) => {
    const { contactIds } = req.body;
    if (!Array.isArray(contactIds) || contactIds.length === 0) {
        return res.status(400).json({ error: 'contactIds array is required and cannot be empty' });
    }

    try {
        const idPlaceholders = contactIds.map((_, i) => `$${i + 1}`).join(',');
        const query = `DELETE FROM wa_contacts WHERE id IN (${idPlaceholders})`;

        const result = await pool.query(query, contactIds);

        console.log(`[WA] Bulk deleted ${result.rowCount} contacts`);
        res.json({ status: 'success', deletedCount: result.rowCount });
    } catch (err) {
        console.error('[WA] Error bulk deleting contacts:', err);
        res.status(500).json({ error: err.message });
    }
});

router.delete('/api/wa/contacts/:id', async (req, res) => {
    try {
        await pool.query('DELETE FROM wa_contacts WHERE id = $1', [req.params.id]);
        res.json({ status: 'success', message: 'Deleted' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

router.post('/api/wa/open-chat', async (req, res) => {
    const { instance_id, phone, contact_id } = req.body;
    if (!instance_id || !phone) return res.status(400).json({ error: 'Missing instance_id or phone' });

    let formattedMessage = '';

    try {
        if (contact_id) {
            const contactRes = await pool.query('SELECT * FROM wa_contacts WHERE id = $1', [contact_id]);
            const settingsRes = await pool.query("SELECT setting_value FROM app_settings WHERE setting_key = 'dynamic_message_template'");
            if (contactRes.rows.length > 0 && settingsRes.rows.length > 0) {
                const contact = contactRes.rows[0];
                const template = settingsRes.rows[0].setting_value;
                if (template) {
                    formattedMessage = template
                        .replace(/\[Nom\]/gi, contact.name || '')
                        .replace(/\[Email\]/gi, contact.email || '')
                        .replace(/\[Adresse\]/gi, contact.address || '');
                }
            }

            // Phase 19.5: Message Tracking
            try {
                await pool.query(
                    'INSERT INTO wa_message_logs (contact_id, message) VALUES ($1, $2)',
                    [contact_id, formattedMessage || 'Direct link manually opened']
                );
            } catch (logErr) {
                console.error('[WA] Silently caught error logging message:', logErr);
            }
        }
    } catch (dbErr) {
        console.error("Error formatting template", dbErr);
    }

    let browser;
    try {
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
                    } catch (e) { }
                    if (!targetPage) targetPage = p;
                }
            }
        }

        if (!targetPage) {
            browser.disconnect();
            return res.status(404).json({ error: 'WhatsApp instance not found or not ready.' });
        }

        // Clean phone number (e.g. 2250707070707, numbers only)
        const cleanPhone = phone.replace(/[^0-9]/g, '');
        const url = `https://web.whatsapp.com/send?phone=${cleanPhone}`;
        await targetPage.goto(url);

        res.json({ status: 'success', message: 'Chat opened', formattedMessage });
    } catch (err) {
        console.error("Open chat error:", err);
        res.status(500).json({ error: err.message });
    } finally {
        if (browser) browser.disconnect();
    }
});

router.post('/api/wa/verify-contact', async (req, res) => {
    const { instance_id, phone } = req.body;

    if (!instance_id || !phone) {
        return res.status(400).json({ error: 'Missing required fields (instance_id, phone).' });
    }

    let browser;
    try {
        const cdpUrl = `http://localhost:8315`;
        console.log(`[Verifier] Trying to connect to Electron CDP for whatsapp instance...`);
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
                    } catch (e) { }
                    if (!targetPage) targetPage = p;
                }
            }
        }

        if (!targetPage) {
            browser.disconnect();
            return res.status(404).json({ error: `Not Found: Could not find WhatsApp Web tab for instance_id: ${instance_id}` });
        }

        console.log(`[Verifier] Navigating to WhatsApp send URL for phone: ${phone}`);
        const cleanPhone = phone.replace(/[^0-9]/g, '');
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
        } catch (_) { }

        await targetPage.goto(verifyUrl, { waitUntil: 'domcontentloaded', timeout: 15000 });

        console.log(`[Verifier] Racing chatbox vs error modal...`);

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
            } catch (evalErr) {
                // Execution context destroyed (page navigating) — wait and retry
                console.warn('[Verifier] Context destroyed, waiting...');
                await new Promise(r => setTimeout(r, 800));
            }
        }

        if (result === 'VALIDE') {
            console.log(`✅ [Verifier] Le numéro ${cleanPhone} est valide.`);
            try {
                // Try to update DB. Using LIKE handles cases where DB has + prefix
                await pool.query('UPDATE wa_contacts SET status = ? WHERE phone LIKE ?', ['valid', `%${cleanPhone}%`]);
            } catch (dbErr) { console.error('DB Update Error:', dbErr); }
            res.json({ status: 'success', is_valid: true, message: `The number ${cleanPhone} is registered on WhatsApp.` });
        } else {
            console.log(`❌ [Verifier] Le numéro ${cleanPhone} n'est pas sur WhatsApp. (${result})`);
            try {
                await pool.query('UPDATE wa_contacts SET status = ? WHERE phone LIKE ?', ['invalid', `%${cleanPhone}%`]);
            } catch (dbErr) { console.error('DB Update Error:', dbErr); }
            res.json({ status: 'success', is_valid: false, message: `The number ${cleanPhone} is NOT registered on WhatsApp.` });
        }

    } catch (error) {
        console.error(`[Verifier] Erreur globale de vérification: ${error.message}`);
        res.status(500).json({ error: 'System error during WhatsApp validation.', details: error.message });
    } finally {
        if (browser) browser.disconnect();
    }
});

// Nodemon trigger

// Nodemon trigger

// --- Phase 19.5: Contact Analytics Endpoint ---
router.get('/api/wa/analytics', async (req, res) => {
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
