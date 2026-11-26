// P2-1 : verrou de non-régression de la parité i18n. Les quatre locales
// (fr/en/es/ar) doivent exposer exactement le même jeu de clés — un utilisateur
// es/ar ne doit plus jamais retomber sur une clé brute ou sur l'anglais — et
// chaque traduction doit conserver les mêmes variables d'interpolation que la
// référence française.
import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import fr from './fr.json';
import en from './en.json';
import es from './es.json';
import ar from './ar.json';

const locales = { fr, en, es, ar };

// Placeholders au format i18next ({{name}}) et formats simples ({name}).
const placeholders = (value) => (String(value).match(/\{\{?\w+\}\}?/g) || []).sort().join(',');

describe('i18n — parité des quatre locales (P2-1)', () => {
    it('fr, en, es et ar exposent exactement le même jeu de clés', () => {
        const reference = Object.keys(locales.fr).sort();
        // Garde-fou contre une locale vide ou chargée à moitié. Le retrait de la
        // génération d'image (26/11/2026) a fait passer de 1 062 à 893 clés,
        // puis 925 le même jour (outils de rédaction, clés absentes ajoutées).
        expect(reference.length).toBeGreaterThan(850);
        for (const lang of ['en', 'es', 'ar']) {
            expect(Object.keys(locales[lang]).sort()).toEqual(reference);
        }
    });

    it.each(['en', 'es', 'ar'])('%s conserve les variables d\'interpolation de la référence fr', (lang) => {
        const mismatches = [];
        for (const [key, value] of Object.entries(locales.fr)) {
            const expected = placeholders(value);
            const actual = placeholders(locales[lang][key]);
            if (expected !== actual) mismatches.push(`${key}: fr=[${expected}] ${lang}=[${actual}]`);
        }
        expect(mismatches).toEqual([]);
    });

    // La parité ne voit pas une clé absente des QUATRE langues : l'écran
    // affiche alors son nom brut. Mesuré le 26/11/2026 : 17 clés dans ce cas,
    // dont trois écrites `t('x') || 'repli'` — repli jamais pris, i18next
    // rendant le nom de la clé. Portée : clés écrites en littéral seulement,
    // pas celles construites à l'exécution.
    it('chaque clé citée en littéral dans src existe dans la référence fr', () => {
        const src = path.resolve(__dirname, '..');
        const absentes = [];
        const parcourir = (dossier) => {
            for (const e of fs.readdirSync(dossier, { withFileTypes: true })) {
                const p = path.join(dossier, e.name);
                if (e.isDirectory()) {
                    if (e.name !== 'locales' && e.name !== '__tests__') parcourir(p);
                } else if (/\.(jsx?|tsx?)$/.test(e.name) && !/\.test\./.test(e.name)) {
                    const code = fs.readFileSync(p, 'utf8');
                    for (const m of code.matchAll(/\bt\(\s*'([A-Za-z0-9_.]+)'|labelKey:\s*'([A-Za-z0-9_.]+)'/g)) {
                        const cle = m[1] || m[2];
                        if (!(cle in locales.fr)) absentes.push(`${cle} ← ${path.relative(src, p)}`);
                    }
                }
            }
        };
        parcourir(src);
        expect(absentes).toEqual([]);
    });

    it('aucune valeur vide ou non-chaîne dans les locales', () => {
        for (const [lang, dict] of Object.entries(locales)) {
            for (const [key, value] of Object.entries(dict)) {
                expect(typeof value, `${lang}.${key}`).toBe('string');
                expect(value.length, `${lang}.${key}`).toBeGreaterThan(0);
            }
        }
    });
});
