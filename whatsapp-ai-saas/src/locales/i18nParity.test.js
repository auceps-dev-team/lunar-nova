// P2-1 : verrou de non-régression de la parité i18n. Les quatre locales
// (fr/en/es/ar) doivent exposer exactement le même jeu de clés — un utilisateur
// es/ar ne doit plus jamais retomber sur une clé brute ou sur l'anglais — et
// chaque traduction doit conserver les mêmes variables d'interpolation que la
// référence française.
import { describe, it, expect } from 'vitest';
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
        expect(reference.length).toBeGreaterThan(1000);
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

    it('aucune valeur vide ou non-chaîne dans les locales', () => {
        for (const [lang, dict] of Object.entries(locales)) {
            for (const [key, value] of Object.entries(dict)) {
                expect(typeof value, `${lang}.${key}`).toBe('string');
                expect(value.length, `${lang}.${key}`).toBeGreaterThan(0);
            }
        }
    });
});
