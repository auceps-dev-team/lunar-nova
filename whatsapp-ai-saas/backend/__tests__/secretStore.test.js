// @vitest-environment node
import { describe, it, expect, beforeAll, vi } from 'vitest';

// La clé maître est fixée avant l'import : secretStore la résout au chargement du
// module et, sans elle, écrirait un fichier de clé dans l'arborescence du projet.
process.env.WACOPILOTE_MASTER_KEY = 'a'.repeat(64);

let encrypt, decrypt, isEncrypted, PREFIX, getDecryptionStatus;

beforeAll(async () => {
    ({ encrypt, decrypt, isEncrypted, PREFIX, getDecryptionStatus } = await import('../secretStore.js'));
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

    // C4 : l'échec de déchiffrement doit être OBSERVABLE (bannière UI via
    // GET /api/settings/channels-status), pas seulement une ligne stderr et
    // un champ vide indiscernable de « clé non configurée ».
    it('rapporte la dégradation après un échec de déchiffrement (C4)', () => {
        const tampered = encrypt('valeur-sensible').slice(0, -6) + 'AAAAAA';
        expect(decrypt(tampered)).toBe('');
        const status = getDecryptionStatus();
        expect(status.degraded).toBe(true);
        // L'horodatage conserve la PREMIÈRE occurrence (une clé maître ne
        // re-matche pas par magie : l'état est structurel pour le processus).
        expect(typeof status.failedAt).toBe('string');
        expect(Number.isNaN(Date.parse(status.failedAt))).toBe(false);
    });

    it('un module sans aucun échec ne se déclare pas dégradé (C4)', async () => {
        vi.resetModules();
        const fresh = await import('../secretStore.js');
        const status = fresh.getDecryptionStatus();
        expect(status.degraded).toBe(false);
        expect(status.failedAt).toBeNull();
        // Un déchiffrement réussi ne déclenche pas la dégradation.
        expect(fresh.decrypt(fresh.encrypt('ok'))).toBe('ok');
        expect(fresh.getDecryptionStatus().degraded).toBe(false);
    });

    // C7 : la GÉNÉRATION d'une nouvelle clé maître (dernier repli) est l'événement
    // amont qui rend tous les secrets existants illisibles — elle doit laisser
    // une trace consultable (horodatage + motif), pas seulement un fichier neuf.
    it('trace la régénération de la clé maître avec motif (C7)', async () => {
        const fs = await import('fs');
        const os = await import('os');
        const path = await import('path');
        vi.resetModules();

        const prevKey = process.env.WACOPILOTE_MASTER_KEY;
        const prevData = process.env.USER_DATA_PATH;
        // Répertoire vierge : aucune clé résoluble → dernier repli (génération).
        const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'waco-keytrace-'));
        delete process.env.WACOPILOTE_MASTER_KEY;
        process.env.USER_DATA_PATH = dir;
        try {
            const fresh = await import('../secretStore.js');
            const status = fresh.getDecryptionStatus();
            expect(status.generatedAt).toBeTruthy();
            expect(Number.isNaN(Date.parse(status.generatedAt))).toBe(false);
            expect(status.generatedReason).toMatch(/aucune clé maître résoluble/);
            // Le module fonctionne normalement avec la clé fraîchement générée.
            expect(fresh.decrypt(fresh.encrypt('ok'))).toBe('ok');
        } finally {
            if (prevKey !== undefined) process.env.WACOPILOTE_MASTER_KEY = prevKey;
            else delete process.env.WACOPILOTE_MASTER_KEY;
            if (prevData !== undefined) process.env.USER_DATA_PATH = prevData;
            else delete process.env.USER_DATA_PATH;
        }
    });

    it('un module chargé avec la clé d\'env n\'a rien généré (C7)', async () => {
        vi.resetModules();
        // WACOPILOTE_MASTER_KEY est posée en tête de fichier : la résolution
        // s'arrête à la première étape, sans passer par la génération.
        const fresh = await import('../secretStore.js');
        const status = fresh.getDecryptionStatus();
        expect(status.generatedAt).toBeNull();
        expect(status.generatedReason).toBeNull();
    });
});
