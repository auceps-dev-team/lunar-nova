/**
 * Conversion du HTML de l'éditeur de rédaction en texte formaté WhatsApp.
 *
 * WhatsApp ne lit pas le HTML : il a sa propre syntaxe — *gras*, _italique_,
 * ~barré~, ```monospace```, listes « • » ou « 1. ». Avant le 26/11/2026, la
 * copie de l'éditeur ne rendait que le texte brut (innerText) : gras et
 * italique étaient perdus en collant dans une conversation.
 *
 * Règle WhatsApp : un marqueur doit toucher le mot (« *gras* », jamais
 * « * gras * »). Les espaces en bordure d'une balise sont donc ressortis
 * du marqueur. Le souligné n'a pas d'équivalent : il devient du texte simple.
 */

const BLOC = new Set(['P', 'DIV', 'BLOCKQUOTE', 'PRE', 'TABLE', 'TR']);
const MARQUEURS = { B: '*', STRONG: '*', I: '_', EM: '_', S: '~', STRIKE: '~', DEL: '~', CODE: '```' };

// Entoure le texte d'un marqueur en laissant les espaces de bordure dehors.
function entourer(texte, marqueur) {
    const m = /^(\s*)([\s\S]*?)(\s*)$/.exec(texte);
    if (!m[2]) return texte;
    return `${m[1]}${marqueur}${m[2]}${marqueur}${m[3]}`;
}

function enfants(noeud) {
    let s = '';
    for (const enfant of noeud.childNodes) s += convertir(enfant);
    return s;
}

function convertir(noeud) {
    if (noeud.nodeType === 3) return noeud.nodeValue.replace(/\s+/g, ' ');
    if (noeud.nodeType !== 1) return '';

    const tag = noeud.tagName;
    if (tag === 'BR') return '\n';
    if (tag === 'SCRIPT' || tag === 'STYLE') return '';

    if (tag === 'OL' || tag === 'UL') {
        let rang = 0;
        let liste = '';
        for (const item of noeud.children) {
            if (item.tagName !== 'LI') continue;
            rang += 1;
            liste += `\n${tag === 'OL' ? `${rang}.` : '•'} ${enfants(item).trim()}`;
        }
        return `${liste}\n`;
    }

    const interieur = enfants(noeud);
    if (MARQUEURS[tag]) return entourer(interieur, MARQUEURS[tag]);
    if (/^H[1-6]$/.test(tag)) return `\n${entourer(interieur.trim(), '*')}\n`;
    if (BLOC.has(tag)) return `\n${interieur}\n`;
    return interieur;
}

/**
 * @param {string} html HTML de l'éditeur (déjà assaini).
 * @returns {string} texte prêt à coller dans WhatsApp.
 */
export function htmlToWhatsApp(html) {
    if (!html) return '';
    const doc = new DOMParser().parseFromString(`<body>${html}</body>`, 'text/html');
    return enfants(doc.body)
        .split('\n').map((ligne) => ligne.trim()).join('\n')
        .replace(/\n{3,}/g, '\n\n')
        .trim();
}
