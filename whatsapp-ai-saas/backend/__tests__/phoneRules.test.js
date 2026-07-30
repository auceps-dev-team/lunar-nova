// @vitest-environment node
import { describe, it, expect } from 'vitest';
import {
    normalizeDigits,
    toNationalNumber,
    isLandline,
    detectCountry,
    LANDLINE_PREFIXES,
    COUNTRY_PHONE_CODES,
} from '../scrapers/phoneRules.js';

describe('normalizeDigits', () => {
    it('retire tout ce qui n\'est pas un chiffre', () => {
        expect(normalizeDigits('+225 07 07 07 07 07')).toBe('2250707070707');
        expect(normalizeDigits('(+228) 90-12-34-56')).toBe('228901234 56'.replace(/\D/g, ''));
    });

    it('supporte une entrée vide ou absente', () => {
        expect(normalizeDigits('')).toBe('');
        expect(normalizeDigits(null)).toBe('');
        expect(normalizeDigits(undefined)).toBe('');
    });
});

describe('toNationalNumber', () => {
    it('retire l\'indicatif pays', () => {
        expect(toNationalNumber('+225 27 21 00 00 00', 'ci')).toBe('2721000000');
        expect(toNationalNumber('+228 90 12 34 56', 'tg')).toBe('90123456');
    });

    it('laisse intact un numéro déjà national', () => {
        expect(toNationalNumber('0707070707', 'ci')).toBe('0707070707');
    });

    // Sans garde de longueur, un numéro national commençant par les chiffres de
    // son propre indicatif serait amputé.
    it('ne retire pas l\'indicatif si le reste devient trop court', () => {
        expect(toNationalNumber('225123', 'ci')).toBe('225123');
    });

    it('ignore un pays inconnu', () => {
        expect(toNationalNumber('+999 12345678', 'xx')).toBe('99912345678');
    });
});

describe('isLandline — Côte d\'Ivoire', () => {
    it('reconnaît les fixes en format national', () => {
        expect(isLandline('27 21 00 00 00', 'ci')).toBe(true);
        expect(isLandline('2521000000', 'ci')).toBe(true);
        expect(isLandline('2121000000', 'ci')).toBe(true);
    });

    it('reconnaît les fixes en format international', () => {
        expect(isLandline('+225 27 21 00 00 00', 'ci')).toBe(true);
    });

    it('laisse passer les mobiles', () => {
        expect(isLandline('0707070707', 'ci')).toBe(false);
        expect(isLandline('0102030405', 'ci')).toBe(false);
        expect(isLandline('+225 05 05 05 05 05', 'ci')).toBe(false);
    });
});

// Régression : c'est le défaut que l'extraction a mis au jour. L'indicatif du
// Togo (228) commence par son propre préfixe fixe (22), celui du Cameroun (237)
// par le sien (23). L'ancienne comparaison, faite avant retrait de l'indicatif,
// classait donc « fixe » TOUS les numéros de ces pays en format international.
describe('isLandline — collision entre indicatif et préfixe fixe', () => {
    it('ne classe pas un mobile togolais comme fixe (indicatif 228, préfixe 22)', () => {
        expect(isLandline('+228 90 12 34 56', 'tg')).toBe(false);
        expect(isLandline('22890123456', 'tg')).toBe(false);
    });

    it('ne classe pas un mobile camerounais comme fixe (indicatif 237, préfixe 23)', () => {
        expect(isLandline('+237 6 12 34 56 78', 'cm')).toBe(false);
        expect(isLandline('237612345678', 'cm')).toBe(false);
    });

    it('continue de reconnaître les vrais fixes de ces pays', () => {
        expect(isLandline('+228 22 12 34 56', 'tg')).toBe(true);
        expect(isLandline('+237 22 12 34 56', 'cm')).toBe(true);
        expect(isLandline('22123456', 'tg')).toBe(true);
    });
});

describe('isLandline — divers pays', () => {
    it('Sénégal : 33 est fixe', () => {
        expect(isLandline('+221 33 123 45 67', 'sn')).toBe(true);
        expect(isLandline('+221 77 123 45 67', 'sn')).toBe(false);
    });

    it('France : 06 et 07 sont mobiles', () => {
        expect(isLandline('+33 6 12 34 56 78', 'fr')).toBe(false);
        expect(isLandline('+33 1 42 00 00 00', 'fr')).toBe(false); // 142… national, pas 01…
        expect(isLandline('01 42 00 00 00', 'fr')).toBe(true);
    });

    it('renvoie faux pour un pays sans table de préfixes', () => {
        expect(isLandline('12345678', 'zz')).toBe(false);
        expect(isLandline('12345678', undefined)).toBe(false);
    });

    it('supporte un numéro vide', () => {
        expect(isLandline('', 'ci')).toBe(false);
        expect(isLandline(null, 'ci')).toBe(false);
    });
});

describe('detectCountry', () => {
    it('reconnaît un indicatif connu', () => {
        expect(detectCountry('+225 07 07 07 07 07')).toBe('ci');
        expect(detectCountry('+228 90 12 34 56')).toBe('tg');
    });

    it('renvoie null quand aucun indicatif ne correspond', () => {
        expect(detectCountry('0707070707')).toBeNull();
        expect(detectCountry('')).toBeNull();
    });
});

describe('cohérence des tables', () => {
    it('chaque pays listé en préfixes fixes possède un indicatif', () => {
        for (const country of Object.keys(LANDLINE_PREFIXES)) {
            expect(COUNTRY_PHONE_CODES[country], `indicatif manquant pour ${country}`).toBeDefined();
        }
    });

    it('aucun préfixe fixe n\'est vide', () => {
        for (const [country, prefixes] of Object.entries(LANDLINE_PREFIXES)) {
            expect(prefixes.length, `table vide pour ${country}`).toBeGreaterThan(0);
            prefixes.forEach(p => expect(p).toMatch(/^\d+$/));
        }
    });
});
