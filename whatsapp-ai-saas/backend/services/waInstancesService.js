const { pool } = require('../db');
const puppeteer = require('puppeteer-core');
const { isValidPhoneFormat } = require('./contactAgent');

// Mutex local au process : protège les navigations concurrentes de webview
// lancées par CE process (Express ou CLI). Un CLI et le serveur Express
// tournant dans deux process séparés ne peuvent pas se coordonner via un
// mutex en mémoire — limitation acceptée, cohérente avec le fait que ces
// deux usages sont rarement simultanés en pratique.
const mutexQueue = [];
let mutexLocked = false;
const acquireMutex = () => new Promise((resolve) => {
    if (!mutexLocked) { mutexLocked = true; resolve(); }
    else mutexQueue.push(resolve);
});
const releaseMutex = () => {
    if (mutexQueue.length > 0) mutexQueue.shift()();
    else mutexLocked = false;
};

async function listInstances() {
    const result = await pool.query('SELECT * FROM wa_instances ORDER BY last_seen_at DESC');
    return result.rows;
}

/**
 * Enregistre/rafraîchit une instance. Appelé en write-through par le renderer
 * (src/App.jsx, OnboardingModal.jsx) à la création/suppression d'une instance,
 * pour que la table reflète l'état réel du store Zustand côté UI.
 */
async function upsertInstance(id, name, status = 'offline') {
    // Le shim SQLite (backend/db.js) convertit chaque $N en '?' positionnel
    // indépendamment : réutiliser $2/$3 (valide en Postgres) désaligne les
    // valeurs liées dès qu'un placeholder apparaît plus d'une fois. Chaque
    // paramètre a donc son propre numéro, y compris répété dans le tableau.
    const finalName = name || id;
    const result = await pool.query(
        `INSERT INTO wa_instances (id, name, status, last_seen_at)
         VALUES ($1, $2, $3, CURRENT_TIMESTAMP)
         ON CONFLICT (id) DO UPDATE SET name = $4, status = $5, last_seen_at = CURRENT_TIMESTAMP
         RETURNING *`,
        [id, finalName, status, finalName, status]
    );
    return result.rows[0];
}

async function removeInstance(id) {
    await pool.query('DELETE FROM wa_instances WHERE id = $1', [id]);
    return { success: true };
}

/**
 * Ouvre une conversation WhatsApp sur une instance déjà authentifiée, via le
 * pont CDP partagé (localhost:8315) — extrait de backend/routes/wa.js
 * (POST /open-chat) pour être appelable in-process par le CLI/MCP sans
 * dépendre du serveur Express.
 */
async function openChat({ instanceId, phone, contactId, countryCode, text }) {
    if (!instanceId || !phone) {
        const err = new Error('instanceId et phone sont obligatoires.');
        err.statusCode = 400;
        throw err;
    }
    if (!isValidPhoneFormat(phone)) {
        const err = new Error('Numéro de téléphone invalide (8 à 15 chiffres attendus).');
        err.statusCode = 400;
        throw err;
    }

    let formattedMessage = text || '';

    if (contactId && !text) {
        try {
            const contactRes = await pool.query('SELECT * FROM wa_contacts WHERE id = $1', [contactId]);
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
        } catch (dbErr) {
            console.error('[WaInstancesService] Erreur formatage du template:', dbErr);
        }
    }

    if (contactId) {
        try {
            await pool.query(
                'INSERT INTO wa_message_logs (contact_id, message) VALUES ($1, $2)',
                [contactId, formattedMessage || 'Direct link manually opened']
            );
        } catch (logErr) {
            console.error('[WaInstancesService] Erreur silencieuse de log de message:', logErr);
        }
    }

    let browser;
    try {
        await acquireMutex();
        browser = await puppeteer.connect({ browserURL: 'http://localhost:8315', defaultViewport: null });

        const targets = await browser.targets();
        let targetPage = null;
        for (const target of targets) {
            if (target.type() === 'webview' && target.url().includes('whatsapp')) {
                const p = await target.page();
                if (p) {
                    try {
                        const id = await p.evaluate(() => window.__whatsapp_instance_id);
                        if (id === instanceId) {
                            targetPage = p;
                            break;
                        }
                    } catch { /* target evaluation failed, skip */ }
                    if (!targetPage) targetPage = p;
                }
            }
        }

        if (!targetPage) {
            const err = new Error('WhatsApp instance not found or not ready.');
            err.statusCode = 404;
            throw err;
        }

        const hasInternationalPrefix = /^\s*\+/.test(phone);
        let cleanPhone = phone.replace(/[^0-9]/g, '');
        if (!hasInternationalPrefix && countryCode && countryCode !== 'none' && !cleanPhone.startsWith(countryCode)) {
            cleanPhone = countryCode + cleanPhone;
        }
        let url = `https://web.whatsapp.com/send?phone=${cleanPhone}`;
        if (formattedMessage) {
            url += `&text=${encodeURIComponent(formattedMessage)}`;
        }
        await targetPage.goto(url);

        return { message: 'Chat opened', formattedMessage };
    } catch (err) {
        if (!err.statusCode) {
            const wrapped = new Error(err.message);
            wrapped.statusCode = 502;
            throw wrapped;
        }
        throw err;
    } finally {
        if (browser) browser.disconnect();
        releaseMutex();
    }
}

module.exports = { listInstances, upsertInstance, removeInstance, openChat };
