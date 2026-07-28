import { describe, it, expect } from 'vitest';
import { normalizePhone, isValidPhoneFormat } from '../utils/phoneFormat';

describe('normalizePhone', () => {
    it('retire les séparateurs courants', () => {
        expect(normalizePhone('07 07 07 07 07')).toBe('0707070707');
        expect(normalizePhone('07-07-07-07-07')).toBe('0707070707');
        expect(normalizePhone('07.07.07.07.07')).toBe('0707070707');
    });

    it('préserve le préfixe international', () => {
        expect(normalizePhone('+225 07 07 07 07 07')).toBe('+2250707070707');
    });

    it('retire les parenthèses et espaces internes', () => {
        expect(normalizePhone('+33 (0)6 12 34 56 78')).toBe('+330612345678');
    });

    it('ignore les espaces de bord avant de détecter le +', () => {
        expect(normalizePhone('  +2250707070707  ')).toBe('+2250707070707');
    });

    it('renvoie une chaîne vide sur une entrée vide ou non numérique', () => {
        expect(normalizePhone('')).toBe('');
        expect(normalizePhone(null)).toBe('');
        expect(normalizePhone(undefined)).toBe('');
        expect(normalizePhone('non renseigné')).toBe('');
    });

    // Les imports CSV fournissent souvent des nombres, pas des chaînes.
    it('accepte une entrée numérique', () => {
        expect(normalizePhone(709124567)).toBe('709124567');
    });
});

describe('isValidPhoneFormat', () => {
    it('accepte un numéro ivoirien à 10 chiffres', () => {
        expect(isValidPhoneFormat('0707070707')).toBe(true);
    });

    it('accepte un numéro international complet', () => {
        expect(isValidPhoneFormat('+2250707070707')).toBe(true);
    });

    it('rejette les numéros trop courts', () => {
        expect(isValidPhoneFormat('1234567')).toBe(false);
    });

    it('rejette les numéros trop longs', () => {
        expect(isValidPhoneFormat('1234567890123456')).toBe(false);
    });

    it('accepte les bornes exactes (8 et 15 chiffres)', () => {
        expect(isValidPhoneFormat('12345678')).toBe(true);
        expect(isValidPhoneFormat('123456789012345')).toBe(true);
    });

    it('ne compte pas le + dans la longueur', () => {
        // 15 chiffres plus le préfixe : valide, le + n'est pas un chiffre.
        expect(isValidPhoneFormat('+123456789012345')).toBe(true);
    });

    it('rejette une entrée vide ou non numérique', () => {
        expect(isValidPhoneFormat('')).toBe(false);
        expect(isValidPhoneFormat(null)).toBe(false);
        expect(isValidPhoneFormat('appeler le bureau')).toBe(false);
    });
});
