// @vitest-environment node
//
// Hôte du pilote WhatsApp (processus principal, S2) : ce qu'il accepte et
// refuse, quoi que demande le backend. webContents simulés.
import { describe, it, expect, beforeEach } from 'vitest';

const { createWaDriverHost } = require('../waDriverHost.cjs');

function fauxContenu({ id, type = 'webview', url = 'https://web.whatsapp.com/', instanceId = null }) {
    const ecoutesDebogueur = {};
    let attache = false;
    const c = {
        id,
        executes: [],
        charges: [],
        commandes: [],
        detruit: false,
        rappelsDestruction: [],
        getType: () => type,
        getURL: () => url,
        isDestroyed: () => c.detruit,
        once: (ev, cb) => { if (ev === 'destroyed') c.rappelsDestruction.push(cb); },
        async executeJavaScript(code) {
            c.executes.push(code);
            if (code === 'window.__whatsapp_instance_id') return instanceId;
            return `résultat:${code.length}`;
        },
        async loadURL(u) { c.charges.push(u); },
        debugger: {
            isAttached: () => attache,
            attach: () => { attache = true; },
            on: (ev, cb) => { ecoutesDebogueur[ev] = cb; },
            sendCommand: async (method, params) => { c.commandes.push([method, params]); },
        },
        // Simule un appel de liaison par la page.
        appelLiaison: (name, payload) => ecoutesDebogueur.message && ecoutesDebogueur.message({}, 'Runtime.bindingCalled', { name, payload }),
        detruire: () => { c.detruit = true; c.rappelsDestruction.forEach((cb) => cb()); },
    };
    return c;
}

let contenus;
let evenements;
let hote;
const demander = (op, params) => hote.handle({ type: 'wa-driver-req', id: 7, op, params });

beforeEach(() => {
    contenus = [
        fauxContenu({ id: 1, instanceId: 'wa-1' }),
        fauxContenu({ id: 2, url: 'https://www.google.com/maps/search/x' }),
        fauxContenu({ id: 3, type: 'window', url: 'file:///app/dist/index.html' }),
        fauxContenu({ id: 4, url: 'https://web.whatsapp.com.evil.example/' }),
    ];
    evenements = [];
    hote = createWaDriverHost({ allWebContents: () => contenus, emit: (ev) => evenements.push(ev) });
});

describe('waDriverHost', () => {
    it('ne liste que les webviews de WhatsApp Web (ni la carte, ni la fenêtre, ni un faux domaine)', async () => {
        const r = await demander('list');
        expect(r).toEqual({ type: 'wa-driver-res', id: 7, ok: true, result: [{ pageId: 1, url: 'https://web.whatsapp.com/', instanceId: 'wa-1' }] });
    });

    it('évalue sur une page WhatsApp, avec les arguments en données JSON', async () => {
        const r = await demander('evaluate', { pageId: 1, source: '(a) => a', args: ['x"y'] });
        expect(r.ok).toBe(true);
        expect(contenus[0].executes.pop()).toBe('((a) => a).apply(null, ["x\\"y"])');
    });

    it('refuse d\'évaluer ailleurs : la carte, la fenêtre de l\'application, une page inconnue', async () => {
        for (const pageId of [2, 3, 99]) {
            const r = await demander('evaluate', { pageId, source: '() => 1', args: [] });
            expect(r.ok, `page ${pageId}`).toBe(false);
        }
        expect(contenus[1].executes).toEqual([]);
        expect(contenus[2].executes).toEqual([]);
    });

    it('ne navigue que vers WhatsApp Web', async () => {
        expect((await demander('goto', { pageId: 1, url: 'https://evil.example/' })).ok).toBe(false);
        expect((await demander('goto', { pageId: 1, url: 'https://web.whatsapp.com.evil.example/' })).ok).toBe(false);
        expect(contenus[0].charges).toEqual([]);
        expect((await demander('goto', { pageId: 1, url: 'https://web.whatsapp.com/send?phone=2250700000000', timeoutMs: 50 })).ok).toBe(true);
        expect(contenus[0].charges).toEqual(['https://web.whatsapp.com/send?phone=2250700000000']);
    });

    it('liaisons : nom de forme fixe, débogueur attaché une fois, appels relayés au backend', async () => {
        expect((await demander('addBinding', { pageId: 1, name: 'eval' })).ok).toBe(false);
        expect((await demander('addBinding', { pageId: 1, name: '__wac_onNewWaMessage' })).ok).toBe(true);
        expect((await demander('addBinding', { pageId: 1, name: '__wac_onNewWaMessage' })).ok).toBe(true);
        expect((await demander('addBinding', { pageId: 1, name: '__wac_onIolDebug' })).ok).toBe(true);
        expect(contenus[0].commandes).toEqual([
            ['Runtime.enable', undefined],
            ['Runtime.addBinding', { name: '__wac_onNewWaMessage' }],
            ['Runtime.addBinding', { name: '__wac_onIolDebug' }],
        ]);
        contenus[0].appelLiaison('__wac_onNewWaMessage', '["Awa","Bonjour"]');
        contenus[0].appelLiaison('__wac_inconnue', '[]');
        expect(evenements).toEqual([{ event: 'binding', pageId: 1, name: '__wac_onNewWaMessage', payload: '["Awa","Bonjour"]' }]);
    });

    it('signale la fermeture d\'une page suivie', async () => {
        await demander('list');
        contenus[0].detruire();
        expect(evenements).toContainEqual({ event: 'closed', pageId: 1 });
    });

    it('une opération inconnue est refusée, sans exception', async () => {
        expect(await demander('executeArbitraire', {})).toMatchObject({ ok: false, error: expect.stringMatching(/inconnue/) });
        expect(await hote.handle(null)).toMatchObject({ ok: false });
    });
});
