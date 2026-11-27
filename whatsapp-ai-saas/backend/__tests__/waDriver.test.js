// @vitest-environment jsdom
//
// Pilote WhatsApp côté backend (S2, 27/11/2026) : transport par le canal
// privé, page pilotée, liaisons page → backend. La « page » est simulée dans
// jsdom : l'expression envoyée est évaluée comme le ferait executeJavaScript
// dans la webview. DOM synthétique, aucune donnée réelle.
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

const driver = require('../wa/waDriver');
const sel = require('../wa/waSelectors');
const { observerInPage } = require('../wa/orderObserverInPage');

// Transport simulé : une seule page jsdom, ou plusieurs entrées listées.
function fauxTransport({ pages = [{ pageId: 1, url: 'https://web.whatsapp.com/', instanceId: 'wa-1' }] } = {}) {
    const ecouteurs = new Set();
    const emettre = (ev) => { for (const l of ecouteurs) l({ type: 'wa-driver-event', ...ev }); };
    const appels = [];
    return {
        kind: 'simulé',
        appels,
        emettre,
        async request(op, params) {
            appels.push({ op, params });
            if (op === 'list') return pages;
            if (op === 'evaluate') return (0, eval)(driver.buildExpression(params.source, params.args));
            if (op === 'addBinding') {
                window[params.name] = (payload) => emettre({ event: 'binding', pageId: params.pageId, name: params.name, payload });
                return true;
            }
            if (op === 'goto') return true;
            throw new Error(`op ${op}`);
        },
        onEvent(cb) { ecouteurs.add(cb); return () => ecouteurs.delete(cb); },
    };
}

const paquetLivre = () => ({
    lists: sel.defaultSelectors(),
    defaults: Object.fromEntries(Object.entries(sel.KEYS).map(([k, d]) => [k, d.defaults])),
    modes: Object.fromEntries(Object.entries(sel.KEYS).map(([k, d]) => [k, d.mode])),
});

afterEach(() => {
    document.body.innerHTML = '';
    for (const k of Object.keys(window)) if (k.startsWith('__wac_') || k.startsWith('__iol_') || k.startsWith('onNewWa') || k === 'onIolDebug') delete window[k];
});

describe('expression envoyée à la page', () => {
    it('applique la fonction à ses arguments, insérés comme données JSON', () => {
        const src = ((a, b) => `${a}|${b.n}`).toString();
        const texte = 'guillemets " \' et `backtick` ${pas évalué}\n  fin';
        expect((0, eval)(driver.buildExpression(src, [texte, { n: 2 }]))).toBe(`${texte}|2`);
    });

    it('withSelectors : la fonction reçoit les sélecteurs préparés dans la page', () => {
        document.body.innerHTML = '<div id="pane-side"></div>';
        const source = driver.withSelectors((s, x) => `${document.querySelectorAll(s.S.appReady).length}-${x}`);
        expect((0, eval)(driver.buildExpression(source, [paquetLivre(), 'ok']))).toBe('1-ok');
    });
});

describe('transport par le canal privé', () => {
    const fauxPort = () => {
        const ecoute = [];
        const envoyes = [];
        return {
            envoyes,
            on: (ev, cb) => { if (ev === 'message') ecoute.push(cb); },
            postMessage: (m) => envoyes.push(m),
            recevoir: (data) => ecoute.forEach((cb) => cb({ data })),
        };
    };

    it('associe chaque réponse à sa requête, et propage les erreurs', async () => {
        const port = fauxPort();
        const t = driver.createParentPortTransport(port);
        const a = t.request('list');
        const b = t.request('evaluate', { pageId: 1 });
        const [reqA, reqB] = port.envoyes;
        expect(reqA).toMatchObject({ type: 'wa-driver-req', op: 'list' });
        port.recevoir({ type: 'wa-driver-res', id: reqB.id, ok: false, error: 'page 1 introuvable' });
        port.recevoir({ type: 'wa-driver-res', id: reqA.id, ok: true, result: [] });
        await expect(a).resolves.toEqual([]);
        await expect(b).rejects.toThrow('page 1 introuvable');
    });

    it('une requête sans réponse échoue au bout du délai, nommément', async () => {
        vi.useFakeTimers();
        try {
            const t = driver.createParentPortTransport(fauxPort());
            const r = t.request('list', {}, 1000);
            vi.advanceTimersByTime(1000);
            await expect(r).rejects.toThrow(/pas de réponse à « list »/);
        } finally {
            vi.useRealTimers();
        }
    });

    it('relaie les événements du processus principal', () => {
        const port = fauxPort();
        const t = driver.createParentPortTransport(port);
        const recus = [];
        t.onEvent((ev) => recus.push(ev));
        port.recevoir({ type: 'wa-driver-event', event: 'closed', pageId: 3 });
        port.recevoir({ type: 'autre' });
        expect(recus).toEqual([{ type: 'wa-driver-event', event: 'closed', pageId: 3 }]);
    });
});

describe('pages pilotées', () => {
    let transport;
    let pilote;
    beforeEach(() => {
        transport = fauxTransport({
            pages: [
                { pageId: 1, url: 'https://web.whatsapp.com/', instanceId: 'wa-1' },
                { pageId: 2, url: 'https://web.whatsapp.com/', instanceId: 'wa-2' },
            ],
        });
        pilote = driver.createWaDriver(transport);
    });

    it('trouve la page de l\'instance ; à défaut, toutes les pages WhatsApp', async () => {
        expect((await pilote.findPages('wa-2')).map((p) => p.pageId)).toEqual([2]);
        expect((await pilote.findPages('inconnue')).map((p) => p.pageId)).toEqual([1, 2]);
    });

    it('une liaison réexposée remplace la précédente : un message n\'est traité qu\'une fois', async () => {
        const [page] = await pilote.findPages('wa-1');
        const premier = vi.fn();
        const second = vi.fn();
        await page.exposeFunction('onNewWaMessage', premier);
        await page.exposeFunction('onNewWaMessage', second);
        window.onNewWaMessage('Awa', 'Je veux 2 pagnes');
        expect(premier).not.toHaveBeenCalled();
        expect(second).toHaveBeenCalledTimes(1);
        expect(second).toHaveBeenCalledWith('Awa', 'Je veux 2 pagnes');
    });

    it('waitForSelector attend l\'élément, puis abandonne au délai', async () => {
        const [page] = await pilote.findPages('wa-1');
        setTimeout(() => { document.body.innerHTML = '<div id="pane-side"></div>'; }, 60);
        await expect(page.waitForSelector('#pane-side', { timeout: 2000, interval: 20 })).resolves.toBe(true);
        await expect(page.waitForSelector('#absent', { timeout: 100, interval: 20 })).rejects.toThrow(/Délai dépassé/);
    });

    it('onClose : rappel unique, pour sa page seulement', async () => {
        const [p1] = await pilote.findPages('wa-1');
        const ferme = vi.fn();
        p1.onClose(ferme);
        transport.emettre({ event: 'closed', pageId: 2 });
        transport.emettre({ event: 'closed', pageId: 1 });
        transport.emettre({ event: 'closed', pageId: 1 });
        expect(ferme).toHaveBeenCalledTimes(1);
    });

    it('bout à bout : l\'observateur de commandes remonte un message par la liaison', async () => {
        vi.useFakeTimers();
        try {
            document.body.innerHTML = `
                <div id="pane-side"><div data-testid="cell-frame-container">
                  <div data-testid="cell-frame-title"><span title="Awa Boutique" dir="auto">Awa Boutique</span></div>
                  <div data-testid="cell-frame-secondary"><span dir="ltr">Je veux 2 pagnes wax</span></div>
                </div></div>`;
            const [page] = await pilote.findPages('wa-1');
            const recus = [];
            await page.exposeFunction('onNewWaMessage', (c, t) => recus.push([c, t]));
            await page.exposeFunction('onIolDebug', () => {});
            await page.exposeFunction('onNewWaVoiceNote', () => {});
            await page.evaluateWithSelectors(observerInPage, paquetLivre());
            await vi.advanceTimersByTimeAsync(3000);
            expect(recus).toEqual([['Awa Boutique', 'Je veux 2 pagnes wax']]);
            if (window.__iol_poller) clearInterval(window.__iol_poller);
            if (window.__iol_observer) window.__iol_observer.disconnect();
        } finally {
            vi.useRealTimers();
        }
    });
});

describe('processus', () => {
    it('le CLI et le MCP ne sont pas le backend tant que server.js ne l\'a pas déclaré', () => {
        expect(driver.isBackendProcess()).toBe(false);
    });
});
