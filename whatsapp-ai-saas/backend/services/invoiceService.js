const fs = require('fs');
const path = require('path');
const { pathToFileURL } = require('url');
const { pool } = require('../db');

function calcTotal(items, taxRate = 0) {
    const sub = (items || []).reduce((s, i) => s + (i.qty || 0) * (i.price || 0), 0);
    return sub + sub * ((taxRate || 0) / 100);
}

function rowToInvoice(row) {
    if (!row) return null;
    let data = {};
    try {
        data = JSON.parse(row.data || '{}');
    } catch {
        data = {};
    }
    return {
        ...data,
        id: row.id,
        invoiceNumber: row.invoice_number || data.invoiceNumber,
        clientName: row.client_name ?? data.clientName,
        status: row.status || data.status || 'draft',
        totalAmount: Number(row.total_amount) || 0,
        createdAt: row.created_at,
        updatedAt: row.updated_at
    };
}

async function listInvoices() {
    const result = await pool.query('SELECT * FROM quotes ORDER BY updated_at DESC, id DESC');
    return result.rows.map(rowToInvoice);
}

async function getInvoice(id) {
    const result = await pool.query('SELECT * FROM quotes WHERE id = $1', [id]);
    if (result.rows.length === 0) {
        const err = new Error('Devis introuvable.');
        err.statusCode = 404;
        throw err;
    }
    return rowToInvoice(result.rows[0]);
}

async function createInvoice(draft = {}) {
    const total = calcTotal(draft.items, draft.taxRate);
    const result = await pool.query(
        `INSERT INTO quotes (invoice_number, client_name, total_amount, status, data)
         VALUES ($1, $2, $3, $4, $5) RETURNING *`,
        [draft.invoiceNumber || null, draft.clientName || null, total, draft.status || 'draft', JSON.stringify(draft)]
    );
    return rowToInvoice(result.rows[0]);
}

async function updateInvoice(id, draft = {}) {
    const total = calcTotal(draft.items, draft.taxRate);
    const result = await pool.query(
        `UPDATE quotes
         SET invoice_number = $1, client_name = $2, total_amount = $3, status = $4, data = $5, updated_at = CURRENT_TIMESTAMP
         WHERE id = $6
         RETURNING *`,
        [draft.invoiceNumber || null, draft.clientName || null, total, draft.status || 'draft', JSON.stringify(draft), id]
    );
    if (result.rows.length === 0) {
        const err = new Error('Devis introuvable.');
        err.statusCode = 404;
        throw err;
    }
    return rowToInvoice(result.rows[0]);
}

async function deleteInvoice(id) {
    await pool.query('DELETE FROM quotes WHERE id = $1', [id]);
    return { success: true };
}

/**
 * Génère le PDF d'un devis en réutilisant le même template HTML que l'éditeur
 * (src/components/invoice/buildInvoiceHTML.js, module ESM chargé dynamiquement
 * — aucune duplication de template).
 *
 * Rendu via un Chromium headless indépendant (playwright, déjà utilisé par
 * backend/scrapers/googleMapScraper.js) plutôt que via le pont CDP partagé de
 * l'app Electron (localhost:8315) : ce dernier ne supporte pas la création de
 * nouvelles pages (`Target.createTarget` → "Not supported"), seulement le
 * pilotage de webviews déjà ouvertes (voir backend/routes/wa.js). Avantage
 * secondaire : l'export PDF fonctionne même sans l'app Electron lancée,
 * cohérent avec le reste du CLI (standalone, in-process).
 */
async function renderPdf(id, outPath = null) {
    const invoice = await getInvoice(id);

    const templatePath = path.join(__dirname, '../../src/components/invoice/buildInvoiceHTML.js');
    const { buildInvoiceHTML } = await import(pathToFileURL(templatePath).href);
    const locale = require('../../src/locales/fr.json');
    const t = (key) => locale[key] || key;
    const html = buildInvoiceHTML(invoice, t);

    const { chromium } = require('playwright');
    const browser = await chromium.launch({ headless: true });
    try {
        const page = await browser.newPage();
        await page.setContent(html, { waitUntil: 'networkidle' });
        const pdfBuffer = await page.pdf({ format: 'A4', printBackground: true });
        if (outPath) {
            fs.writeFileSync(outPath, pdfBuffer);
        }
        return { buffer: pdfBuffer, outPath };
    } finally {
        await browser.close();
    }
}

module.exports = { listInvoices, getInvoice, createInvoice, updateInvoice, deleteInvoice, renderPdf };
