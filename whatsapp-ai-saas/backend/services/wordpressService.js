const { pool } = require('../db');
const { encrypt, decrypt } = require('../secretStore');

/**
 * Proxy un appel vers le plugin WordPress du site client (Phase 2 — Basic Auth
 * via Application Passwords). Extrait de backend/routes/wordpress.js pour être
 * réutilisable in-process par le CLI/MCP, sans dupliquer la logique.
 */
async function wpFetch(siteUrl, wpUsername, appPassword, endpoint, params = '', method = 'GET', body = null) {
    const fetch = (await import('node-fetch')).default;
    const url = `${siteUrl.replace(/\/$/, '')}/wp-json/wacopilote/v1${endpoint}${params}`;

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
 * Renvoie `undefined` si l'id est inconnu.
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

async function listConnections() {
    const result = await pool.query('SELECT id, name, site_url, is_active, created_at FROM wp_connections ORDER BY id DESC');
    return result.rows;
}

async function createConnection({ name, site_url, wp_username, app_password } = {}) {
    if (!name || !site_url || !wp_username || !app_password) {
        const err = new Error('Missing name, site_url, wp_username or app_password.');
        err.statusCode = 400;
        throw err;
    }
    const result = await pool.query(
        'INSERT INTO wp_connections (name, site_url, wp_username, app_password) VALUES ($1, $2, $3, $4) RETURNING id, name, site_url, is_active, created_at',
        [name, site_url.trim().replace(/\/$/, ''), wp_username.trim(), encrypt(app_password.trim())]
    );
    return result.rows[0];
}

async function deleteConnection(id) {
    await pool.query('DELETE FROM wp_connections WHERE id = $1', [id]);
    return { success: true };
}

// ─── Gouvernance HITL (propose -> approve/reject) ─────────────────────────
// L'état des propositions vit sur le site WordPress du client (plugin), pas
// localement : c'est le mécanisme déjà câblé, réutilisé tel quel ici.

async function listActions(connectionId, status = 'pending_review') {
    const site = await getSite(connectionId);
    return wpFetch(site.site_url, site.wp_username, site.app_password, '/actions', `?status=${status}`);
}

async function propose(connectionId, actionPayload) {
    const site = await getSite(connectionId);
    return wpFetch(site.site_url, site.wp_username, site.app_password, '/propose', '', 'POST', actionPayload);
}

async function execute(connectionId, actionId) {
    const site = await getSite(connectionId);
    return wpFetch(site.site_url, site.wp_username, site.app_password, `/execute/${actionId}`, '', 'POST', {});
}

async function reject(connectionId, actionId) {
    const site = await getSite(connectionId);
    return wpFetch(site.site_url, site.wp_username, site.app_password, `/execute/${actionId}`, '', 'DELETE');
}

/**
 * Consommateur manquant identifié par la recherche préalable : transforme un
 * prompt en langage naturel en une ou plusieurs propositions d'action via la
 * persona `wordpress_agent`, puis les soumet au flux HITL existant
 * (`/propose`, statut `pending_review` sur le site client — jamais exécuté
 * automatiquement). Nécessite une validation humaine explicite via
 * `execute`/`reject` avant toute écriture réelle sur le site WordPress.
 */
async function proposeFromPrompt(connectionId, prompt) {
    const aiController = require('../aiController');
    const agentResult = await aiController.chatWithAgent('wordpress_agent', prompt, null, null, 'json');

    let parsed;
    try {
        const raw = (agentResult && agentResult.response) || '{}';
        const start = raw.indexOf('{');
        const end = raw.lastIndexOf('}');
        parsed = JSON.parse(start !== -1 && end !== -1 ? raw.substring(start, end + 1) : raw);
    } catch {
        const err = new Error("La persona 'wordpress_agent' n'a pas renvoyé un JSON exploitable.");
        err.statusCode = 422;
        throw err;
    }

    const actions = Array.isArray(parsed.actions) ? parsed.actions : [];
    const proposals = [];
    for (const action of actions) {
        const result = await propose(connectionId, { action_type: action.type, payload: action.payload });
        proposals.push(result);
    }

    return { text: parsed.text || '', actions, proposals };
}

// ─── Lecture seule ─────────────────────────────────────────────────────────

async function getStats(connectionId) {
    const site = await getSite(connectionId);
    return wpFetch(site.site_url, site.wp_username, site.app_password, '/stats');
}

async function listProducts(connectionId, query = {}) {
    const site = await getSite(connectionId);
    const { per_page = 25, page = 1, category = '', type = '', stock_status = '', brand = '', search = '' } = query;
    const params = new URLSearchParams();
    params.set('per_page', per_page);
    params.set('page', page);
    if (category) params.set('category', category);
    if (type) params.set('type', type);
    if (stock_status) params.set('stock_status', stock_status);
    if (brand) params.set('brand', brand);
    if (search) params.set('search', search);
    return wpFetch(site.site_url, site.wp_username, site.app_password, '/products', `?${params.toString()}`);
}

async function listOrders(connectionId, limit = 15) {
    const site = await getSite(connectionId);
    return wpFetch(site.site_url, site.wp_username, site.app_password, '/orders', `?limit=${limit}`);
}

module.exports = {
    wpFetch,
    loadConnection,
    getSite,
    listConnections,
    createConnection,
    deleteConnection,
    listActions,
    propose,
    execute,
    reject,
    proposeFromPrompt,
    getStats,
    listProducts,
    listOrders
};
