// @vitest-environment node
//
// Navigateur des automatisations (27/11/2026) : Edge, puis Chrome, puis le
// Chromium de Playwright. Le projet n'installe pas les navigateurs de
// Playwright ; mesuré : la 1.65.1 attend Chromium 1255, absent d'un poste qui
// avait celui de la 1.58 — factures et extracteurs échouaient.
import { describe, it, expect } from 'vitest';

const { lancerNavigateur } = require('../services/navigateur');

function fauxChromium(disponibles) {
    const appels = [];
    return {
        appels,
        async launch(options) {
            appels.push(options);
            const canal = options.channel || 'chromium';
            if (!disponibles.includes(canal)) throw new Error(`browserType.launch: ${canal} introuvable\nlignes suivantes`);
            return { canal, close: async () => {} };
        },
    };
}

describe('lancerNavigateur', () => {
    it('prend Edge quand il est là, avec les options demandées', async () => {
        const chromium = fauxChromium(['msedge', 'chrome', 'chromium']);
        const n = await lancerNavigateur({ headless: true }, { chromium });
        expect(n.canal).toBe('msedge');
        expect(n.wacopiloteNavigateur).toBe('Microsoft Edge');
        expect(chromium.appels).toEqual([{ headless: true, channel: 'msedge' }]);
    });

    it('sans Edge : Chrome, puis le Chromium de Playwright', async () => {
        const sansEdge = fauxChromium(['chrome', 'chromium']);
        expect((await lancerNavigateur({ headless: true }, { chromium: sansEdge })).canal).toBe('chrome');

        const seulChromium = fauxChromium(['chromium']);
        const n = await lancerNavigateur({ headless: true }, { chromium: seulChromium });
        expect(n.canal).toBe('chromium');
        expect(seulChromium.appels.map((o) => o.channel)).toEqual(['msedge', 'chrome', undefined]);
    });

    it('close() rend la main au plus tard après le délai, même si le navigateur traîne', async () => {
        let fermetureDemandee = false;
        const chromium = { launch: async () => ({ close: () => { fermetureDemandee = true; return new Promise(() => {}); } }) };
        const n = await lancerNavigateur({ headless: true }, { chromium, delaiFermetureMs: 50 });
        const t = Date.now();
        await n.close();
        expect(fermetureDemandee).toBe(true);
        expect(Date.now() - t).toBeLessThan(1000);
    });

    it('close() rapide : rend la main dès la fermeture, sans attendre le délai', async () => {
        const chromium = { launch: async () => ({ close: async () => {} }) };
        const n = await lancerNavigateur({ headless: true }, { chromium, delaiFermetureMs: 5000 });
        const t = Date.now();
        await n.close();
        expect(Date.now() - t).toBeLessThan(500);
    });

    it('aucun navigateur : une erreur 503 qui nomme les trois échecs', async () => {
        await expect(lancerNavigateur({ headless: true }, { chromium: fauxChromium([]) })).rejects.toMatchObject({
            statusCode: 503,
            message: expect.stringMatching(/Microsoft Edge : .*msedge introuvable \| Google Chrome : .*\| Chromium de Playwright : /),
        });
    });
});

// Vrai navigateur, sans réseau : le PDF d'une facture passe par Edge. Windows
// seulement (Edge fait partie du système) ; la CI Linux n'a pas Edge.
describe.skipIf(process.platform !== 'win32')('lancerNavigateur — Edge réel (Windows)', () => {
    it('Edge produit un PDF, sans navigateur téléchargé par Playwright', async () => {
        const n = await lancerNavigateur({ headless: true });
        try {
            expect(n.wacopiloteNavigateur).toBe('Microsoft Edge');
            const page = await n.newPage();
            await page.setContent('<h1>Devis</h1><p>Test</p>');
            const pdf = await page.pdf({ format: 'A4' });
            expect(pdf.subarray(0, 5).toString()).toBe('%PDF-');
        } finally {
            await n.close();
        }
    }, 60000);
});
