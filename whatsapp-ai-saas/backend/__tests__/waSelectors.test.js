// Registre des sélecteurs WhatsApp et sa mise à jour signée (lot 7, 26/11/2026).
// Clés Ed25519 générées pour chaque essai, dossier de données par mkdtemp :
// aucune clé réelle, aucun réseau, aucun fichier partagé.
// @vitest-environment node
import { describe, it, expect, beforeEach, afterEach } from 'vitest';

const crypto = require('crypto');
const fs = require('fs');
const os = require('os');
const path = require('path');
const sel = require('../wa/waSelectors');

const paireDeCles = () => {
    const { publicKey, privateKey } = crypto.generateKeyPairSync('ed25519');
    return { publique: publicKey.export({ format: 'der', type: 'spki' }).toString('base64'), privee: privateKey };
};
const signer = (octets, privee) => crypto.sign(null, octets, privee).toString('base64');
const fichierSigne = (contenu, privee) => {
    const octets = Buffer.from(JSON.stringify(contenu, null, 2));
    return { octets, sig: signer(octets, privee) };
};
// Faux `fetch` : sert le fichier et sa signature comme la release GitHub.
const fauxFetch = (publication) => async (url) => {
    const corps = url.endsWith('.sig') ? Buffer.from(publication.sig) : publication.octets;
    if (!corps) return { ok: false, status: 404, arrayBuffer: async () => new ArrayBuffer(0) };
    return { ok: true, status: 200, arrayBuffer: async () => corps.buffer.slice(corps.byteOffset, corps.byteOffset + corps.byteLength) };
};

let dossier;
beforeEach(() => { dossier = fs.mkdtempSync(path.join(os.tmpdir(), 'wa-selectors-')); });
afterEach(() => { fs.rmSync(dossier, { recursive: true, force: true }); });

describe('valeurs livrées', () => {
    it('chaque clé a un mode, et des sélecteurs livrés que le validateur accepte', () => {
        for (const [cle, def] of Object.entries(sel.KEYS)) {
            expect(['first', 'any'], cle).toContain(def.mode);
            const r = sel.validateSelectorFile({ schema: 1, version: 1, selectors: { [cle]: def.defaults } });
            expect(r.erreurs, cle).toEqual([]);
        }
    });

    it('sans clé de confiance, les mises à jour distantes sont désactivées — et l\'état le dit', async () => {
        let appels = 0;
        const reg = sel.createSelectorRegistry({ dataDir: dossier, cles: [], fetchImpl: async () => { appels++; return null; } });
        const r = await reg.checkForUpdate();
        expect(r.updated).toBe(false);
        expect(appels).toBe(0);
        expect(reg.status()).toMatchObject({ source: 'bundled', version: 0, remoteEnabled: false });
        expect(reg.status().lastResult).toMatch(/désactivé/);
    });

    it('la clé de confiance livrée est vide tant que la garde de la clé privée n\'est pas décidée', () => {
        expect(sel.TRUSTED_KEYS).toEqual([]);
    });
});

describe('validation du fichier', () => {
    const base = (selectors, extra = {}) => ({ schema: 1, version: 2, selectors, ...extra });

    it('refuse schéma, version et forme invalides', () => {
        expect(sel.validateSelectorFile(base({}, { schema: 2 })).ok).toBe(false);
        expect(sel.validateSelectorFile(base({}, { version: 0 })).ok).toBe(false);
        expect(sel.validateSelectorFile(base({}, { version: 1.5 })).ok).toBe(false);
        expect(sel.validateSelectorFile({ schema: 1, version: 2, selectors: [] }).ok).toBe(false);
        expect(sel.validateSelectorFile(null).ok).toBe(false);
    });

    it('refuse liste vide, trop longue, non textuelle, et caractères de code ou de balisage', () => {
        expect(sel.validateSelectorFile(base({ chatListItem: [] })).ok).toBe(false);
        expect(sel.validateSelectorFile(base({ chatListItem: Array(9).fill('div') })).ok).toBe(false);
        expect(sel.validateSelectorFile(base({ chatListItem: [42] })).ok).toBe(false);
        expect(sel.validateSelectorFile(base({ chatListItem: ['x'.repeat(301)] })).ok).toBe(false);
        for (const mauvais of ['div{color:red}', 'div; alert(1)', '<img>', 'a`b', 'a\\62', 'a\nb']) {
            expect(sel.validateSelectorFile(base({ chatListItem: [mauvais] })).ok, mauvais).toBe(false);
        }
    });

    it('accepte le combinateur enfant, les attributs et :not()', () => {
        const r = sel.validateSelectorFile(base({ chatListItem: ['#pane-side > div[role="row"]:not([aria-hidden="true"])'] }));
        expect(r.ok).toBe(true);
    });

    it('ignore — en les nommant — les clés inconnues d\'un fichier plus récent', () => {
        const r = sel.validateSelectorFile(base({ chatListItem: ['div.x'], cleDuFutur: ['div.y'] }));
        expect(r.ok).toBe(true);
        expect(r.ignorees).toEqual(['cleDuFutur']);
        expect(r.selectors).toEqual({ chatListItem: ['div.x'] });
    });

    it('respecte minApp', () => {
        expect(sel.validateSelectorFile(base({}, { minApp: '9.0.0' }), { appVersion: '1.51.0' }).ok).toBe(false);
        expect(sel.validateSelectorFile(base({}, { minApp: '1.50.0' }), { appVersion: '1.51.0' }).ok).toBe(true);
        expect(sel.validateSelectorFile(base({}, { minApp: 'bientôt' }), { appVersion: '1.51.0' }).ok).toBe(false);
    });
});

describe('signature', () => {
    it('accepte la bonne clé, refuse une autre clé, un octet modifié, une signature tronquée', () => {
        const a = paireDeCles();
        const b = paireDeCles();
        const { octets, sig } = fichierSigne({ schema: 1, version: 3, selectors: {} }, a.privee);
        expect(sel.verifySignature(octets, sig, [a.publique])).toBe(true);
        expect(sel.verifySignature(octets, sig, [b.publique])).toBe(false);
        expect(sel.verifySignature(octets, sig, [b.publique, a.publique])).toBe(true);
        const altere = Buffer.from(octets); altere[altere.length - 3] ^= 1;
        expect(sel.verifySignature(altere, sig, [a.publique])).toBe(false);
        expect(sel.verifySignature(octets, sig.slice(0, 20), [a.publique])).toBe(false);
        expect(sel.verifySignature(octets, 'pas du base64 !', [a.publique])).toBe(false);
        expect(sel.verifySignature(octets, sig, ['clé illisible'])).toBe(false);
    });

    it('la signature précède l\'analyse : un JSON signé mais invalide est refusé pour son contenu, un JSON non signé ne l\'est même pas analysé', () => {
        const a = paireDeCles();
        const invalide = fichierSigne({ schema: 1, version: 3, selectors: { chatListItem: ['div{}'] } }, a.privee);
        expect(sel.verifyAndParse(invalide.octets, invalide.sig, { cles: [a.publique] }).erreurs.join()).toMatch(/caractère refusé/);
        expect(sel.verifyAndParse(Buffer.from('{ illisible'), 'AAAA', { cles: [a.publique] }).erreurs).toEqual(['signature invalide']);
    });
});

describe('mise à jour, conservation, retour arrière', () => {
    const publication = { octets: null, sig: '' };
    const publier = (contenu, privee) => Object.assign(publication, fichierSigne(contenu, privee));

    it('applique une version signée plus récente, distants d\'abord et livrés derrière', async () => {
        const a = paireDeCles();
        publier({ schema: 1, version: 4, selectors: { chatListItem: ['[data-testid="chat-row-v2"]'] } }, a.privee);
        const reg = sel.createSelectorRegistry({ dataDir: dossier, cles: [a.publique], fetchImpl: fauxFetch(publication) });
        const r = await reg.checkForUpdate();
        expect(r).toMatchObject({ updated: true, version: 4 });
        expect(reg.selectors.chatListItem).toEqual(['[data-testid="chat-row-v2"]', '[data-testid="cell-frame-container"]']);
        expect(reg.selectors.appReady).toEqual(sel.KEYS.appReady.defaults);
        expect(reg.status()).toMatchObject({ source: 'remote', version: 4 });
    });

    it('refuse une version égale ou plus ancienne (pas de rejeu d\'un ancien fichier signé)', async () => {
        const a = paireDeCles();
        const reg = sel.createSelectorRegistry({ dataDir: dossier, cles: [a.publique], fetchImpl: fauxFetch(publication) });
        publier({ schema: 1, version: 5, selectors: { chatListItem: ['div.v5'] } }, a.privee);
        await reg.checkForUpdate();
        publier({ schema: 1, version: 4, selectors: { chatListItem: ['div.v4'] } }, a.privee);
        const r = await reg.checkForUpdate();
        expect(r.updated).toBe(false);
        expect(r.raison).toMatch(/plus ancienne/);
        expect(reg.selectors.chatListItem[0]).toBe('div.v5');
    });

    it('un fichier mal signé n\'est ni appliqué ni écrit sur le disque', async () => {
        const a = paireDeCles();
        const intrus = paireDeCles();
        publier({ schema: 1, version: 9, selectors: { chatListItem: ['div.intrus'] } }, intrus.privee);
        const reg = sel.createSelectorRegistry({ dataDir: dossier, cles: [a.publique], fetchImpl: fauxFetch(publication) });
        const r = await reg.checkForUpdate();
        expect(r.updated).toBe(false);
        expect(r.raison).toMatch(/signature invalide/);
        expect(fs.readdirSync(dossier)).toEqual([]);
        expect(reg.status().source).toBe('bundled');
    });

    it('échec réseau ou 404 : rien ne change, et la raison est rendue', async () => {
        const a = paireDeCles();
        const reg = sel.createSelectorRegistry({ dataDir: dossier, cles: [a.publique], fetchImpl: fauxFetch({ octets: null, sig: '' }) });
        const r = await reg.checkForUpdate();
        expect(r.updated).toBe(false);
        expect(r.raison).toMatch(/HTTP 404/);
        const reg2 = sel.createSelectorRegistry({ dataDir: dossier, cles: [a.publique], fetchImpl: async () => { throw new Error('ENOTFOUND github.com'); } });
        expect((await reg2.checkForUpdate()).raison).toMatch(/ENOTFOUND/);
    });

    it('au redémarrage, la version enregistrée est re-vérifiée — un fichier modifié sur le disque est écarté', async () => {
        const a = paireDeCles();
        publier({ schema: 1, version: 6, selectors: { chatListItem: ['div.v6'] } }, a.privee);
        await sel.createSelectorRegistry({ dataDir: dossier, cles: [a.publique], fetchImpl: fauxFetch(publication) }).checkForUpdate();

        const relu = sel.createSelectorRegistry({ dataDir: dossier, cles: [a.publique] });
        expect(relu.loadCached()).toMatchObject({ applied: true, version: 6 });

        const f = path.join(dossier, sel.FILE_NAME);
        fs.writeFileSync(f, fs.readFileSync(f, 'utf8').replace('div.v6', 'div.pirate'));
        const altere = sel.createSelectorRegistry({ dataDir: dossier, cles: [a.publique] });
        expect(altere.loadCached().applied).toBe(false);
        expect(altere.status().source).toBe('bundled');
    });

    it('retour arrière : revient à la version précédente, et la fautive n\'est plus réappliquée', async () => {
        const a = paireDeCles();
        const reg = sel.createSelectorRegistry({ dataDir: dossier, cles: [a.publique], fetchImpl: fauxFetch(publication) });
        publier({ schema: 1, version: 7, selectors: { chatListItem: ['div.v7'] } }, a.privee);
        await reg.checkForUpdate();
        publier({ schema: 1, version: 8, selectors: { chatListItem: ['div.v8'] } }, a.privee);
        await reg.checkForUpdate();

        expect(reg.rollback()).toMatchObject({ rolledBack: true, rejected: 8, source: 'remote', version: 7 });
        expect(reg.selectors.chatListItem[0]).toBe('div.v7');

        const r = await reg.checkForUpdate(); // la release sert toujours la v8
        expect(r.updated).toBe(false);
        expect(r.raison).toMatch(/rejetée/);

        // Et après redémarrage : toujours la v7.
        const relu = sel.createSelectorRegistry({ dataDir: dossier, cles: [a.publique] });
        expect(relu.loadCached()).toMatchObject({ applied: true, version: 7 });
    });

    it('retour arrière sans version précédente : retour aux sélecteurs livrés', async () => {
        const a = paireDeCles();
        publier({ schema: 1, version: 3, selectors: { chatListItem: ['div.v3'] } }, a.privee);
        const reg = sel.createSelectorRegistry({ dataDir: dossier, cles: [a.publique], fetchImpl: fauxFetch(publication) });
        await reg.checkForUpdate();
        expect(reg.rollback()).toMatchObject({ rolledBack: true, source: 'bundled', version: 0 });
        expect(reg.selectors).toEqual(sel.defaultSelectors());
        expect(reg.rollback().rolledBack).toBe(false);
        expect(sel.createSelectorRegistry({ dataDir: dossier, cles: [a.publique] }).loadCached().applied).toBe(false);
    });

    it('santé : un sélecteur distant trop large déclenche le retour arrière, pas une page simplement non chargée', async () => {
        const a = paireDeCles();
        publier({ schema: 1, version: 2, selectors: { appReady: ['div'] } }, a.privee);
        const reg = sel.createSelectorRegistry({ dataDir: dossier, cles: [a.publique], fetchImpl: fauxFetch(publication) });
        await reg.checkForUpdate();

        // Écran de connexion (QR) : rien n'est trouvé, ni par la fusion ni par les livrés → pas de faute.
        expect(reg.reportHealth({ appReady: { merged: 0, defaults: 0 } }).rolledBack).toBe(false);
        // Page chargée : la fusion trouve 1 800 éléments, les livrés 1 → fichier fautif.
        const r = reg.reportHealth({ appReady: { merged: 1800, defaults: 1 }, chatListItem: { merged: 12, defaults: 12 } });
        expect(r).toMatchObject({ rolledBack: true, rejected: 2, keys: ['appReady'] });
        expect(reg.status().source).toBe('bundled');
    });
});

describe('route /api/wa/selectors', () => {
    const express = require('express');
    const { createWaSelectorsRouter } = require('../routes/waSelectors');
    const servir = async (registre) => {
        const app = express();
        app.use('/api/wa/selectors', createWaSelectorsRouter(registre));
        const serveur = await new Promise((r) => { const s = app.listen(0, '127.0.0.1', () => r(s)); });
        return { serveur, base: `http://127.0.0.1:${serveur.address().port}/api/wa/selectors` };
    };

    it('GET rend l\'état, le paquet de page et le code de préparation', async () => {
        const { serveur, base } = await servir(sel.createSelectorRegistry({ dataDir: dossier, cles: [] }));
        try {
            const j = await (await fetch(base)).json();
            expect(j.registry).toMatchObject({ source: 'bundled', version: 0, remoteEnabled: false });
            expect(Object.keys(j.page.lists)).toEqual(Object.keys(sel.KEYS));
            expect(j.helper).toMatch(/^function inPageSelectors\(paquet\)/);
        } finally {
            await new Promise((r) => serveur.close(r));
        }
    });

    it('POST check et rollback rendent leur raison, sans clé ni version distante', async () => {
        const { serveur, base } = await servir(sel.createSelectorRegistry({ dataDir: dossier, cles: [] }));
        try {
            const check = await (await fetch(`${base}/check`, { method: 'POST' })).json();
            expect(check.result).toMatchObject({ updated: false });
            expect(check.result.raison).toMatch(/désactivé/);
            const retour = await (await fetch(`${base}/rollback`, { method: 'POST' })).json();
            expect(retour.result).toMatchObject({ rolledBack: false });
        } finally {
            await new Promise((r) => serveur.close(r));
        }
    });
});

describe('dans la page (jsdom)', () => {
    // Environnement node pour le registre ; jsdom chargé à la main pour la page.
    const { JSDOM } = require('jsdom');
    const executer = (html, fn, ...args) => {
        const dom = new JSDOM(`<!doctype html><body>${html}</body>`);
        const g = globalThis;
        const avant = g.document;
        g.document = dom.window.document;
        try { return fn(...args); } finally { g.document = avant; }
    };

    it('écarte un candidat que le navigateur refuse, et garde les livrés derrière', () => {
        const paquet = sel.createSelectorRegistry({ dataDir: dossier, cles: [] }).forPage();
        paquet.lists.chatListItem = ['div[[invalide', ...paquet.lists.chatListItem];
        const r = executer('<div data-testid="cell-frame-container">A</div>', () => {
            const { S } = sel.inPageSelectors(paquet);
            return { S: S.chatListItem, n: document.querySelectorAll(S.chatListItem).length };
        });
        expect(r.S).toBe('[data-testid="cell-frame-container"]');
        expect(r.n).toBe(1);
    });

    it('mode « first » : priorité à l\'ordre des candidats, pas à l\'ordre du document', () => {
        const paquet = sel.createSelectorRegistry({ dataDir: dossier, cles: [] }).forPage();
        const titre = executer(
            '<div id="c"><span title="Faux" dir="auto">avant</span><div data-testid="cell-frame-title"><span title="Awa" dir="auto">Awa</span></div></div>',
            () => sel.inPageSelectors(paquet).first(document.getElementById('c'), 'chatItemTitle').getAttribute('title')
        );
        expect(titre).toBe('Awa');
    });

    it('un candidat distant trouve ce que les livrés ne trouvent plus (WhatsApp renomme un attribut)', () => {
        const html = '<div data-testid="chat-row-v2">Commande</div>';
        const livre = sel.createSelectorRegistry({ dataDir: dossier, cles: [] }).forPage();
        const avecDistant = { ...livre, lists: sel.mergeSelectors({ chatListItem: ['[data-testid="chat-row-v2"]'] }) };
        const compter = (p) => executer(html, () => document.querySelectorAll(sel.inPageSelectors(p).S.chatListItem).length);
        expect(compter(livre)).toBe(0);
        expect(compter(avecDistant)).toBe(1);
    });

    it('les comptages de santé distinguent la fusion des livrés', () => {
        const paquet = { ...sel.createSelectorRegistry({ dataDir: dossier, cles: [] }).forPage(), lists: sel.mergeSelectors({ appReady: ['div'] }) };
        const sante = executer('<div id="pane-side"><div></div><div></div></div>', () => sel.inPageHealth(paquet, sel.CRITICAL_KEYS));
        expect(sante.appReady).toEqual({ merged: 3, defaults: 1 });
        expect(sante.chatListItem).toEqual({ merged: 0, defaults: 0 });
    });
});
