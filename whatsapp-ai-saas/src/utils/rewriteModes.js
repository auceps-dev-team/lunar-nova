/**
 * Réécriture d'un passage dans l'outil de rédaction.
 *
 * Jusqu'au 26/11/2026, une seule réécriture existait (« plus professionnel et
 * percutant »), et le texte réécrit était inséré à la sélection courante AU
 * RETOUR de la réponse — 30 à 60 s plus tard avec un CLI local : si
 * l'utilisateur avait cliqué ailleurs entre-temps, il atterrissait au mauvais
 * endroit. La sélection est désormais capturée au clic, et restaurée avant
 * l'insertion.
 */

export const REWRITE_MODES = [
    { id: 'improve', labelKey: 'rewriteImprove', instruction: 'Améliore ce texte : plus clair, plus professionnel et plus percutant.' },
    { id: 'fix', labelKey: 'rewriteFix', instruction: "Corrige uniquement l'orthographe, la grammaire et la ponctuation, sans changer le sens, le ton ni la structure." },
    { id: 'shorten', labelKey: 'rewriteShorten', instruction: "Raccourcis ce texte d'environ moitié en gardant l'essentiel du message." },
    { id: 'expand', labelKey: 'rewriteExpand', instruction: "Développe ce texte avec des précisions utiles, sans inventer de faits, de chiffres ni de promesses." },
    { id: 'whatsapp', labelKey: 'rewriteWhatsapp', instruction: "Réécris ce texte pour un message WhatsApp à un client : ton chaleureux et direct, phrases courtes, au plus deux emojis." },
    { id: 'formal', labelKey: 'rewriteFormal', instruction: 'Réécris ce texte sur un ton plus formel et respectueux, adapté à un courrier professionnel.' },
];

/**
 * Consigne complète envoyée à l'agent.
 * @param {string} modeId identifiant de REWRITE_MODES (repli : « improve »).
 * @param {string} texte passage sélectionné.
 */
export function buildRewritePrompt(modeId, texte) {
    const mode = REWRITE_MODES.find((m) => m.id === modeId) || REWRITE_MODES[0];
    return `${mode.instruction}\n\nRègles : garde la langue du texte d'origine. Renvoie UNIQUEMENT le texte réécrit, sans introduction, sans guillemets et sans formatage markdown.\n\nTexte :\n"""\n${texte}\n"""`;
}

/**
 * Texte réécrit nettoyé de ce que les modèles ajoutent malgré la consigne :
 * clôtures ```, guillemets ou triples guillemets repris de la consigne,
 * enveloppe JSON { "text": … } de certains agents.
 * @returns {string} chaîne vide si la réponse n'est pas exploitable.
 */
export function cleanRewriteResponse(reponse) {
    if (typeof reponse !== 'string') return '';
    let texte = reponse.trim();
    if (texte.startsWith('{')) {
        try {
            const objet = JSON.parse(texte);
            if (typeof objet.text === 'string') texte = objet.text.trim();
        } catch { /* pas du JSON : texte brut, cas nominal */ }
    }
    texte = texte.replace(/^```[a-z]*\s*/i, '').replace(/\s*```$/, '').trim();
    const enveloppes = [['"""', '"""'], ['"', '"'], ['«', '»'], ['“', '”']];
    for (const [ouvre, ferme] of enveloppes) {
        if (texte.length >= ouvre.length + ferme.length && texte.startsWith(ouvre) && texte.endsWith(ferme)) {
            texte = texte.slice(ouvre.length, -ferme.length).trim();
            break;
        }
    }
    return texte;
}

/**
 * Plage de la sélection courante si, et seulement si, elle est non vide et
 * entièrement dans `editeur` ; sinon null. Rendue clonée : elle reste valable
 * quand l'utilisateur sélectionne autre chose pendant l'attente.
 */
export function captureSelectionIn(editeur, selection = (typeof window !== 'undefined' ? window.getSelection() : null)) {
    if (!editeur || !selection || selection.rangeCount === 0) return null;
    const range = selection.getRangeAt(0);
    if (range.collapsed || !range.toString().trim()) return null;
    if (!editeur.contains(range.commonAncestorContainer)) return null;
    return range.cloneRange();
}

/**
 * Remet `range` comme sélection courante, pour qu'une insertion la remplace.
 *
 * Refuse si le passage n'est plus là. Relevé par le test : quand le contenu
 * de l'éditeur est remplacé pendant l'attente, le DOM replie la plage en un
 * point (toujours dans l'éditeur) — sans ce refus, le texte réécrit aurait été
 * inséré en tête du document.
 *
 * @param {string} [texteAttendu] le passage sélectionné au clic ; s'il a
 *        changé entre-temps, on n'écrase pas la modification de l'utilisateur.
 * @returns {boolean} vrai si la sélection est restaurée.
 */
export function restoreSelection(editeur, range, texteAttendu, selection = (typeof window !== 'undefined' ? window.getSelection() : null)) {
    if (!editeur || !range || !selection || range.collapsed) return false;
    if (!editeur.contains(range.commonAncestorContainer)) return false;
    if (texteAttendu !== undefined && range.toString() !== texteAttendu) return false;
    selection.removeAllRanges();
    selection.addRange(range);
    return true;
}
