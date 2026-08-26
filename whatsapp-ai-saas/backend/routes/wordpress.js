const express = require('express');
const router = express.Router();
const { pool } = require('../db');
const { encrypt, decrypt } = require('../secretStore');

// Helper: proxy a call to the WordPress plugin (Phase 2 — Basic Auth via App Passwords)
/**
 * @param {string} siteUrl        - WordPress site URL
 * @param {string} wpUsername     - WordPress username
 * @param {string} appPassword    - Application Password (spaces allowed, WP handles it)
 * @param {string} endpoint       - REST path under /wacopilote/v1
 * @param {string} params         - Query string (e.g. '?page=2')
 * @param {string} method         - HTTP method
 * @param {object|null} body      - JSON body
 */
async function wpFetch(siteUrl, wpUsername, appPassword, endpoint, params = '', method = 'GET', body = null) {
    const fetch = (await import('node-fetch')).default;
    const url = `${siteUrl.replace(/\/$/, '')}/wp-json/wacopilote/v1${endpoint}${params}`;

    // WordPress Application Passwords use Basic Auth: base64(username:app_password)
    const credentials = Buffer.from(`${wpUsername}:${appPassword}`).toString('base64');

    const options = {
        method,
        headers: {
            'Authorization': `Basic ${credentials}`,
            'Content-Type': 'application/json',
        },
        timeout: 15000,
    };

    if (body) {
        options.body = JSON.stringify(body);
    }

    const response = await fetch(url, options);

    if (!response.ok) {
        const err = await response.json().catch(() => ({ message: response.statusText }));
        throw new Error(err.message || `HTTP ${response.status} — ${url}`);
    }

    return response.json();
}

/**
 * Charge une connexion WordPress et déchiffre son mot de passe d'application.
 *
 * Unique point de déchiffrement du fichier : toutes les routes passent par ici,
 * ce qui évite qu'une nouvelle route réintroduise une lecture directe de la
 * colonne chiffrée. Renvoie `undefined` si l'id est inconnu.
 */
async function loadConnection(id) {
    const result = await pool.query('SELECT * FROM wp_connections WHERE id = $1', [id]);
    const row = result.rows[0];
    if (!row) return undefined;
    return { ...row, app_password: decrypt(row.app_password) };
}

/** Variante levant une erreur 404 quand l'id est inconnu. */
async function getSite(id) {
    const site = await loadConnection(id);
    if (!site) {
        const err = new Error('Connection not found.');
        err.statusCode = 404;
        throw err;
    }
    return site;
}

// ─── CRUD Connexions ────────────────────────────────────────────

// GET /api/wp/connections — List all saved WordPress sites
router.get('/connections', async (req, res) => {
    try {
        const result = await pool.query('SELECT id, name, site_url, is_active, created_at FROM wp_connections ORDER BY id DESC');
        res.json({ status: 'success', data: result.rows });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// POST /api/wp/connections — Add a new WordPress site (Phase 2: username + app_password)
router.post('/connections', async (req, res) => {
    const { name, site_url, wp_username, app_password } = req.body;
    if (!name || !site_url || !wp_username || !app_password) {
        return res.status(400).json({ error: 'Missing name, site_url, wp_username or app_password.' });
    }
    try {
        const result = await pool.query(
            'INSERT INTO wp_connections (name, site_url, wp_username, app_password) VALUES ($1, $2, $3, $4) RETURNING id, name, site_url, is_active, created_at',
            [name, site_url.trim().replace(/\/$/, ''), wp_username.trim(), encrypt(app_password.trim())]
        );
        res.json({ status: 'success', data: result.rows[0] });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// DELETE /api/wp/connections/:id — Remove a site
router.delete('/connections/:id', async (req, res) => {
    try {
        await pool.query('DELETE FROM wp_connections WHERE id = $1', [req.params.id]);
        res.json({ status: 'success' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// POST /api/wp/connections/:id/test — Test connectivity with the plugin
router.post('/connections/:id/test', async (req, res) => {
    try {
        const conn = await loadConnection(req.params.id);
        if (!conn) return res.status(404).json({ error: 'Connection not found.' });

        const stats = await wpFetch(conn.site_url, conn.wp_username, conn.app_password, '/stats');

        res.json({ status: 'success', site_name: stats.site_name, wp_version: stats.wp_version, plugins: stats.plugins });
    } catch (err) {
        res.status(400).json({ status: 'error', error: err.message });
    }
});

// ─── Proxy Endpoints ────────────────────────────────────────────

// GET /api/wp/:id/stats
router.get('/:id/stats', async (req, res) => {
    try {
        const conn = await loadConnection(req.params.id);
        if (!conn) return res.status(404).json({ error: 'Connection not found.' });
        const data = await wpFetch(conn.site_url, conn.wp_username, conn.app_password, '/stats');
        res.json({ status: 'success', data });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// GET /api/wp/:id/posts?limit=15&page=1
router.get('/:id/posts', async (req, res) => {
    try {
        const conn = await loadConnection(req.params.id);
        if (!conn) return res.status(404).json({ error: 'Connection not found.' });
        const { limit = 15, page = 1 } = req.query;
        const data = await wpFetch(conn.site_url, conn.wp_username, conn.app_password, '/posts', `?limit=${limit}&page=${page}`);
        res.json({ status: 'success', data });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// GET /api/wp/:id/products/meta
router.get('/:id/products/meta', async (req, res) => {
    try {
        const conn = await loadConnection(req.params.id);
        if (!conn) return res.status(404).json({ error: 'Connection not found.' });
        const data = await wpFetch(conn.site_url, conn.wp_username, conn.app_password, '/products/meta');
        res.json({ status: 'success', data });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// GET /api/wp/:id/products
router.get('/:id/products', async (req, res) => {
    try {
        const conn = await loadConnection(req.params.id);
        if (!conn) return res.status(404).json({ error: 'Connection not found.' });
        const { per_page = 25, page = 1, category = '', type = '', stock_status = '', brand = '', search = '' } = req.query;
        const params = new URLSearchParams();
        params.set('per_page', per_page);
        params.set('page', page);
        if (category)     params.set('category', category);
        if (type)         params.set('type', type);
        if (stock_status) params.set('stock_status', stock_status);
        if (brand)        params.set('brand', brand);
        if (search)       params.set('search', search);
        const data = await wpFetch(conn.site_url, conn.wp_username, conn.app_password, '/products', `?${params.toString()}`);
        res.json({ status: 'success', data });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// GET /api/wp/:id/orders
router.get('/:id/orders', async (req, res) => {
    try {
        const conn = await loadConnection(req.params.id);
        if (!conn) return res.status(404).json({ error: 'Connection not found.' });
        const { limit = 15 } = req.query;
        const data = await wpFetch(conn.site_url, conn.wp_username, conn.app_password, '/orders', `?limit=${limit}`);
        res.json({ status: 'success', data });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// GET /api/wp/:id/seo-meta
router.get('/:id/seo-meta', async (req, res) => {
    try {
        const conn = await loadConnection(req.params.id);
        if (!conn) return res.status(404).json({ error: 'Connection not found.' });
        const data = await wpFetch(conn.site_url, conn.wp_username, conn.app_password, '/seo-meta');
        res.json({ status: 'success', data });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// GET /api/wp/:id/analytics
router.get('/:id/analytics', async (req, res) => {
    try {
        const conn = await loadConnection(req.params.id);
        if (!conn) return res.status(404).json({ error: 'Connection not found.' });
        
        let params = '';
        if (req.query.date_start || req.query.date_end) {
            const queryParams = new URLSearchParams();
            if (req.query.date_start) queryParams.append('date_start', req.query.date_start);
            if (req.query.date_end) queryParams.append('date_end', req.query.date_end);
            params = `?${queryParams.toString()}`;
        }
        
        const data = await wpFetch(conn.site_url, conn.wp_username, conn.app_password, '/analytics', params);
        res.json({ status: 'success', data });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Les routes POST /:id/posts et /:id/products ont été retirées : elles ciblaient
// des endpoints « legacy » d'écriture directe du plugin, jamais enregistrés côté
// PHP (donc déjà inopérants, 404). Les mutations WordPress passent exclusivement
// par la gouvernance HITL ci-dessous : /propose (stockage en pending_review) puis
// /execute/:actionId après approbation humaine — aucune écriture directe.

// ─── HITL Governance Routes ──────────────────────────────────────────────────

// GET /api/wp/:id/actions — List AI proposals (pending by default)
router.get('/:id/actions', async (req, res) => {
    try {
        const conn = await loadConnection(req.params.id);
        if (!conn) return res.status(404).json({ error: 'Connection not found.' });
        const status = req.query.status || 'pending_review';
        const data = await wpFetch(conn.site_url, conn.wp_username, conn.app_password, '/actions', `?status=${status}`);
        res.json({ status: 'success', data });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// POST /api/wp/:id/propose — Agent submits a proposal (stored, not executed)
router.post('/:id/propose', async (req, res) => {
    try {
        const conn = await loadConnection(req.params.id);
        if (!conn) return res.status(404).json({ error: 'Connection not found.' });
        const data = await wpFetch(conn.site_url, conn.wp_username, conn.app_password, '/propose', '', 'POST', req.body);
        res.status(201).json({ status: 'success', data });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// POST /api/wp/:id/execute/:actionId — Admin approves a proposal
router.post('/:id/execute/:actionId', async (req, res) => {
    try {
        const conn = await loadConnection(req.params.id);
        if (!conn) return res.status(404).json({ error: 'Connection not found.' });
        const data = await wpFetch(conn.site_url, conn.wp_username, conn.app_password, `/execute/${req.params.actionId}`, '', 'POST', {});
        res.json({ status: 'success', data });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// DELETE /api/wp/:id/execute/:actionId — Admin rejects a proposal
router.delete('/:id/execute/:actionId', async (req, res) => {
    try {
        const conn = await loadConnection(req.params.id);
        if (!conn) return res.status(404).json({ error: 'Connection not found.' });
        const data = await wpFetch(conn.site_url, conn.wp_username, conn.app_password, `/execute/${req.params.actionId}`, '', 'DELETE');
        res.json({ status: 'success', data });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// POST /api/wp/:id/media/upload — Forward multipart file upload to WP media library
router.post('/:id/media/upload', async (req, res) => {
    try {
        const fetch = (await import('node-fetch')).default;
        const FormData = (await import('form-data')).default;
        const conn = await loadConnection(req.params.id);
        if (!conn) return res.status(404).json({ error: 'Connection not found.' });

        // req must be pre-processed by multer (memory storage) — attach in server.js
        if (!req.file) return res.status(400).json({ error: 'No file in request. Use field name "file".' });

        const form = new FormData();
        form.append('file', req.file.buffer, {
            filename: req.file.originalname,
            contentType: req.file.mimetype,
        });
        if (req.body.post_id) form.append('post_id', req.body.post_id);
        if (req.body.title)   form.append('title',   req.body.title);

        const url = `${conn.site_url.replace(/\/$/, '')}/wp-json/wacopilote/v1/media/upload`;
        // Comme wpFetch : Basic Auth via Application Password. `conn.token` est une
        // colonne héritée de la v1, vide depuis la migration v2.0.
        const credentials = Buffer.from(`${conn.wp_username}:${conn.app_password}`).toString('base64');
        const response = await fetch(url, {
            method: 'POST',
            headers: { 'Authorization': `Basic ${credentials}`, ...form.getHeaders() },
            body: form,
            timeout: 60000,
        });

        if (!response.ok) {
            const err = await response.json().catch(() => ({ message: response.statusText }));
            return res.status(response.status).json({ error: err.message });
        }

        const data = await response.json();
        res.json({ status: 'success', data });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// GET /api/wp/:id/logs
router.get('/:id/logs', async (req, res) => {
    try {
        const { id } = req.params;
        const limit = req.query.limit || 50;
        const offset = req.query.offset || 0;
        const status = req.query.status || '';
        const site = await getSite(id);
        const data = await wpFetch(site.site_url, site.wp_username, site.app_password, '/logs', `?limit=${limit}&offset=${offset}&status=${status}`);
        res.json(data);
    } catch (err) {
        res.status(err.statusCode || 500).json({ error: err.message });
    }
});

module.exports = router;

