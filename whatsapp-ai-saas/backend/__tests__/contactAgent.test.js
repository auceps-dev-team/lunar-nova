// @vitest-environment node
import { describe, it, expect } from 'vitest';

// Aucun vi.mock ici : db.js charge le binding natif sqlite3 de façon paresseuse
// (voir backend/db.js) et contactAgent accepte un pool injecté — le test passe
// donc un faux pool, sans réseau ni binding natif.
import { validateAndDedupeLeads, normalizePhone, isValidPhoneFormat } from '../services/contactAgent.js';

/** Faux pool SQL : enregistre la requête et retourne les lignes fournies. */
function fakePool(rows = []) {
    const calls = [];
    return {
        calls,
        query: async (text, params) => {
            calls.push({ text, params });
            return { rows };
        },
    };
}

describe('normalizePhone', () => {
    it('normalise en conservant le préfixe +', () => {
        expect(normalizePhone('+225 07 07 07 07 07')).toBe('+2250707070707');
    });

    it('retire tous les séparateurs', () => {
        expect(normalizePhone('07-07.07 07 07')).toBe('0707070707');
    });

    it('renvoie une chaîne vide sur entrée vide', () => {
        expect(normalizePhone('')).toBe('');
        expect(normalizePhone(null)).toBe('');
    });
});

describe('isValidPhoneFormat', () => {
    it('accepte un numéro national à 10 chiffres', () => {
        expect(isValidPhoneFormat('0707070707')).toBe(true);
    });

    it('accepte un numéro international avec +', () => {
        expect(isValidPhoneFormat('+2250707070707')).toBe(true);
    });

    it('rejette les numéros trop courts ou trop longs', () => {
        expect(isValidPhoneFormat('1234567')).toBe(false);
        expect(isValidPhoneFormat('1234567890123456')).toBe(false);
    });

    it('rejette une entrée non numérique', () => {
        expect(isValidPhoneFormat('appeler le bureau')).toBe(false);
    });
});

describe('validateAndDedupeLeads', () => {
    it('classe un lead valide dans valid', async () => {
        const pool = fakePool(); // aucun contact existant
        const result = await validateAndDedupeLeads([{ name: 'Boulangerie X', phone: '+225 07 07 07 07 07' }], pool);
        expect(result.valid).toHaveLength(1);
        expect(result.valid[0].phone).toBe('+2250707070707');
        expect(result.invalid).toHaveLength(0);
        expect(result.duplicates).toHaveLength(0);
    });

    it('classe un numéro mal formé dans invalid', async () => {
        const result = await validateAndDedupeLeads([{ name: 'Sans numéro', phone: 'abc' }], fakePool());
        expect(result.invalid).toHaveLength(1);
        expect(result.valid).toHaveLength(0);
    });

    it('déduplique dans un même lot', async () => {
        const lead = { name: 'Dupliqué', phone: '0707070707' };
        const result = await validateAndDedupeLeads([lead, { ...lead, name: 'Copie' }], fakePool());
        expect(result.valid).toHaveLength(1);
        expect(result.duplicates).toHaveLength(1);
    });

    it('déduplique contre les contacts existants en base (mêmes formats)', async () => {
        const pool = fakePool([{ phone: '+2250707070707' }]);
        const result = await validateAndDedupeLeads([{ name: 'Déjà en base', phone: '+225 07 07 07 07 07' }], pool);
        expect(result.duplicates).toHaveLength(1);
        expect(result.valid).toHaveLength(0);
    });

    it('limite connue : un numéro national et son équivalent avec indicatif ne sont pas rapprochés', async () => {
        // Comportement défensif assumé : sans pays de référence fiable par lead,
        // on ne fusionne pas deux numéros dont l'égalité n'est pas prouvée —
        // fusionner à tort coûterait des contacts. Documenté dans contactAgent.js.
        const pool = fakePool([{ phone: '+2250707070707' }]);
        const result = await validateAndDedupeLeads([{ name: 'Écrit sans indicatif', phone: '0707070707' }], pool);
        expect(result.duplicates).toHaveLength(0);
        expect(result.valid).toHaveLength(1);
    });

    it('interroge bien wa_contacts pour les numéros existants', async () => {
        const pool = fakePool();
        await validateAndDedupeLeads([{ phone: '0707070707' }], pool);
        expect(pool.calls[0].text).toContain('SELECT phone FROM wa_contacts');
    });
});
