// Lecture de la conversation par le copilote (26/11/2026). Le script est
// construit avec le VRAI code de préparation du backend (inPageSelectors,
// sérialisé comme le fait GET /api/wa/selectors), puis évalué dans jsdom sur
// un DOM synthétique — aucune capture d'une vraie conversation.
import { describe, it, expect } from 'vitest';
import { createRequire } from 'node:module';
import os from 'node:os';
import { buildContextExtractionScript } from '../utils/whatsappContextScript';

const require = createRequire(import.meta.url);
const sel = require('../../backend/wa/waSelectors');

const registre = (distants) => {
    const page = sel.createSelectorRegistry({ dataDir: os.tmpdir(), cles: [] }).forPage();
    if (distants) page.lists = sel.mergeSelectors(distants);
    return { helper: sel.inPageSelectors.toString(), page };
};
const lire = (html, reg = registre()) => {
    document.body.innerHTML = html;
    // eval indirect : portée globale, comme executeJavaScript dans la webview.
    return (0, eval)(buildContextExtractionScript(reg));
};

describe('script de contexte du copilote', () => {
    it('lit le contact et les messages, et attribue chaque message au bon côté', async () => {
        const r = await lire(`
            <div id="pane-side"></div>
            <div id="main">
              <header><span data-testid="conversation-info-header-chat-title" title="Awa Boutique">Awa Boutique</span></header>
              <div data-id="false_22500000000@c.us_A"><span class="selectable-text">Bonjour, le bazin est dispo ?</span></div>
              <div data-id="true_22500000000@c.us_B"><span class="selectable-text">Oui, en trois couleurs.</span></div>
            </div>`);
        expect(r.error).toBeUndefined();
        expect(r.contactName).toBe('Awa Boutique');
        expect(r.messages.map(({ sender, text }) => ({ sender, text }))).toEqual([
            { sender: 'Awa Boutique', text: 'Bonjour, le bazin est dispo ?' },
            { sender: 'You', text: 'Oui, en trois couleurs.' },
        ]);
        expect(r.debug).toMatchObject({ strategyUsed: 'data-id', hasMainPanel: true, hasPaneSide: true, selectorsVersion: 0 });
    });

    it('un en-tête renommé par WhatsApp : « Unknown » avec les livrés, retrouvé avec un fichier distant', async () => {
        const html = `
            <div id="main">
              <header><span data-testid="chat-title-v2" title="Kouassi">Kouassi</span></header>
              <div data-id="false_1@c.us_A"><span class="selectable-text">Je prends deux</span></div>
            </div>`;
        expect((await lire(html)).contactName).toBe('Unknown');
        const r = await lire(html, registre({ copilotHeaderTitle: ['[data-testid="chat-title-v2"]'] }));
        expect(r.contactName).toBe('Kouassi');
        expect(r.messages[0]).toMatchObject({ sender: 'Kouassi', text: 'Je prends deux' });
    });

    it('un candidat distant invalide ne casse pas la lecture', async () => {
        const r = await lire(
            '<div id="main"><div data-id="false_1@c.us_A"><span class="selectable-text">Prix ?</span></div></div>',
            registre({ copilotMessageText: ['span[[cassé'] })
        );
        expect(r.error).toBeUndefined();
        expect(r.messages.map((m) => m.text)).toEqual(['Prix ?']);
    });

    it('repli sur les lignes ARIA hors liste de conversations quand rien d\'autre ne répond', async () => {
        const r = await lire(`
            <div id="pane-side"><div role="row"><span dir="ltr">Liste : à ignorer</span></div></div>
            <div id="main"><div role="row"><span dir="ltr">Message ouvert</span></div></div>`);
        expect(r.debug.strategyUsed).toBe('aria-row');
        expect(r.messages.map((m) => m.text)).toEqual(['Message ouvert']);
    });
});
