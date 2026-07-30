// @vitest-environment node
import { describe, it, expect } from 'vitest';
import { redactMessage, redactContact } from '../logRedact.js';

// WACOPILOTE_LOG_MESSAGES n'est pas défini dans l'environnement de test :
// on valide donc le comportement par défaut, celui qui protège l'utilisateur.

describe('redactMessage', () => {
    it('ne laisse pas le contenu du message apparaître', () => {
        const secret = 'Bonjour, je veux 3 pagnes livrés à Cocody, mon numéro est 0707070707';
        const out = redactMessage(secret);
        expect(out).not.toContain('pagnes');
        expect(out).not.toContain('Cocody');
        expect(out).not.toContain('0707070707');
    });

    it('conserve la longueur, utile au diagnostic d\'une extraction tronquée', () => {
        expect(redactMessage('abcde')).toContain('5');
    });

    it('distingue un message vide d\'un message masqué', () => {
        expect(redactMessage('')).toBe('(vide)');
        expect(redactMessage(null)).toBe('(vide)');
        expect(redactMessage(undefined)).toBe('(vide)');
    });
});

describe('redactContact', () => {
    it('ne conserve que l\'initiale', () => {
        expect(redactContact('Awa Traoré')).toBe('A*****');
    });

    it('ne laisse pas deviner la longueur exacte d\'un nom long', () => {
        const court = redactContact('Ali Ben');
        const long = redactContact('Abdoulaye Ouattara Kouassi');
        expect(court).toBe(long);
    });

    it('gère les noms très courts sans les laisser en clair', () => {
        expect(redactContact('A')).toBe('*');
        expect(redactContact('Ab')).toBe('A*');
    });

    it('gère un contact inconnu', () => {
        expect(redactContact('')).toBe('(inconnu)');
        expect(redactContact(null)).toBe('(inconnu)');
        expect(redactContact(undefined)).toBe('(inconnu)');
    });

    // Les noms WhatsApp sont souvent des numéros quand le contact n'est pas enregistré.
    it('masque un numéro utilisé comme nom de contact', () => {
        const out = redactContact('+225 07 07 07 07 07');
        expect(out).not.toContain('07');
        expect(out.startsWith('+')).toBe(true);
    });
});
