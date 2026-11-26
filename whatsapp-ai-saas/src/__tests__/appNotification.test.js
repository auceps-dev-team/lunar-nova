// Durée d'affichage des notifications (26/11/2026) : chacune reste affichée
// APP_NOTIFICATION_MS depuis SON affichage, quel que soit le minuteur de la
// précédente. Défaut relevé par la sonde de l'outil de rédaction, dans
// l'application construite.
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { createNotificationsSlice, APP_NOTIFICATION_MS } from '../state/notificationsSlice';

let etat;
let slice;
beforeEach(() => {
    vi.useFakeTimers();
    etat = {};
    slice = createNotificationsSlice((partiel) => Object.assign(etat, partiel));
});
afterEach(() => vi.useRealTimers());

describe('notifications de l\'application', () => {
    it('le minuteur d\'une notification précédente n\'efface pas la suivante', () => {
        slice.showAppNotification('Réécriture en cours...');
        vi.advanceTimersByTime(APP_NOTIFICATION_MS - 300);
        slice.showAppNotification('Le texte réécrit est dans le presse-papiers.', 'error');
        vi.advanceTimersByTime(1000);
        expect(etat.appNotification).toEqual({ msg: 'Le texte réécrit est dans le presse-papiers.', type: 'error' });
        vi.advanceTimersByTime(APP_NOTIFICATION_MS - 1000);
        expect(etat.appNotification).toBeNull();
    });

    it('une notification seule disparaît après la durée prévue', () => {
        slice.showAppNotification('Copié');
        vi.advanceTimersByTime(APP_NOTIFICATION_MS - 1);
        expect(etat.appNotification).toEqual({ msg: 'Copié', type: 'success' });
        vi.advanceTimersByTime(1);
        expect(etat.appNotification).toBeNull();
    });

    it('effacer à la main arrête le minuteur en cours', () => {
        slice.showAppNotification('A');
        slice.clearAppNotification();
        expect(etat.appNotification).toBeNull();
        expect(vi.getTimerCount()).toBe(0);
    });
});
