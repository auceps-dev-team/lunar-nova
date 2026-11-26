/**
 * Script de lecture de la conversation ouverte, exécuté dans la webview
 * WhatsApp pour le copilote (lecture seule : aucun clic, aucune saisie).
 *
 * Sorti de WorkArea.jsx le 26/11/2026 pour être testé (il n'avait aucun
 * test), et pour recevoir les sélecteurs du registre du backend
 * (backend/wa/waSelectors.js) au lieu de les écrire en dur.
 *
 * @param {{ helper: string, page: object }} registre réponse de GET /api/wa/selectors :
 *   `page` est une DONNÉE, insérée comme littéral JSON ; `helper` est le code
 *   de préparation du backend lui-même (inPageSelectors), jamais un contenu du
 *   fichier distant.
 * @returns {string} expression à passer à webview.executeJavaScript ; elle rend
 *   { contactName, messages, debug } ou { error }.
 */
export function buildContextExtractionScript(registre) {
    return `
            (async function() {
                try {
                    const result = { contactName: 'Unknown', messages: [], debug: {} };
                    const sel = (${registre.helper})(${JSON.stringify(registre.page)});

                    const headerTitle = sel.first(document, 'copilotHeaderTitle');
                    if (headerTitle) result.contactName = (headerTitle.getAttribute('title') || headerTitle.textContent || '').trim() || 'Unknown';

                    // WhatsApp renames its atomic CSS classes on every redesign (class.message-in/.message-out,
                    // .selectable-text, .copyable-text are not guaranteed to exist anymore), but the internal
                    // message-store id on each row ("true_"/"false_" prefix = outgoing/incoming) is stable across
                    // UI overhauls, so anchor on that first, then legacy classes, then a generic ARIA-row
                    // fallback (the chat list in this build uses role="row" grid items; the message list is
                    // likely rendered with the same virtualization pattern even if we can't confirm it here).
                    let messageNodes = Array.from(document.querySelectorAll('[data-id]')).filter(el => {
                        const id = el.getAttribute('data-id');
                        return id && (id.startsWith('true_') || id.startsWith('false_'));
                    });
                    result.debug.dataIdCount = messageNodes.length;

                    if (messageNodes.length === 0) {
                        messageNodes = Array.from(document.querySelectorAll(sel.S.copilotLegacyMessage));
                        result.debug.legacyClassCount = messageNodes.length;
                    }

                    if (messageNodes.length === 0) {
                        const mainPanel = sel.first(document, 'copilotMainPanel') || document.body;
                        messageNodes = Array.from(mainPanel.querySelectorAll(sel.S.messageRow)).filter(el => !el.closest(sel.S.chatListPane));
                        result.debug.ariaRowCount = messageNodes.length;
                    }

                    result.debug.strategyUsed = result.debug.dataIdCount > 0 ? 'data-id'
                        : (result.debug.legacyClassCount > 0 ? 'legacy-class'
                        : (result.debug.ariaRowCount > 0 ? 'aria-row' : 'none'));
                    result.debug.hasMainPanel = !!sel.first(document, 'copilotMainPanel');
                    result.debug.hasPaneSide = !!document.querySelector(sel.S.chatListPane);
                    result.debug.selectorsVersion = ${Number(registre.page.version) || 0};

                    messageNodes = messageNodes.slice(-15);
                    let imageCount = 0;
                    let outCount = 0;

                    // Container used for the last-resort alignment heuristic below: WhatsApp right-aligns
                    // outgoing bubbles and left-aligns incoming ones, regardless of class/testid naming.
                    const alignContainer = sel.first(document, 'copilotMainPanel') || document.body;
                    const containerRect = alignContainer.getBoundingClientRect();
                    const containerCenter = (containerRect.left + containerRect.right) / 2;

                    for (const node of messageNodes) {
                        const textNode = node.querySelector(sel.S.copilotMessageText);
                        const timeNode = node.querySelector(sel.S.copilotMessageTime);
                        const imgNode = node.querySelector('img[src^="blob:"]');

                        let text = textNode ? textNode.textContent : (node.innerText || '').trim();
                        let mediaData = null;

                        if (imgNode && imageCount < 2) {
                            try {
                                const res = await fetch(imgNode.src);
                                const blob = await res.blob();
                                mediaData = await new Promise((resolve, reject) => {
                                    const reader = new FileReader();
                                    reader.onloadend = () => resolve(reader.result);
                                    reader.onerror = reject;
                                    reader.readAsDataURL(blob);
                                });
                                imageCount++;
                            } catch (e) {
                                console.error('Error fetching image blob', e);
                            }
                        }

                        if ((text && text.length > 0) || mediaData) {
                            // The matched node (especially via the aria-row fallback) may not itself carry
                            // the direction signal - it can live on a nested element. Check own node first,
                            // then descendants, and only fall back to a position heuristic if nothing else
                            // is found (getting this wrong flips the whole conversation's speaker labels).
                            let isOut;
                            if (node.classList?.contains('message-out')) {
                                isOut = true;
                            } else if (node.classList?.contains('message-in')) {
                                isOut = false;
                            } else if (node.getAttribute('data-id')) {
                                isOut = node.getAttribute('data-id').startsWith('true_');
                            } else {
                                const nestedIdEl = node.querySelector('[data-id]');
                                const nestedId = nestedIdEl ? nestedIdEl.getAttribute('data-id') : null;
                                if (nestedId) {
                                    isOut = nestedId.startsWith('true_');
                                } else {
                                    const nestedClassEl = node.querySelector('.message-out, .message-in');
                                    if (nestedClassEl) {
                                        isOut = nestedClassEl.classList.contains('message-out');
                                    } else {
                                        try {
                                            const rect = node.getBoundingClientRect();
                                            isOut = ((rect.left + rect.right) / 2) > containerCenter;
                                        } catch (e) {
                                            isOut = false;
                                        }
                                    }
                                }
                            }
                            if (isOut) outCount++;

                            result.messages.push({
                                sender: isOut ? 'You' : result.contactName,
                                text: text || '[Image]',
                                media: mediaData,
                                time: timeNode ? (timeNode.parentElement?.textContent || timeNode.textContent || 'Unknown') : 'Unknown'
                            });
                        }
                    }
                    result.debug.outCount = outCount;
                    result.debug.totalCount = result.messages.length;
                    return result;
                } catch (e) {
                    return { error: e.toString() };
                }
            })();
`;
}
