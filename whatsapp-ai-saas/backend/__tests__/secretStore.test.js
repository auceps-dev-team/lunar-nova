// @vitest-environment node
import { describe, it, expect, beforeAll } from 'vitest';

// La clé maître est fixée avant l'import : secretStore la résout au chargement du
// module et, sans elle, écrirait un fichier de clé dans l'arborescence du projet.
process.env.WACOPILOTE_MASTER_KEY = 'a'.repeat(64);

let encrypt, decrypt, isEncrypted, PREFIX;

beforeAll(async () => {
    ({ encrypt, decrypt, isEncrypted, PREFIX } = await import('../secretStore.js'));
});

describe('secretStore', () => {
    it('restitue la valeur chiffrée', () => {
        const secret = 'sk-or-v1-0123456789abcdef';
        expect(decrypt(encrypt(secret))).toBe(secret);
    });

    it('ne laisse pas le clair apparaître dans le chiffré', () => {
        const secret = 'AIzaSyTopSecretValue';
        expect(encrypt(secret)).not.toContain(secret);
    });

    it('préfixe la valeur pour permettre la détection', () => {
        const out = encrypt('valeur');
        expect(out.startsWith(PREFIX)).toBe(true);
        expect(isEncrypted(out)).toBe(true);
        expect(isEncrypted('valeur')).toBe(false);
    });

    // Deux chiffrements du même secret doivent différer, sinon un observateur
    // peut savoir que deux comptes partagent la même clé d'API.
    it('produit un chiffré différent à chaque appel (IV aléatoire)', () => {
        const secret = 'meme-valeur';
        expect(encrypt(secret)).not.toBe(encrypt(secret));
    });

    it('est idempotent : ne rechiffre pas une valeur déjà chiffrée', () => {
        const once = encrypt('valeur');
        expect(encrypt(once)).toBe(once);
    });

    it('traite les valeurs vides comme une absence de secret', () => {
        expect(encrypt('')).toBe('');
        expect(encrypt(null)).toBe('');
        expect(encrypt(undefined)).toBe('');
    });

    it('laisse passer une valeur en clair héritée', () => {
        // Les bases antérieures au chiffrement contiennent du texte nu ; la
        // lecture doit continuer de fonctionner avant que la migration ne passe.
        expect(decrypt('ancienne-cle-en-clair')).toBe('ancienne-cle-en-clair');
    });

    it('rejette une valeur altérée au lieu de renvoyer des octets faux', () => {
        const valid = encrypt('valeur-sensible');
        const tampered = valid.slice(0, -6) + 'AAAAAA';
        expect(decrypt(tampered)).toBe('');
    });

    it('rejette un chiffré tronqué', () => {
        const valid = encrypt('valeur-sensible');
        expect(decrypt(valid.slice(0, valid.length / 2))).toBe('');
    });

    it('préserve les caractères non ASCII', () => {
        const secret = 'clé-àéèùç-密码-🔑';
        expect(decrypt(encrypt(secret))).toBe(secret);
    });

    it('préserve les mots de passe d\'application WordPress (espaces compris)', () => {
        const secret = 'abcd EFGH ijkl MNOP qrst UVWX';
        expect(decrypt(encrypt(secret))).toBe(secret);
    });
});
