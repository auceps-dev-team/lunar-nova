/**
 * Hôte du pilote WhatsApp, dans le processus principal (S2, 27/11/2026).
 *
 * Le backend (utilityProcess) envoie ses commandes par son canal privé ; elles
 * sont exécutées ici sur les webviews WhatsApp. Remplace le port de débogage
 * Chromium 8315, qui exposait ces mêmes webviews à tout programme local.
 *
 * Bornes, quoi que demande le backend :
 *   - seules les webviews sur https://web.whatsapp.com sont listées et
 *     pilotables (ni la carte, ni la fenêtre principale) ;
 *   - la navigation ne peut mener qu'à WhatsApp Web ;
 *   - les liaisons page → backend portent un nom de forme fixe (__wac_…).
 *
 * L'évaluation passe par executeJavaScript ; le débogueur de la webview ne
 * sert qu'aux liaisons (Runtime.addBinding) : une fonction native, qui ne
 * dépend pas de la console de la page.
 */
const WHATSAPP_ORIGIN = 'https://web.whatsapp.com';
const NAVIGATION_TIMEOUT_MS = 15000;
const NOM_LIAISON = /^__wac_[A-Za-z0-9_]{1,64}$/;

function estWhatsApp(url) {
    try { return new URL(url).origin === WHATSAPP_ORIGIN; } catch { return false; }
}

/**
 * @param {object} deps
 * @param {() => Array} deps.allWebContents  webContents.getAllWebContents
 * @param {(ev: object) => void} deps.emit     envoi d'un événement au backend
 */
function createWaDriverHost({ allWebContents, emit }) {
    const suivis = new Map(); // id -> { liaisons: Set, debogueur: Promise|null }

    const suivre = (c) => {
        let s = suivis.get(c.id);
        if (!s) {
            s = { liaisons: new Set(), debogueur: null };
            suivis.set(c.id, s);
            c.once('destroyed', () => {
                suivis.delete(c.id);
                emit({ event: 'closed', pageId: c.id });
            });
        }
        return s;
    };

    const estPageWhatsApp = (c) => c && !c.isDestroyed() && c.getType() === 'webview' && estWhatsApp(c.getURL());

    const page = (pageId) => {
        const c = allWebContents().find((w) => w.id === pageId);
        if (!estPageWhatsApp(c)) throw new Error(`page ${pageId} introuvable, fermée ou hors de WhatsApp Web`);
        suivre(c);
        return c;
    };

    const attacherDebogueur = (c, s) => {
        if (!s.debogueur) {
            s.debogueur = (async () => {
                if (!c.debugger.isAttached()) c.debugger.attach('1.3');
                c.debugger.on('message', (_e, method, params) => {
                    if (method === 'Runtime.bindingCalled' && s.liaisons.has(params.name)) {
                        emit({ event: 'binding', pageId: c.id, name: params.name, payload: params.payload });
                    }
                });
                c.debugger.on('detach', () => { s.debogueur = null; s.liaisons.clear(); });
                await c.debugger.sendCommand('Runtime.enable');
            })();
        }
        return s.debogueur;
    };

    const ops = {
        async list() {
            const res = [];
            for (const c of allWebContents()) {
                if (!estPageWhatsApp(c)) continue;
                suivre(c);
                let instanceId = null;
                try { instanceId = await c.executeJavaScript('window.__whatsapp_instance_id'); } catch { /* page en navigation */ }
                res.push({ pageId: c.id, url: c.getURL(), instanceId: typeof instanceId === 'string' ? instanceId : null });
            }
            return res;
        },
        async evaluate({ pageId, source, args }) {
            if (typeof source !== 'string') throw new Error('evaluate : source attendue');
            return page(pageId).executeJavaScript(`(${source}).apply(null, ${JSON.stringify(Array.isArray(args) ? args : [])})`);
        },
        async goto({ pageId, url, timeoutMs }) {
            if (!estWhatsApp(url)) throw new Error(`navigation refusée hors de WhatsApp Web : ${url}`);
            const c = page(pageId);
            const chargement = c.loadURL(url).catch((e) => {
                // Navigation remplacée par une autre (redirection interne de WhatsApp) : pas un échec.
                if (!/ERR_ABORTED/.test(e.message)) throw e;
            });
            await Promise.race([chargement, new Promise((r) => setTimeout(r, timeoutMs || NAVIGATION_TIMEOUT_MS))]);
            return true;
        },
        async addBinding({ pageId, name }) {
            if (!NOM_LIAISON.test(String(name))) throw new Error(`nom de liaison refusé : ${name}`);
            const c = page(pageId);
            const s = suivre(c);
            await attacherDebogueur(c, s);
            if (!s.liaisons.has(name)) {
                await c.debugger.sendCommand('Runtime.addBinding', { name });
                s.liaisons.add(name);
            }
            return true;
        },
    };

    return {
        /** Traite une requête du backend ; rend toujours une réponse (jamais d'exception). */
        async handle(msg) {
            const { id, op, params } = msg || {};
            try {
                if (!Object.prototype.hasOwnProperty.call(ops, op)) throw new Error(`opération inconnue : ${op}`);
                const result = await ops[op](params || {});
                return { type: 'wa-driver-res', id, ok: true, result };
            } catch (e) {
                return { type: 'wa-driver-res', id, ok: false, error: e && e.message ? e.message : String(e) };
            }
        },
    };
}

module.exports = { createWaDriverHost, estWhatsApp, WHATSAPP_ORIGIN };
