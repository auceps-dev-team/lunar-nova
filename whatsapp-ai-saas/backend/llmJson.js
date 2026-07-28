/**
 * Extraction du JSON contenu dans une réponse de LLM.
 *
 * Les adaptateurs faisaient tous la même chose : retirer les délimiteurs de bloc
 * de code puis appeler JSON.parse. Ça suffit quand le modèle répond exactement ce
 * qu'on lui demande, et ça échoue dès qu'il ajoute une phrase d'introduction
 * (« Voici les réponses : ... »), un commentaire final, ou du texte autour du
 * bloc — comportements courants et qui varient d'un fournisseur à l'autre.
 *
 * La logique était dupliquée à cinq endroits, donc corrigée nulle part.
 */

/**
 * Retire les délimiteurs Markdown d'un bloc de code.
 * Gère ```json, ```JSON, ``` seuls, et les variantes sans saut de ligne final.
 */
function stripCodeFences(text) {
    return String(text)
        .replace(/```[a-zA-Z]*\s*/g, '')
        .replace(/```/g, '')
        .trim();
}

/**
 * Isole le premier objet ou tableau JSON complet du texte, en suivant
 * l'équilibre des accolades. Les accolades apparaissant dans une chaîne — un cas
 * réel dès qu'un message client contient « { » — sont ignorées, ce qu'une simple
 * recherche du dernier « } » ne sait pas faire.
 */
function extractFirstJsonBlock(text) {
    const start = text.search(/[{[]/);
    if (start === -1) return null;

    const opening = text[start];
    const closing = opening === '{' ? '}' : ']';
    let depth = 0;
    let inString = false;
    let escaped = false;

    for (let i = start; i < text.length; i++) {
        const ch = text[i];

        if (escaped) { escaped = false; continue; }
        if (ch === '\\') { escaped = true; continue; }
        if (ch === '"') { inString = !inString; continue; }
        if (inString) continue;

        if (ch === opening) depth++;
        else if (ch === closing) {
            depth--;
            if (depth === 0) return text.slice(start, i + 1);
        }
    }
    return null;
}

/**
 * Analyse la réponse d'un LLM et renvoie la valeur JSON qu'elle contient.
 *
 * @param {string} raw        Contenu brut renvoyé par le modèle
 * @param {*}      fallback   Valeur renvoyée si rien d'exploitable n'est trouvé
 * @returns {*} La valeur analysée, ou `fallback`
 */
function parseLlmJson(raw, fallback = null) {
    if (raw === null || raw === undefined) return fallback;

    const cleaned = stripCodeFences(raw);
    if (!cleaned) return fallback;

    try {
        return JSON.parse(cleaned);
    } catch {
        // Le modèle a probablement entouré le JSON de texte libre.
    }

    const block = extractFirstJsonBlock(cleaned);
    if (block) {
        try {
            return JSON.parse(block);
        } catch {
            // Bloc malformé : on abandonne plutôt que de deviner.
        }
    }

    return fallback;
}

module.exports = { parseLlmJson, stripCodeFences, extractFirstJsonBlock };
