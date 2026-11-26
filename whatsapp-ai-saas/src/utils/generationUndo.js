/**
 * Annulation du remplacement de tout le contenu de l'éditeur par une génération.
 *
 * Avant le 26/11/2026, la génération affectait innerHTML : le texte de
 * l'utilisateur était perdu, sans retour possible.
 *
 * Pourquoi pas la pile d'annulation native — mesuré le 26/11/2026 dans le
 * Chromium d'Electron 41 (application construite), contenu entièrement
 * sélectionné puis remplacé :
 *   - insertHTML seul : un document qui commence par un titre donne
 *     <h2><p>…</p></h2> — le nouveau contenu est emboîté dans le titre ;
 *   - delete puis insertHTML, ou contenu enveloppé dans un <div> : même défaut ;
 *   - formatBlock p puis insertHTML : correct après un titre, mais une liste en
 *     tête donne <ul><li><ul>…, et il faut deux Ctrl+Z.
 * Le remplacement passe donc par innerHTML (résultat exact), et l'état
 * précédent est gardé ici : Annuler / Ctrl+Z le rend en une fois, tant que le
 * contenu est encore celui de la génération. Au-delà, la pile native reprend.
 */
export function createGenerationUndo() {
    let annulable = null; // { avant, apres }
    let retablissable = null;

    return {
        /** Remplace le contenu et retient l'état d'avant. */
        replace(editeur, html) {
            const avant = editeur.innerHTML;
            editeur.innerHTML = html;
            // Valeur relue : le navigateur normalise le HTML affecté.
            annulable = { avant, apres: editeur.innerHTML };
            retablissable = null;
        },
        /** Rend l'état d'avant la génération. Faux si rien à annuler ici. */
        undo(editeur) {
            if (!annulable || editeur.innerHTML !== annulable.apres) return false;
            editeur.innerHTML = annulable.avant;
            retablissable = annulable;
            annulable = null;
            return true;
        },
        /** Refait la génération annulée. Faux si rien à rétablir ici. */
        redo(editeur) {
            if (!retablissable || editeur.innerHTML !== retablissable.avant) return false;
            editeur.innerHTML = retablissable.apres;
            annulable = retablissable;
            retablissable = null;
            return true;
        },
        /** Nouveau document chargé : plus rien à annuler. */
        reset() {
            annulable = null;
            retablissable = null;
        },
    };
}

/** Ctrl+Z (Cmd+Z) sans Maj. */
export const isUndoShortcut = (e) => (e.ctrlKey || e.metaKey) && !e.shiftKey && !e.altKey && e.key.toLowerCase() === 'z';
/** Ctrl+Y, ou Ctrl+Maj+Z. */
export const isRedoShortcut = (e) => (e.ctrlKey || e.metaKey) && !e.altKey
    && (e.key.toLowerCase() === 'y' || (e.shiftKey && e.key.toLowerCase() === 'z'));
