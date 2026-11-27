// Carte de la prospection sans clé (27/11/2026) : webview sur google.com/maps,
// partition isolée, aucune clé dans l'adresse, mise à jour après la frappe.
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, act, fireEvent } from '@testing-library/react';
import ProspectionMap, { MAP_DEBOUNCE_MS, MAP_PARTITION, MAP_LOAD_TIMEOUT_MS } from '../components/ProspectionMap';
import { mapsSearchUrl } from '../utils/mapsSearchUrl';

describe('mapsSearchUrl', () => {
    it('compose la recherche comme l\'extracteur : requête puis zone, sur /maps/search/', () => {
        expect(mapsSearchUrl('pharmacie', 'Yopougon', 'fr'))
            .toBe('https://www.google.com/maps/search/pharmacie%20Yopougon?hl=fr');
        expect(mapsSearchUrl('  boulangerie ', '', 'en-US'))
            .toBe('https://www.google.com/maps/search/boulangerie?hl=en');
    });

    it('encode les caractères spéciaux et ne porte jamais de clé', () => {
        const url = mapsSearchUrl('café & thé', 'Cocody', 'ar');
        expect(url).toBe('https://www.google.com/maps/search/caf%C3%A9%20%26%20th%C3%A9%20Cocody?hl=ar');
        expect(url).not.toMatch(/key=/);
    });

    it('rien sous trois caractères ; langue par défaut : français', () => {
        expect(mapsSearchUrl('ph', '', 'fr')).toBeNull();
        expect(mapsSearchUrl('', '', 'fr')).toBeNull();
        expect(mapsSearchUrl('pharmacie', '', undefined)).toMatch(/\?hl=fr$/);
    });
});

describe('ProspectionMap', () => {
    beforeEach(() => vi.useFakeTimers());
    afterEach(() => vi.useRealTimers());

    const webview = (conteneur) => conteneur.querySelector('webview');

    it('rien tant que la recherche est vide', () => {
        const { container } = render(<ProspectionMap query="" zone="" />);
        expect(webview(container)).toBeNull();
    });

    it('webview isolée, sans fenêtres surgissantes, chargée après la frappe seulement', () => {
        const { container, rerender } = render(<ProspectionMap query="" zone="" />);
        rerender(<ProspectionMap query="pha" zone="" />);
        rerender(<ProspectionMap query="pharma" zone="" />);
        rerender(<ProspectionMap query="pharmacie" zone="Yopougon" />);
        expect(webview(container)).toBeNull();

        act(() => { vi.advanceTimersByTime(MAP_DEBOUNCE_MS); });
        const vue = webview(container);
        expect(vue.getAttribute('src')).toBe('https://www.google.com/maps/search/pharmacie%20Yopougon?hl=fr');
        expect(vue.getAttribute('partition')).toBe(MAP_PARTITION);
        expect(vue.hasAttribute('allowpopups')).toBe(false);
        expect(vue.hasAttribute('preload')).toBe(false);
    });

    it('un échec de chargement s\'annonce ; une navigation remplacée (-3) non ; Réessayer recharge', () => {
        const { container, rerender, queryByRole, getByRole } = render(<ProspectionMap query="" zone="" />);
        rerender(<ProspectionMap query="pharmacie" zone="" />);
        act(() => { vi.advanceTimersByTime(MAP_DEBOUNCE_MS); });
        const vue = webview(container);
        vue.reload = vi.fn();

        const echec = (code) => {
            const e = new Event('did-fail-load');
            e.errorCode = code;
            e.isMainFrame = true;
            act(() => { vue.dispatchEvent(e); });
        };
        echec(-3);
        expect(queryByRole('alert')).toBeNull();
        echec(-105);
        expect(getByRole('alert')).toBeInTheDocument();

        fireEvent.click(getByRole('button'));
        expect(vue.reload).toHaveBeenCalledTimes(1);
        expect(queryByRole('alert')).toBeNull();
    });

    // Cadre blanc sans message (capture de l'utilisateur, 27/11/2026) : une
    // carte qui ne charge rien doit finir par le dire.
    describe('garde de chargement', () => {
        const ouvrir = () => {
            const rendu = render(<ProspectionMap query="" zone="" />);
            rendu.rerender(<ProspectionMap query="pharmacie" zone="" />);
            act(() => { vi.advanceTimersByTime(MAP_DEBOUNCE_MS); });
            return { ...rendu, vue: webview(rendu.container) };
        };

        it('rien de chargé au bout du délai : un message l\'annonce', () => {
            const { queryByRole, getByRole } = ouvrir();
            act(() => { vi.advanceTimersByTime(MAP_LOAD_TIMEOUT_MS - 1); });
            expect(queryByRole('alert')).toBeNull();
            act(() => { vi.advanceTimersByTime(1); });
            expect(getByRole('alert').textContent).toContain('prospectionMapTimeout');
        });

        it('chargée à temps : aucun message, même après le délai', () => {
            const { vue, queryByRole } = ouvrir();
            act(() => { vi.advanceTimersByTime(3000); });
            act(() => { vue.dispatchEvent(new Event('did-finish-load')); });
            act(() => { vi.advanceTimersByTime(MAP_LOAD_TIMEOUT_MS * 2); });
            expect(queryByRole('alert')).toBeNull();
        });

        it('Réessayer efface le message et relance le délai', () => {
            const { vue, queryByRole, getByRole } = ouvrir();
            vue.reload = vi.fn();
            act(() => { vi.advanceTimersByTime(MAP_LOAD_TIMEOUT_MS); });
            fireEvent.click(getByRole('button'));
            expect(vue.reload).toHaveBeenCalledTimes(1);
            expect(queryByRole('alert')).toBeNull();
            act(() => { vi.advanceTimersByTime(MAP_LOAD_TIMEOUT_MS); });
            expect(getByRole('alert')).toBeInTheDocument();
        });
    });
});
