/**
 * Pilote des webviews WhatsApp, côté backend (S2, 27/11/2026).
 *
 * POURQUOI — Jusqu'à la v1.51.2, Electron ouvrait en permanence le port de
 * débogage Chromium 8315, et le backend s'y connectait (puppeteer.connect)
 * pour lire et piloter WhatsApp Web. Ce port écoute sur la boucle locale :
 * tout programme de la machine — et tout autre compte Windows de la même
 * machine — pouvait s'y connecter et agir dans les sessions WhatsApp.
 *
 * MAINTENANT — en production, le backend est un utilityProcess d'Electron :
 * les commandes passent par son canal privé avec le processus principal
 * (`process.parentPort`), qui les exécute sur les webviews WhatsApp
 * (electron/waDriverHost.cjs). Aucun port réseau n'est ouvert.
 *
 * En développement seulement (backend lancé à part par `npm run
 * start:backend`, Electron en NODE_ENV=development qui ouvre alors le port),
 * le pilote se replie sur ce port local de développement.
 *
 * Les appelants ne voient qu'une page réduite à ce qu'ils utilisent :
 * evaluate, waitForSelector, goto, exposeFunction, onClose.
 */
const { inPageSelectors } = require('./waSelectors');

const REQUEST_TIMEOUT_MS = 30000;
const DEV_CDP_URL = process.env.WACOPILOTE_DEV_CDP_URL || 'http://localhost:8315';

/**
 * Expression évaluée dans la page : la fonction (code du backend, rendu par
 * Function.prototype.toString) appliquée à ses arguments, insérés comme
 * littéral JSON — des DONNÉES, jamais du code.
 */
function buildExpression(source, args = []) {
    return `(${source}).apply(null, ${JSON.stringify(args)})`;
}

/**
 * Compose `fn(sel, ...args)` avec la préparation des sélecteurs du registre
 * (inPageSelectors), le tout exécuté dans la page. Remplace les poignées
 * (evaluateHandle) de puppeteer, qui n'existent pas sur le canal privé.
 */
function withSelectors(fn) {
    return `function (paquet, ...args) {
        const sel = (${inPageSelectors.toString()})(paquet);
        return (${fn.toString()})(sel, ...args);
    }`;
}

// ── Transport de production : canal privé avec le processus principal ──────
function createParentPortTransport(port) {
    let sequence = 0;
    const pending = new Map();
    const listeners = new Set();

    port.on('message', (event) => {
        const msg = event && Object.prototype.hasOwnProperty.call(event, 'data') ? event.data : event;
        if (!msg || typeof msg !== 'object') return;
        if (msg.type === 'wa-driver-res') {
            const attente = pending.get(msg.id);
            if (!attente) return;
            pending.delete(msg.id);
            clearTimeout(attente.minuteur);
            if (msg.ok) attente.resolve(msg.result);
            else attente.reject(new Error(msg.error || 'Pilote WhatsApp : échec sans message'));
        } else if (msg.type === 'wa-driver-event') {
            for (const ecoute of listeners) ecoute(msg);
        }
    });

    return {
        kind: 'canal privé',
        request(op, params = {}, timeoutMs = REQUEST_TIMEOUT_MS) {
            return new Promise((resolve, reject) => {
                const id = ++sequence;
                const minuteur = setTimeout(() => {
                    pending.delete(id);
                    reject(new Error(`Pilote WhatsApp : pas de réponse à « ${op} » en ${timeoutMs} ms`));
                }, timeoutMs);
                pending.set(id, { resolve, reject, minuteur });
                port.postMessage({ type: 'wa-driver-req', id, op, params });
            });
        },
        onEvent(cb) {
            listeners.add(cb);
            return () => listeners.delete(cb);
        },
    };
}

// ── Transport de développement : port de débogage local (jamais en production)
function createDevCdpTransport(url = DEV_CDP_URL) {
    const puppeteer = require('puppeteer-core');
    let navigateur = null;
    let suivant = 0;
    const pages = new Map();          // pageId -> page puppeteer
    const ids = new WeakMap();        // page puppeteer -> pageId
    const listeners = new Set();
    const emettre = (ev) => { for (const l of listeners) l({ type: 'wa-driver-event', ...ev }); };

    const connecter = async () => {
        if (!navigateur) {
            navigateur = puppeteer.connect({ browserURL: url, defaultViewport: null }).catch((e) => {
                navigateur = null;
                throw new Error(`Pilote WhatsApp (développement) : ${url} injoignable — ${e.message}`);
            });
        }
        return navigateur;
    };
    const page = (pageId) => {
        const p = pages.get(pageId);
        if (!p) throw new Error(`Pilote WhatsApp : page ${pageId} inconnue ou fermée`);
        return p;
    };

    const ops = {
        async list() {
            const b = await connecter();
            const res = [];
            for (const t of b.targets()) {
                if (t.type() !== 'webview' || !t.url().startsWith('https://web.whatsapp.com')) continue;
                const p = await t.page();
                if (!p) continue;
                if (!ids.has(p)) {
                    const id = `dev-${++suivant}`;
                    ids.set(p, id);
                    pages.set(id, p);
                    p.once('close', () => { pages.delete(id); emettre({ event: 'closed', pageId: id }); });
                }
                const pageId = ids.get(p);
                let instanceId = null;
                try { instanceId = await p.evaluate('window.__whatsapp_instance_id'); } catch { /* contexte en navigation */ }
                res.push({ pageId, url: p.url(), instanceId: instanceId || null });
            }
            return res;
        },
        evaluate: ({ pageId, source, args }) => page(pageId).evaluate(buildExpression(source, args)),
        async goto({ pageId, url: cible, timeoutMs }) {
            await page(pageId).goto(cible, { waitUntil: 'domcontentloaded', timeout: timeoutMs || 10000 });
            return true;
        },
        async addBinding({ pageId, name }) {
            await page(pageId).exposeFunction(name, (payload) => emettre({ event: 'binding', pageId, name, payload }));
            return true;
        },
    };

    return {
        kind: 'port de développement',
        async request(op, params = {}) {
            if (!ops[op]) throw new Error(`Pilote WhatsApp : opération inconnue « ${op} »`);
            return ops[op](params);
        },
        onEvent(cb) {
            listeners.add(cb);
            return () => listeners.delete(cb);
        },
    };
}

// ── Liaisons page → backend ─────────────────────────────────────────────────
// Un seul aiguilleur par transport, et un seul rappel par (page, nom) : une
// nouvelle exposition REMPLACE la précédente. Sans cela, arrêter puis relancer
// l'écoute d'une même page doublait chaque message reçu.
const liaisonsParTransport = new WeakMap();
function liaisons(transport) {
    let table = liaisonsParTransport.get(transport);
    if (!table) {
        table = new Map();
        liaisonsParTransport.set(transport, table);
        transport.onEvent((ev) => {
            if (ev.event !== 'binding') return;
            const rappel = table.get(`${ev.pageId}|${ev.name}`);
            if (!rappel) return;
            let args;
            try { args = JSON.parse(ev.payload); } catch { return; }
            if (Array.isArray(args)) rappel(...args);
        });
    }
    return table;
}

// ── Page pilotée ────────────────────────────────────────────────────────────
class DriverPage {
    constructor(transport, info) {
        this.transport = transport;
        this.pageId = info.pageId;
        this.instanceId = info.instanceId || null;
        this._url = info.url || '';
    }

    url() { return this._url; }

    /** fn : fonction (sérialisée) ou source ; args : données JSON. */
    evaluate(fn, ...args) {
        const source = typeof fn === 'function' ? fn.toString() : String(fn);
        return this.transport.request('evaluate', { pageId: this.pageId, source, args });
    }

    /** `fn(sel, ...args)` avec les sélecteurs du registre préparés dans la page. */
    evaluateWithSelectors(fn, paquet, ...args) {
        return this.evaluate(withSelectors(fn), paquet, ...args);
    }

    async waitForSelector(selector, { timeout = 30000, interval = 250 } = {}) {
        const echeance = Date.now() + timeout;
        for (;;) {
            let present = false;
            try {
                // eslint-disable-next-line no-undef
                present = await this.evaluate((s) => Boolean(document.querySelector(s)), selector);
            } catch { /* page en navigation : on réessaie */ }
            if (present) return true;
            if (Date.now() >= echeance) throw new Error(`Délai dépassé (${timeout} ms) en attendant ${selector}`);
            await new Promise((r) => setTimeout(r, interval));
        }
    }

    async goto(url, { timeout = 10000 } = {}) {
        await this.transport.request('goto', { pageId: this.pageId, url, timeoutMs: timeout }, timeout + 5000);
        this._url = url;
    }

    /**
     * Rend `window[name](...args)` appelable par la page ; chaque appel exécute
     * `callback(...args)` dans le backend. Le canal ne transporte qu'une chaîne :
     * les arguments voyagent en JSON.
     */
    async exposeFunction(name, callback) {
        const binding = `__wac_${name}`;
        liaisons(this.transport).set(`${this.pageId}|${binding}`, callback);
        await this.transport.request('addBinding', { pageId: this.pageId, name: binding });
        /* eslint-disable no-undef */
        await this.evaluate((nom, liaison) => {
            window[nom] = (...a) => window[liaison](JSON.stringify(a));
        }, name, binding);
        /* eslint-enable no-undef */
    }

    /** Rappel unique à la fermeture de la webview. */
    onClose(callback) {
        const retirer = this.transport.onEvent((ev) => {
            if (ev.event === 'closed' && ev.pageId === this.pageId) {
                retirer();
                callback();
            }
        });
    }
}

// ── Pilote ──────────────────────────────────────────────────────────────────
function createWaDriver(transport) {
    return {
        kind: transport.kind,
        async listPages() {
            const infos = await transport.request('list');
            return infos.map((info) => new DriverPage(transport, info));
        },
        /**
         * Pages de l'instance : celle dont l'identifiant correspond, sinon
         * toutes les pages WhatsApp — même règle que l'ancien parcours des
         * cibles CDP (une page sans identifiant reste utilisable).
         */
        async findPages(instanceId) {
            const pages = await this.listPages();
            const exacte = pages.find((p) => instanceId && p.instanceId === instanceId);
            return exacte ? [exacte] : pages;
        },
    };
}

let piloteParDefaut = null;
let processusBackend = false;

/** Déclaré par server.js : ce processus est le backend de l'application. */
function markBackendProcess() { processusBackend = true; }
function isBackendProcess() { return processusBackend; }

/** Pilote du processus : canal privé s'il existe (production), sinon port de développement. */
function getWaDriver() {
    if (!piloteParDefaut) {
        const port = process.parentPort;
        piloteParDefaut = createWaDriver(port ? createParentPortTransport(port) : createDevCdpTransport());
    }
    return piloteParDefaut;
}

/** Tests : remplace le pilote du processus. */
function __setWaDriverForTests(pilote) { piloteParDefaut = pilote; }

module.exports = {
    buildExpression,
    withSelectors,
    createParentPortTransport,
    createDevCdpTransport,
    createWaDriver,
    DriverPage,
    getWaDriver,
    markBackendProcess,
    isBackendProcess,
    __setWaDriverForTests,
    REQUEST_TIMEOUT_MS,
};
