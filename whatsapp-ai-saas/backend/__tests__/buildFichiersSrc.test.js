// @vitest-environment node
//
// Application construite (28/11/2026) : seuls les fichiers listés dans
// package.json > build.files entrent dans app.asar. Le backend lisait le gabarit
// des devis (src/components/invoice/buildInvoiceHTML.js) et la traduction
// française dans src/, qui n'y étaient pas. Mesuré sur le build 1.52.3 : POST
// /api/invoices/:id/export-pdf → 500 « Cannot find module …app.asar\src\…
// buildInvoiceHTML.js ». Ce test échoue si le code du backend (hors tests)
// référence un fichier de src/ que le build n'embarque pas, ou si l'un de ces
// fichiers importe à son tour un fichier non embarqué.
import { describe, it, expect } from 'vitest';

const fs = require('fs');
const path = require('path');

const RACINE = path.resolve(__dirname, '..', '..');
const BACKEND = path.join(RACINE, 'backend');
const fichiersBuild = require(path.join(RACINE, 'package.json')).build.files;

function fichiersJs(dossier) {
    return fs.readdirSync(dossier, { withFileTypes: true }).flatMap((e) => {
        const p = path.join(dossier, e.name);
        if (e.isDirectory()) return ['node_modules', '__tests__'].includes(e.name) ? [] : fichiersJs(p);
        return /\.(c?js|mjs)$/.test(e.name) ? [p] : [];
    });
}

// Chemins de src/ référencés depuis le backend, résolus depuis le fichier.
function referencesSrc() {
    const refs = new Set();
    for (const f of fichiersJs(BACKEND)) {
        const texte = fs.readFileSync(f, 'utf8');
        for (const m of texte.matchAll(/['"`]((?:\.\.\/)+src\/[^'"`]+)['"`]/g)) {
            refs.add(path.relative(RACINE, path.resolve(path.dirname(f), m[1])).split(path.sep).join('/'));
        }
    }
    return [...refs];
}

// Imports relatifs d'un module de src/ (ESM), pour suivre la chaîne.
function importsRelatifs(fichier) {
    const texte = fs.readFileSync(path.join(RACINE, fichier), 'utf8');
    return [...texte.matchAll(/^\s*import[^'"]*['"](\.{1,2}\/[^'"]+)['"]/gm)]
        .map((m) => path.relative(RACINE, path.resolve(path.dirname(path.join(RACINE, fichier)), m[1])).split(path.sep).join('/'));
}

const embarque = (f) => fichiersBuild.includes(f)
    || fichiersBuild.some((motif) => motif.endsWith('/**/*') && f.startsWith(motif.slice(0, -'**/*'.length)));

describe('build.files embarque ce que le backend lit dans src/', () => {
    it('trouve bien les références (garde contre une recherche qui ne voit rien)', () => {
        expect(referencesSrc()).toEqual(expect.arrayContaining([
            'src/components/invoice/buildInvoiceHTML.js',
            'src/locales/fr.json',
        ]));
    });

    it('chaque fichier de src/ lu par le backend, et ce qu\'il importe, est dans build.files', () => {
        const aVerifier = referencesSrc();
        const vus = new Set();
        const manquants = [];
        while (aVerifier.length) {
            const f = aVerifier.pop();
            if (vus.has(f)) continue;
            vus.add(f);
            expect(fs.existsSync(path.join(RACINE, f)), `${f} existe`).toBe(true);
            if (!embarque(f)) manquants.push(f);
            if (/\.(c?js|mjs)$/.test(f)) aVerifier.push(...importsRelatifs(f));
        }
        expect(manquants).toEqual([]);
        expect(vus.has('src/components/invoice/helpers.js')).toBe(true);
    });
});
