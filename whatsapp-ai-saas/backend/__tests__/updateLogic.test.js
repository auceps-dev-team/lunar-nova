// @vitest-environment node
import { describe, it, expect } from 'vitest';
import { compareVersions, parseReleaseTag, pickAssetForPlatform } from '../../electron/updateLogic.cjs';

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
});
