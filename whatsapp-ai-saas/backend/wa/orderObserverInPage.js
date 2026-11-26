/**
 * Observateur de commandes, exécuté DANS la page WhatsApp (sérialisé par
 * puppeteer). Jusqu'au 26/11/2026, ce code était écrit en ligne dans
 * page.evaluate(), sélecteurs compris. Il reçoit désormais `sel`, préparé dans
 * la page par inPageSelectors (wa/waSelectors.js) : `sel.S.<clé>` est une
 * liste de sélecteurs, `sel.first(racine, clé)` essaie les candidats dans
 * l'ordre. Les ancrages liés au code — `[data-id]` et ses préfixes
 * true_/false_, `conv-msg-<id>`, l'attribut data-pre-plain-text lu — restent
 * écrits ici : les changer exige de changer le code qui les interprète.
 * Module à part, sans dépendance : son test (DOM synthétique,
 * orderObserverInPage.test.js) ne charge ni la base ni les services d'IA.
 */
/* eslint-disable no-undef */
function observerInPage(sel) {
    if (!document.body || window.__iol_observer) return;
    
    window.onIolDebug('🚀 Order Observer attaché (V3: Strict Structural Scraping) !');

    // Déduplication des messages déjà traités.
    //
    // C'était un Set sans borne, alimenté toutes les 3 secondes par le
    // poller : sur une session WhatsApp laissée ouverte plusieurs jours,
    // il grossissait indéfiniment dans l'onglet. La fenêtre glissante
    // conserve les N dernières empreintes, ce qui suffit largement à
    // éviter les doublons — un message identique réapparaissant après
    // des milliers d'autres est de toute façon un nouvel événement.
    if (!window.__iol_seen) {
        const MAX_SEEN = 500;
        const order = [];
        const set = new Set();
        window.__iol_seen = {
            has: (k) => set.has(k),
            add: (k) => {
                if (set.has(k)) return;
                set.add(k);
                order.push(k);
                if (order.length > MAX_SEEN) set.delete(order.shift());
            }
        };
    }
    
    // 1. Polling for Left Panel (Global incoming messages across all chats!)
    if (!window.__iol_poller) {
        window.__iol_poller = setInterval(() => {
            // WhatsApp's atomic CSS classes (x78zum5, x6s0dn4, ...) are regenerated on every
            // redesign, but the data-testid anchors it ships for its own QA are stable across
            // rebuilds, so prefer those; fall back to the older generic-attribute scraping only
            // if the testids are absent (older client build).
            let recentChats = Array.from(document.querySelectorAll(sel.S.chatListItem)).slice(0, 15);
            if (recentChats.length === 0) {
                const contactNodes = document.querySelectorAll(sel.S.chatListName);
                recentChats = Array.from(contactNodes).slice(0, 15).map(node => node.closest(sel.S.chatListRow));
            }

            for (const chatItem of recentChats) {
                if (!chatItem) continue;

                let contact = 'Client (Liste)';
                const nameNode = sel.first(chatItem, 'chatItemTitle');
                if (nameNode) contact = nameNode.getAttribute('title') || nameNode.innerText;

                // Try to get message preview, scoped to the preview area when available to avoid
                // picking up unrelated dir="ltr" spans (e.g. group sender-name prefixes).
                let text = '';
                const previewScope = sel.first(chatItem, 'chatItemPreview') || chatItem;
                const spans = previewScope.querySelectorAll(sel.S.previewText);
                for (const node of spans) {
                    const t = node.innerText || node.textContent || '';
                    if (t && t.length > 2 && t !== contact) text = t;
                }

                if (text && text.trim().length > 0) {
                    const hash = contact + '|' + text.trim();
                    if (!window.__iol_seen.has(hash)) {
                        window.__iol_seen.add(hash);
                        window.onIolDebug(`[Poller] Nouveau message en liste (${text.length} car.)`);
                        window.onNewWaMessage(contact, text.trim());
                    }
                }
            }
        }, 3000);
    }

    // WhatsApp's atomic CSS class names get regenerated on every redesign, so
    // '.copyable-text[data-pre-plain-text]' can silently stop matching anything. The
    // 'data-id' on a message row (prefixed 'true_'/'false_' for outgoing/incoming) is
    // WhatsApp's own internal store key, not a style artifact, so it survives UI overhauls
    // and is used here as the primary anchor; the legacy class-based anchor is kept as a
    // fallback for older client builds.
    const isMessageDataId = (id) => !!id && (id.startsWith('true_') || id.startsWith('false_'));
    const getMsgRoot = (el) => {
        if (!el || !el.closest) return null;
        const legacy = el.closest(sel.S.messageLegacy);
        if (legacy) return legacy;
        const modern = el.closest('[data-id]');
        if (modern && isMessageDataId(modern.getAttribute('data-id'))) return modern;
        // Last resort: the chat list in this build uses role="row" grid items and the message
        // list likely shares the same virtualization pattern; excluding #pane-side keeps this
        // from double-processing sidebar rows already covered by the poller above.
        const ariaRow = el.closest(sel.S.messageRow);
        if (ariaRow && !ariaRow.closest(sel.S.chatListPane)) return ariaRow;
        return null;
    };

    // 2. Specialized Mutation Observer for Active Chat
    window.__iol_observer = new MutationObserver((mutations) => {
        // Note vocale (message `ptt`). Traitée AVANT l'extraction de
        // texte : sans ce détour, les ancrages [data-id] et role="row"
        // attrapent la ligne et en tirent comme « texte » ce qui s'y
        // affiche (durée, heure), que le filtre par mots-clés rejette —
        // le vocal se perdait sans bruit.
        //
        // Mesuré le 19/09/2026 sur une instance réelle : l'ancre
        // [data-testid="ptt-status"] et l'identifiant porté par
        // [data-testid="conv-msg-<id>"]. Le nom du contact, en revanche,
        // n'a pas été mesuré pour les vocaux : on tente le bouton
        // d'auteur puis l'en-tête de conversation, avec un repli neutre.
        const handleVoiceNote = (msg) => {
            const row = (msg.closest && msg.closest(sel.S.messageRow)) || msg;
            if (!row.querySelector || !row.querySelector(sel.S.voiceStatus)) return false;

            // Un vocal sortant est envoyé par le commerçant lui-même :
            // ce n'est pas une commande, et la transcrire coûterait
            // ~30 s de processeur pour rien.
            const idEl = (row.matches && row.matches('[data-id]')) ? row : row.querySelector('[data-id]');
            const dataId = idEl ? (idEl.getAttribute('data-id') || '') : '';
            if (dataId.startsWith('true_')) return true;

            const convEl = row.querySelector('[data-testid^="conv-msg-"]');
            const messageId = convEl ? convEl.getAttribute('data-testid').replace('conv-msg-', '') : '';
            if (!messageId) return true;

            const key = 'ptt|' + messageId;
            if (window.__iol_seen.has(key)) return true;
            window.__iol_seen.add(key);

            let contact = 'Client (Actif)';
            const author = sel.first(row, 'messageAuthor');
            const authorName = author ? (author.getAttribute('aria-label') || author.innerText || '').trim() : '';
            const header = sel.first(document, 'conversationTitle');
            if (authorName) contact = authorName;
            else if (header && header.getAttribute('title')) contact = header.getAttribute('title');

            window.onIolDebug('[Observer] Note vocale entrante détectée');
            if (typeof window.onNewWaVoiceNote === 'function') {
                window.onNewWaVoiceNote(contact, messageId);
            }
            return true;
        };

        const processMessageNode = (msg) => {
            if (!msg) return;
            try {
                if (handleVoiceNote(msg)) return;

                const preTextNode = msg.hasAttribute('data-pre-plain-text') ? msg : msg.querySelector(sel.S.prePlainText);
                const preText = preTextNode ? (preTextNode.getAttribute('data-pre-plain-text') || '') : '';
                let contact = 'Client (Actif)';
                const match = preText.match(/\]\s([^:]+):/);
                if (match && match[1]) {
                    contact = match[1].trim();
                }

                const textNode = msg.querySelector(sel.S.messageText);
                const text = textNode ? (textNode.innerText || textNode.textContent || '').trim() : msg.innerText.trim();

                if (text && text.length > 5) {
                    const hash = contact + '|' + text;
                    if (!window.__iol_seen.has(hash)) {
                        window.__iol_seen.add(hash);
                        window.onIolDebug(`[Observer] Nouveau message en conversation (${text.length} car.)`);
                        window.onNewWaMessage(contact, text);
                    }
                }
            } catch {}
        };

        for (const m of mutations) {
            if (m.type === 'characterData' && m.target && m.target.parentElement) {
                const parentMsg = getMsgRoot(m.target.parentElement);
                if (parentMsg) processMessageNode(parentMsg);
                continue;
            }

        for (const node of m.addedNodes) {
            if (node.nodeType !== 1) {
                if (node.parentElement) {
                    const pMsg = getMsgRoot(node.parentElement);
                    if (pMsg) processMessageNode(pMsg);
                }
                continue;
            }

            const msgDivs = Array.from(node.querySelectorAll ? node.querySelectorAll(sel.S.messageLegacy) : []);
            if (node.matches && node.matches(sel.S.messageLegacy)) {
                msgDivs.push(node);
            }
            if (node.querySelectorAll) {
                Array.from(node.querySelectorAll('[data-id]')).forEach(el => {
                    if (isMessageDataId(el.getAttribute('data-id')) && !msgDivs.includes(el)) msgDivs.push(el);
                });
            }
            if (node.matches) {
                const id = node.getAttribute && node.getAttribute('data-id');
                if (isMessageDataId(id) && !msgDivs.includes(node)) msgDivs.push(node);
            }

            if (msgDivs.length === 0) {
                if (node.querySelectorAll) {
                    Array.from(node.querySelectorAll(sel.S.messageRow)).forEach(el => {
                        if (!el.closest(sel.S.chatListPane) && !msgDivs.includes(el)) msgDivs.push(el);
                    });
                }
                if (node.matches && node.matches(sel.S.messageRow) && !node.closest(sel.S.chatListPane) && !msgDivs.includes(node)) {
                    msgDivs.push(node);
                }
            }

            // If the node we're adding is INSIDE an existing message container
            const parentMsg = getMsgRoot(node);
            if (parentMsg && !msgDivs.includes(parentMsg)) {
                msgDivs.push(parentMsg);
            }

            for (const msg of msgDivs) {
                processMessageNode(msg);
            }
        } // Ends addedNodes loop
    } // Ends mutations loop
});

// Track both structural additions and text rendering variations
window.__iol_observer.observe(document.body, { childList: true, subtree: true, characterData: true });
}
/* eslint-enable no-undef */

module.exports = { observerInPage };
