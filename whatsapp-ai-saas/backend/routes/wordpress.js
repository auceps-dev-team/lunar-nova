const express = require('express');
const router = express.Router();
const { pool } = require('../db');

// Helper: proxy a call to the WordPress plugin
async function wpFetch(siteUrl, token, endpoint, params = '', method = 'GET', body = null) {
    const fetch = (await import('node-fetch')).default;
    const url = `${siteUrl.replace(/\/$/, '')}/wp-json/wacopilote/v1${endpoint}${params}`;

    const options = {
        method,
        headers: {
            'Authorization': `Bearer ${token}`,
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
        throw new Error(err.message || `HTTP ${response.status}`);
    }

    return response.json();
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

// POST /api/wp/connections — Add a new WordPress site
router.post('/connections', async (req, res) => {
    const { name, site_url, token } = req.body;
    if (!name || !site_url || !token) {
        return res.status(400).json({ error: 'Missing name, site_url or token.' });
    }
    try {
        const result = await pool.query(
            'INSERT INTO wp_connections (name, site_url, token) VALUES ($1, $2, $3) RETURNING id, name, site_url, is_active, created_at',
            [name, site_url.trim().replace(/\/$/, ''), token.trim()]
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
        const result = await pool.query('SELECT * FROM wp_connections WHERE id = $1', [req.params.id]);
        if (result.rows.length === 0) return res.status(404).json({ error: 'Connection not found.' });

        const conn = result.rows[0];
        const stats = await wpFetch(conn.site_url, conn.token, '/stats');

        res.json({ status: 'success', site_name: stats.site_name, wp_version: stats.wp_version, plugins: stats.plugins });
    } catch (err) {
        res.status(400).json({ status: 'error', error: err.message });
    }
});

// ─── Proxy Endpoints ────────────────────────────────────────────

// GET /api/wp/:id/stats
router.get('/:id/stats', async (req, res) => {
    try {
        const conn = (await pool.query('SELECT * FROM wp_connections WHERE id = $1', [req.params.id])).rows[0];
        if (!conn) return res.status(404).json({ error: 'Connection not found.' });
        const data = await wpFetch(conn.site_url, conn.token, '/stats');
        res.json({ status: 'success', data });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// GET /api/wp/:id/posts?limit=15&page=1
router.get('/:id/posts', async (req, res) => {
    try {
        const conn = (await pool.query('SELECT * FROM wp_connections WHERE id = $1', [req.params.id])).rows[0];
        if (!conn) return res.status(404).json({ error: 'Connection not found.' });
        const { limit = 15, page = 1 } = req.query;
        const data = await wpFetch(conn.site_url, conn.token, '/posts', `?limit=${limit}&page=${page}`);
        res.json({ status: 'success', data });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// GET /api/wp/:id/products/meta
router.get('/:id/products/meta', async (req, res) => {
    try {
        const conn = (await pool.query('SELECT * FROM wp_connections WHERE id = $1', [req.params.id])).rows[0];
        if (!conn) return res.status(404).json({ error: 'Connection not found.' });
        const data = await wpFetch(conn.site_url, conn.token, '/products/meta');
        res.json({ status: 'success', data });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// GET /api/wp/:id/products
router.get('/:id/products', async (req, res) => {
    try {
        const conn = (await pool.query('SELECT * FROM wp_connections WHERE id = $1', [req.params.id])).rows[0];
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
        const data = await wpFetch(conn.site_url, conn.token, '/products', `?${params.toString()}`);
        res.json({ status: 'success', data });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// GET /api/wp/:id/orders
router.get('/:id/orders', async (req, res) => {
    try {
        const conn = (await pool.query('SELECT * FROM wp_connections WHERE id = $1', [req.params.id])).rows[0];
        if (!conn) return res.status(404).json({ error: 'Connection not found.' });
        const { limit = 15 } = req.query;
        const data = await wpFetch(conn.site_url, conn.token, '/orders', `?limit=${limit}`);
        res.json({ status: 'success', data });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// GET /api/wp/:id/seo-meta
router.get('/:id/seo-meta', async (req, res) => {
    try {
        const conn = (await pool.query('SELECT * FROM wp_connections WHERE id = $1', [req.params.id])).rows[0];
        if (!conn) return res.status(404).json({ error: 'Connection not found.' });
        const data = await wpFetch(conn.site_url, conn.token, '/seo-meta');
        res.json({ status: 'success', data });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// GET /api/wp/:id/analytics
router.get('/:id/analytics', async (req, res) => {
    try {
        const conn = (await pool.query('SELECT * FROM wp_connections WHERE id = $1', [req.params.id])).rows[0];
        if (!conn) return res.status(404).json({ error: 'Connection not found.' });
        
        let params = '';
        if (req.query.date_start || req.query.date_end) {
            const queryParams = new URLSearchParams();
            if (req.query.date_start) queryParams.append('date_start', req.query.date_start);
            if (req.query.date_end) queryParams.append('date_end', req.query.date_end);
            params = `?${queryParams.toString()}`;
        }
        
        const data = await wpFetch(conn.site_url, conn.token, '/analytics', params);
        res.json({ status: 'success', data });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// POST /api/wp/:id/posts
router.post('/:id/posts', async (req, res) => {
    try {
        const conn = (await pool.query('SELECT * FROM wp_connections WHERE id = $1', [req.params.id])).rows[0];
        if (!conn) return res.status(404).json({ error: 'Connection not found.' });
        const data = await wpFetch(conn.site_url, conn.token, '/posts', '', 'POST', req.body);
        res.json({ status: 'success', data });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// POST /api/wp/:id/products
router.post('/:id/products', async (req, res) => {
    try {
        const conn = (await pool.query('SELECT * FROM wp_connections WHERE id = $1', [req.params.id])).rows[0];
        if (!conn) return res.status(404).json({ error: 'Connection not found.' });
        const data = await wpFetch(conn.site_url, conn.token, '/products', '', 'POST', req.body);
        res.json({ status: 'success', data });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;
