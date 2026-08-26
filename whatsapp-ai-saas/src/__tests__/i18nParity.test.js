// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';
import fr from '../locales/fr.json';
import en from '../locales/en.json';
import es from '../locales/es.json';
import ar from '../locales/ar.json';

const frKeys = Object.keys(fr).sort();
const enKeys = Object.keys(en).sort();
const esKeys = Object.keys(es).sort();
const arKeys = Object.keys(ar).sort();

describe('i18n parity (P2-1)', () => {
    it('fr et en partagent exactement le même jeu de clés (canon de référence)', () => {
        expect(frKeys).toEqual(enKeys);
    });

    it('es.json est en parité stricte avec fr.json (aucune clé manquante, aucune orpheline)', () => {
        expect(esKeys).toEqual(frKeys);
    });

    it('ar.json est en parité stricte avec fr.json (aucune clé manquante, aucune orpheline)', () => {
        expect(arKeys).toEqual(frKeys);
    });

    it('aucune traduction es/ar vide', () => {
        for (const [locale, data] of [['es', es], ['ar', ar]]) {
            for (const k of frKeys) {
                expect(typeof data[k], `clé ${locale} manquante ou non-string: ${k}`).toBe('string');
                expect(data[k].trim().length, `clé ${locale} vide: ${k}`).toBeGreaterThan(0);
            }
        }
    });
});
