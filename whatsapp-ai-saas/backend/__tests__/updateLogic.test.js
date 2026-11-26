// @vitest-environment node
import { describe, it, expect, afterEach } from 'vitest';
import fs from 'fs';
import os from 'os';
import path from 'path';
import crypto from 'crypto';
import { Readable } from 'stream';
import { compareVersions, parseReleaseTag, pickAssetForPlatform, parseSha256Digest, downloadVerified } from '../../electron/updateLogic.cjs';

describe('compareVersions', () => {
    it('compare des versions à 3 segments', () => {
        expect(compareVersions('1.42.11', '1.39.3')).toBe(1);
        expect(compareVersions('1.39.3', '1.42.11')).toBe(-1);
        expect(compareVersions('1.42.0', '1.42.0')).toBe(0);
    });

    it('ignore le préfixe v', () => {
        expect(compareVersions('v1.42.0', '1.42.0')).toBe(0);
        expect(compareVersions('V1.43.0', '1.42.0')).toBe(1);
    });

    it('gère des segments manquants', () => {
        expect(compareVersions('1.42', '1.42.0')).toBe(0);
        expect(compareVersions('1.42', '1.42.1')).toBe(-1);
    });

    it('gère les suffixes de pré-release (ignorés)', () => {
        expect(compareVersions('1.42.11-beta.1', '1.42.11')).toBe(0);
    });

    it('gère une entrée vide', () => {
        expect(compareVersions('', '1.0.0')).toBe(-1);
        expect(compareVersions('1.0.0', '')).toBe(1);
    });
});

describe('parseReleaseTag', () => {
    it('retire uniquement le préfixe v', () => {
        expect(parseReleaseTag('v1.42.0')).toBe('1.42.0');
        expect(parseReleaseTag('1.39.3')).toBe('1.39.3');
    });

    it('ne retire pas les v internes (régression : replace("v","") le faisait)', () => {
        expect(parseReleaseTag('v1.4v2')).toBe('1.4v2');
    });

    it('gère une entrée vide', () => {
        expect(parseReleaseTag('')).toBe('');
        expect(parseReleaseTag(null)).toBe('');
    });
});

describe('pickAssetForPlatform', () => {
    const assets = [
        { name: 'WaCopilote_Setup.exe' },
        { name: 'WaCopilote-1.42.11.dmg' },
        { name: 'WaCopilote-1.42.11.AppImage' },
        { name: 'WaCopilote-1.42.11.deb' },
        { name: 'latest.yml' },
    ];

    it('sélectionne l\'exe sur Windows', () => {
        const { asset } = pickAssetForPlatform(assets, 'win32');
        expect(asset.name).toBe('WaCopilote_Setup.exe');
    });

    it('sélectionne le dmg sur macOS', () => {
        const { asset } = pickAssetForPlatform(assets, 'darwin');
        expect(asset.name).toBe('WaCopilote-1.42.11.dmg');
    });

    it('sélectionne l\'AppImage sur Linux', () => {
        const { asset } = pickAssetForPlatform(assets, 'linux');
        expect(asset.name).toBe('WaCopilote-1.42.11.AppImage');
    });

    it('renvoie null si aucun asset pour la plateforme', () => {
        const { asset } = pickAssetForPlatform([{ name: 'WaCopilote_Setup.exe' }], 'linux');
        expect(asset).toBeNull();
    });

    it('ignore les assets sans nom', () => {
        const { asset } = pickAssetForPlatform([{ label: 'x' }, { name: 'WaCopilote_Setup.exe' }], 'win32');
        expect(asset.name).toBe('WaCopilote_Setup.exe');
    });

    it('gère une liste vide', () => {
        const { asset } = pickAssetForPlatform([], 'win32');
        expect(asset).toBeNull();
    });

    // Ordre réel de la release v1.49.0, relevé sur l'API GitHub le 26/11/2026 :
    // l'installeur Inno Setup d'abord, le NSIS ensuite. L'ancienne règle
    // « premier .exe » prenait l'Inno et le lançait avec /S (option NSIS).
    it('prend l\'installeur NSIS même quand un autre .exe le précède (release v1.49.0)', () => {
        const v149 = [{ name: 'WaCopilote.1.49.0.exe' }, { name: 'WaCopilote_Setup.exe' }];
        expect(pickAssetForPlatform(v149, 'win32').asset.name).toBe('WaCopilote_Setup.exe');
    });

    it('ne retient jamais un .exe qui n\'est pas l\'installeur NSIS', () => {
        expect(pickAssetForPlatform([{ name: 'WaCopilote.1.49.0.exe' }], 'win32').asset).toBeNull();
    });
});

describe('parseSha256Digest', () => {
    it('lit le format publié par GitHub', () => {
        const hex = 'a24f952463737fa0841bc17067b3a8f9b12238812db1e4aa7fb3a7a5752e7004';
        expect(parseSha256Digest(`sha256:${hex}`)).toBe(hex);
        expect(parseSha256Digest(`SHA256:${hex.toUpperCase()}`)).toBe(hex);
    });

    it('rend null pour une empreinte absente ou d\'un autre format', () => {
        expect(parseSha256Digest(undefined)).toBeNull();
        expect(parseSha256Digest('md5:abc')).toBeNull();
        expect(parseSha256Digest('sha256:trop-court')).toBeNull();
    });
});

describe('downloadVerified', () => {
    const contenu = Buffer.from('installeur NSIS factice — contenu de test');
    const empreinte = crypto.createHash('sha256').update(contenu).digest('hex');
    const dossier = fs.mkdtempSync(path.join(os.tmpdir(), 'wacopilote-maj-'));
    const dest = path.join(dossier, 'WaCopilote-Update.exe');
    const reponse = (morceaux, enTetes = {}) => ({ data: Readable.from(morceaux), headers: enTetes });

    afterEach(() => { if (fs.existsSync(dest)) fs.unlinkSync(dest); });

    it('écrit le fichier et rend taille et empreinte quand tout concorde', async () => {
        const progres = [];
        const r = await downloadVerified(reponse([contenu.subarray(0, 10), contenu.subarray(10)]), {
            dest, expectedSize: contenu.length, expectedSha256: empreinte, onProgress: (p) => progres.push(p)
        });
        expect(r).toEqual({ bytes: contenu.length, sha256: empreinte });
        expect(fs.readFileSync(dest)).toEqual(contenu);
        expect(progres.at(-1)).toBe(100);
    });

    it('refuse et supprime un fichier dont l\'empreinte diffère', async () => {
        await expect(downloadVerified(reponse([contenu]), {
            dest, expectedSize: contenu.length, expectedSha256: 'f'.repeat(64)
        })).rejects.toThrow(/Empreinte SHA-256 différente/);
        expect(fs.existsSync(dest)).toBe(false);
    });

    it('refuse et supprime un téléchargement tronqué', async () => {
        await expect(downloadVerified(reponse([contenu.subarray(0, 5)]), {
            dest, expectedSize: contenu.length
        })).rejects.toThrow(/Téléchargement incomplet/);
        expect(fs.existsSync(dest)).toBe(false);
    });

    // Le défaut corrigé : un flux coupé en cours de route rejetait hors du
    // try/catch d'updater.cjs, l'écran restait sur « Téléchargement… ».
    it('un flux coupé en cours de route lève une erreur au lieu de rester sans réponse', async () => {
        const coupe = new Readable({
            read() {
                this.push(contenu.subarray(0, 8));
                this.destroy(new Error('socket hang up'));
            }
        });
        await expect(downloadVerified({ data: coupe, headers: {} }, { dest, expectedSize: contenu.length }))
            .rejects.toThrow(/socket hang up/);
        expect(fs.existsSync(dest)).toBe(false);
    });
});
