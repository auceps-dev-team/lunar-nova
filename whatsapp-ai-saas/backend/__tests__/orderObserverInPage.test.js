// Observateur de commandes exécuté dans la page WhatsApp (lot 7, 26/11/2026).
// Jusqu'ici, ce code n'avait aucun test : il était écrit en ligne dans
// page.evaluate(). Extrait en fonction (observerInPage) pour recevoir les
// sélecteurs du registre, il est exercé ici sur un DOM SYNTHÉTIQUE — aucune
// capture d'une vraie conversation (CONTRIBUTING : pas de données réelles).
// @vitest-environment jsdom
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

const { observerInPage } = require('../wa/orderObserverInPage');
const sel = require('../wa/waSelectors');

const paquetLivre = () => ({
    lists: sel.defaultSelectors(),
    defaults: Object.fromEntries(Object.entries(sel.KEYS).map(([k, d]) => [k, d.defaults])),
    modes: Object.fromEntries(Object.entries(sel.KEYS).map(([k, d]) => [k, d.mode])),
});

let recus;
let vocaux;
beforeEach(() => {
    vi.useFakeTimers();
    recus = [];
    vocaux = [];
    window.onIolDebug = () => {};
    window.onNewWaMessage = (contact, texte) => recus.push({ contact, texte });
    window.onNewWaVoiceNote = (contact, id) => vocaux.push({ contact, id });
});
afterEach(() => {
    if (window.__iol_poller) clearInterval(window.__iol_poller);
    if (window.__iol_observer) window.__iol_observer.disconnect();
    delete window.__iol_poller;
    delete window.__iol_observer;
    delete window.__iol_seen;
    document.body.innerHTML = '';
    vi.useRealTimers();
});

const lancer = (paquet = paquetLivre()) => observerInPage(sel.inPageSelectors(paquet));
const attendreMutations = async () => { await Promise.resolve(); await vi.advanceTimersByTimeAsync(0); };

describe('liste des conversations (relevé toutes les 3 s)', () => {
    it('sélecteurs livrés : le dernier message d\'une conversation est relevé une seule fois', async () => {
        document.body.innerHTML = `
            <div id="pane-side">
              <div data-testid="cell-frame-container">
                <div data-testid="cell-frame-title"><span title="Awa Boutique" dir="auto">Awa Boutique</span></div>
                <div data-testid="cell-frame-secondary"><span dir="ltr">Je veux 2 pagnes wax</span></div>
              </div>
            </div>`;
        lancer();
        await vi.advanceTimersByTimeAsync(3000);
        await vi.advanceTimersByTimeAsync(3000);
        expect(recus).toEqual([{ contact: 'Awa Boutique', texte: 'Je veux 2 pagnes wax' }]);
    });

    it('WhatsApp renomme ses ancres : rien n\'est vu avec les livrés, tout l\'est avec un fichier distant', async () => {
        const html = `
            <div id="side-v3">
              <div data-testid="chat-row-v3">
                <span title="Kouassi" dir="auto">Kouassi</span>
                <span dir="ltr">Commande : 3 bazins</span>
              </div>
            </div>`;
        document.body.innerHTML = html;
        lancer();
        await vi.advanceTimersByTimeAsync(3000);
        expect(recus).toEqual([]);

        clearInterval(window.__iol_poller); delete window.__iol_poller;
        window.__iol_observer.disconnect(); delete window.__iol_observer;
        document.body.innerHTML = html;
        const distant = { ...paquetLivre(), lists: sel.mergeSelectors({ chatListItem: ['[data-testid="chat-row-v3"]'] }) };
        lancer(distant);
        await vi.advanceTimersByTimeAsync(3000);
        expect(recus).toEqual([{ contact: 'Kouassi', texte: 'Commande : 3 bazins' }]);
    });

    it('un candidat distant invalide n\'empêche pas les livrés de fonctionner', async () => {
        document.body.innerHTML = `
            <div id="pane-side"><div data-testid="cell-frame-container">
              <div data-testid="cell-frame-title"><span title="Awa" dir="auto">Awa</span></div>
              <div data-testid="cell-frame-secondary"><span dir="ltr">Prix du bazin ?</span></div>
            </div></div>`;
        lancer({ ...paquetLivre(), lists: sel.mergeSelectors({ chatListItem: ['div[[cassé'] }) });
        await vi.advanceTimersByTimeAsync(3000);
        expect(recus).toEqual([{ contact: 'Awa', texte: 'Prix du bazin ?' }]);
    });
});

describe('conversation ouverte (observateur de mutations)', () => {
    it('un message entrant ajouté est relevé, avec l\'auteur tiré de data-pre-plain-text', async () => {
        document.body.innerHTML = '<div id="pane-side"></div><div id="main"><div id="liste"></div></div>';
        lancer();
        document.getElementById('liste').insertAdjacentHTML('beforeend', `
            <div role="row"><div data-id="false_22500000000@c.us_ABC">
              <div class="copyable-text" data-pre-plain-text="[10:01, 26/11/2026] Awa: ">
                <span class="selectable-text">Bonjour, je veux commander</span>
              </div>
            </div></div>`);
        await attendreMutations();
        expect(recus).toEqual([{ contact: 'Awa', texte: 'Bonjour, je veux commander' }]);
    });

    it('une note vocale entrante est aiguillée vers la transcription, pas lue comme texte', async () => {
        document.body.innerHTML = '<div id="pane-side"></div><div id="main"><header><span title="Kouassi">Kouassi</span></header><div id="liste"></div></div>';
        lancer();
        document.getElementById('liste').insertAdjacentHTML('beforeend', `
            <div role="row"><div data-id="false_22500000001@c.us_VOC">
              <div data-testid="conv-msg-false_22500000001@c.us_VOC"><span data-testid="ptt-status"></span><span>0:12</span></div>
            </div></div>`);
        await attendreMutations();
        expect(vocaux).toEqual([{ contact: 'Kouassi', id: 'false_22500000001@c.us_VOC' }]);
        expect(recus).toEqual([]);
    });

    it('une note vocale sortante (envoyée par le commerçant) est ignorée', async () => {
        document.body.innerHTML = '<div id="pane-side"></div><div id="main"><div id="liste"></div></div>';
        lancer();
        document.getElementById('liste').insertAdjacentHTML('beforeend', `
            <div role="row"><div data-id="true_22500000001@c.us_OUT">
              <div data-testid="conv-msg-true_22500000001@c.us_OUT"><span data-testid="ptt-status"></span></div>
            </div></div>`);
        await attendreMutations();
        expect(vocaux).toEqual([]);
    });

    it('n\'attache pas deux fois l\'observateur', () => {
        document.body.innerHTML = '<div id="pane-side"></div>';
        lancer();
        const premier = window.__iol_observer;
        lancer();
        expect(window.__iol_observer).toBe(premier);
    });
});
