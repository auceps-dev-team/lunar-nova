// Outils de rédaction (26/11/2026) : copie au format WhatsApp, modes de
// réécriture, et capture de la sélection — le texte réécrit doit remplacer
// le passage choisi au clic, même si l'utilisateur a cliqué ailleurs pendant
// les 30 à 60 s de réponse d'un CLI local.
import { describe, it, expect } from 'vitest';
import { htmlToWhatsApp } from '../utils/whatsappFormat';
import { REWRITE_MODES, buildRewritePrompt, cleanRewriteResponse, captureSelectionIn, restoreSelection } from '../utils/rewriteModes';
import { WRITING_LANGUAGES, defaultWritingLanguage } from '../utils/writingLanguages';
import { createGenerationUndo, isUndoShortcut, isRedoShortcut } from '../utils/generationUndo';

describe('annulation d\'une génération', () => {
    const editeur = () => {
        document.body.innerHTML = '<div id="ed"><ul><li>Pagne</li></ul><h2>Titre</h2><p>Texte de <b>l\'utilisateur</b></p></div>';
        return document.getElementById('ed');
    };

    it('remplace exactement — même quand le document commence par une liste ou un titre', () => {
        const ed = editeur();
        createGenerationUndo().replace(ed, '<p>Deuxième version.</p><ul><li>Bazin</li></ul>');
        expect(ed.innerHTML).toBe('<p>Deuxième version.</p><ul><li>Bazin</li></ul>');
    });

    it('Annuler rend le texte d\'avant en une fois, Rétablir refait la génération', () => {
        const ed = editeur();
        const avant = ed.innerHTML;
        const u = createGenerationUndo();
        u.replace(ed, '<p>Généré</p>');
        expect(u.undo(ed)).toBe(true);
        expect(ed.innerHTML).toBe(avant);
        expect(u.undo(ed)).toBe(false);
        expect(u.redo(ed)).toBe(true);
        expect(ed.innerHTML).toBe('<p>Généré</p>');
        expect(u.undo(ed)).toBe(true);
        expect(ed.innerHTML).toBe(avant);
    });

    it('après une frappe sur le texte généré, Annuler revient à la pile native (rien d\'intercepté)', () => {
        const ed = editeur();
        const u = createGenerationUndo();
        u.replace(ed, '<p>Généré</p>');
        ed.querySelector('p').append(' et retouché');
        expect(u.undo(ed)).toBe(false);
        expect(ed.innerHTML).toBe('<p>Généré et retouché</p>');
    });

    it('un document chargé efface ce qui était annulable', () => {
        const ed = editeur();
        const u = createGenerationUndo();
        u.replace(ed, '<p>Généré</p>');
        u.reset();
        expect(u.undo(ed)).toBe(false);
    });

    it('raccourcis : Ctrl+Z annule ; Ctrl+Y et Ctrl+Maj+Z rétablissent', () => {
        const touche = (key, extra = {}) => ({ key, ctrlKey: true, metaKey: false, shiftKey: false, altKey: false, ...extra });
        expect(isUndoShortcut(touche('z'))).toBe(true);
        expect(isUndoShortcut(touche('Z', { shiftKey: true }))).toBe(false);
        expect(isRedoShortcut(touche('Z', { shiftKey: true }))).toBe(true);
        expect(isRedoShortcut(touche('y'))).toBe(true);
        expect(isUndoShortcut({ ...touche('z'), ctrlKey: false })).toBe(false);
        expect(isUndoShortcut(touche('z', { ctrlKey: false, metaKey: true }))).toBe(true);
    });
});

describe('cleanRewriteResponse', () => {
    it('retire clôtures, guillemets repris de la consigne et enveloppe JSON', () => {
        expect(cleanRewriteResponse('```\nBonjour Awa\n```')).toBe('Bonjour Awa');
        expect(cleanRewriteResponse('"""\nBonjour Awa\n"""')).toBe('Bonjour Awa');
        expect(cleanRewriteResponse('« Bonjour Awa »')).toBe('Bonjour Awa');
        expect(cleanRewriteResponse('{"text": "Bonjour Awa"}')).toBe('Bonjour Awa');
    });

    it('garde les guillemets internes, et le JSON qui n\'est pas une enveloppe', () => {
        expect(cleanRewriteResponse('Le modèle "Kente" est arrivé')).toBe('Le modèle "Kente" est arrivé');
        expect(cleanRewriteResponse('{ pas du JSON')).toBe('{ pas du JSON');
    });

    it('rend une chaîne vide pour une réponse absente ou vide — jamais un succès à vide', () => {
        expect(cleanRewriteResponse(undefined)).toBe('');
        expect(cleanRewriteResponse({ text: 'x' })).toBe('');
        expect(cleanRewriteResponse('  ""  ')).toBe('');
        expect(cleanRewriteResponse('   ')).toBe('');
    });
});

describe('langue de rédaction par défaut', () => {
    it('suit la langue de l\'interface, variantes régionales comprises', () => {
        expect(defaultWritingLanguage('fr')).toBe('Français (France)');
        expect(defaultWritingLanguage('en-US')).toBe('English (USA)');
        expect(defaultWritingLanguage('es')).toBe('Español');
        expect(defaultWritingLanguage('ar')).toMatch(/العربية/);
    });

    it('retombe sur le français, langue par défaut de l\'application', () => {
        expect(defaultWritingLanguage(undefined)).toBe('Français (France)');
        expect(defaultWritingLanguage('de')).toBe('Français (France)');
    });

    it('propose une langue de rédaction par langue d\'interface livrée', async () => {
        const fs = await import('node:fs');
        const path = await import('node:path');
        const livrees = fs.readdirSync(path.resolve(__dirname, '../locales'))
            .filter((f) => /^[a-z]{2}\.json$/.test(f)).map((f) => f.slice(0, 2)).sort();
        expect(WRITING_LANGUAGES.map((l) => l.locale).sort()).toEqual(livrees);
    });
});

describe('htmlToWhatsApp', () => {
    it('traduit gras, italique, barré et monospace', () => {
        expect(htmlToWhatsApp('<p><b>Promo</b> sur les <i>pagnes</i>, <s>10 000</s> <code>8000</code></p>'))
            .toBe('*Promo* sur les _pagnes_, ~10 000~ ```8000```');
    });

    it('laisse les espaces hors des marqueurs (« *gras* », jamais « * gras * »)', () => {
        expect(htmlToWhatsApp('<p>Livraison<strong> gratuite </strong>demain</p>')).toBe('Livraison *gratuite* demain');
    });

    it('rend les listes à puces et numérotées', () => {
        expect(htmlToWhatsApp('<ul><li>Pagne wax</li><li>Bazin</li></ul><ol><li>Choisir</li><li>Payer</li></ol>'))
            .toBe('• Pagne wax\n• Bazin\n\n1. Choisir\n2. Payer');
    });

    it('met les titres en gras sur leur propre ligne, et sépare les paragraphes', () => {
        expect(htmlToWhatsApp('<h2>Nouveautés</h2><p>Arrivage lundi.</p><p>Venez tôt !</p>'))
            .toBe('*Nouveautés*\n\nArrivage lundi.\n\nVenez tôt !');
    });

    it('garde les retours à la ligne, décode les entités, ignore le souligné', () => {
        expect(htmlToWhatsApp('<p>Prix&nbsp;: <u>5 000 F</u><br>À bientôt &amp; merci</p>'))
            .toBe('Prix : 5 000 F\nÀ bientôt & merci');
    });

    it('rend une chaîne vide pour un éditeur vide', () => {
        expect(htmlToWhatsApp('')).toBe('');
        expect(htmlToWhatsApp('<p><br></p>')).toBe('');
    });
});

describe('modes de réécriture', () => {
    it('chaque mode a un identifiant, une clé de libellé et une consigne', () => {
        for (const m of REWRITE_MODES) {
            expect(m.id).toMatch(/^[a-z]+$/);
            expect(m.labelKey).toMatch(/^rewrite[A-Z]/);
            expect(m.instruction.length).toBeGreaterThan(20);
        }
        expect(new Set(REWRITE_MODES.map((m) => m.id)).size).toBe(REWRITE_MODES.length);
    });

    it('la consigne contient le texte et impose de garder sa langue', () => {
        const p = buildRewritePrompt('fix', 'je veut deux pagne');
        expect(p).toContain('Corrige uniquement');
        expect(p).toContain('je veut deux pagne');
        expect(p).toMatch(/garde la langue du texte d'origine/);
    });

    it('un mode inconnu retombe sur « améliorer »', () => {
        expect(buildRewritePrompt('inconnu', 'x')).toContain(REWRITE_MODES[0].instruction);
    });
});

describe('capture et restauration de la sélection', () => {
    const preparer = () => {
        document.body.innerHTML = '<div id="editeur"><p>Bonjour cher client</p></div><input id="titre" value="Titre">';
        const editeur = document.getElementById('editeur');
        const texte = editeur.querySelector('p').firstChild;
        const range = document.createRange();
        range.setStart(texte, 8);
        range.setEnd(texte, 12);
        const sel = window.getSelection();
        sel.removeAllRanges();
        sel.addRange(range);
        return { editeur, sel, texte };
    };

    it('capture le passage choisi dans l\'éditeur', () => {
        const { editeur } = preparer();
        expect(captureSelectionIn(editeur).toString()).toBe('cher');
    });

    it('la plage capturée survit à une autre sélection, et se restaure', () => {
        const { editeur, sel, texte } = preparer();
        const capturee = captureSelectionIn(editeur);

        // L'utilisateur sélectionne autre chose pendant l'attente de la réponse.
        const ailleurs = document.createRange();
        ailleurs.setStart(texte, 0);
        ailleurs.setEnd(texte, 7);
        sel.removeAllRanges();
        sel.addRange(ailleurs);
        expect(sel.toString()).toBe('Bonjour');

        expect(restoreSelection(editeur, capturee, 'cher')).toBe(true);
        expect(sel.toString()).toBe('cher');
    });

    it('ne restaure pas un passage modifié par l\'utilisateur pendant l\'attente', () => {
        const { editeur, texte } = preparer();
        const capturee = captureSelectionIn(editeur);
        texte.replaceData(8, 4, 'chère');
        expect(restoreSelection(editeur, capturee, 'cher')).toBe(false);
    });

    it('refuse une sélection vide ou hors de l\'éditeur', () => {
        const { editeur, sel } = preparer();
        sel.collapseToStart();
        expect(captureSelectionIn(editeur)).toBeNull();

        const hors = document.createRange();
        hors.selectNodeContents(document.body);
        sel.removeAllRanges();
        sel.addRange(hors);
        expect(captureSelectionIn(editeur)).toBeNull();
    });

    it('ne restaure pas une plage dont le contenu a été remplacé', () => {
        const { editeur } = preparer();
        const capturee = captureSelectionIn(editeur);
        editeur.innerHTML = '<p>Nouveau document</p>';
        expect(restoreSelection(editeur, capturee)).toBe(false);
    });
});
