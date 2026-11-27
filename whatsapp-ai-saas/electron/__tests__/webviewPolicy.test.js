// @vitest-environment node
//
// Webviews autorisées (v1.51.2) : WhatsApp Web comme le veut le correctif S7,
// plus la carte Google Maps sans clé, sous une condition étroite.
import { describe, it, expect } from 'vitest';

const { webviewKind, MAPS_PARTITION } = require('../webviewPolicy.cjs');

describe('webviewKind', () => {
    it('WhatsApp Web, dans la partition de son instance', () => {
        expect(webviewKind('https://web.whatsapp.com', 'persist:wa-tab-1795750195324')).toBe('whatsapp');
        expect(webviewKind('https://web.whatsapp.com/login/', 'persist:wa-tab-1')).toBe('whatsapp');
    });

    it('la carte : google.com/maps dans la partition dédiée', () => {
        expect(webviewKind('https://www.google.com/maps/search/pharmacie%20Yopougon?hl=fr', MAPS_PARTITION)).toBe('maps');
        expect(webviewKind('https://www.google.com/maps', MAPS_PARTITION)).toBe('maps');
    });

    it('refuse la carte hors de sa partition, ou une autre page Google dans cette partition', () => {
        expect(webviewKind('https://www.google.com/maps/search/x', 'persist:wa-tab-1')).toBeNull();
        expect(webviewKind('https://www.google.com/maps/search/x', undefined)).toBeNull();
        expect(webviewKind('https://www.google.com/search?q=x', MAPS_PARTITION)).toBeNull();
        expect(webviewKind('https://www.google.com/mapsevil', MAPS_PARTITION)).toBeNull();
        expect(webviewKind('https://accounts.google.com/maps', MAPS_PARTITION)).toBeNull();
    });

    it('refuse les origines voisines ou déguisées', () => {
        expect(webviewKind('https://www.google.com.evil.example/maps', MAPS_PARTITION)).toBeNull();
        expect(webviewKind('http://www.google.com/maps', MAPS_PARTITION)).toBeNull();
        expect(webviewKind('https://maps.google.com/maps', MAPS_PARTITION)).toBeNull();
        expect(webviewKind('https://web.whatsapp.com.evil.example', 'persist:wa-tab-1')).toBeNull();
        expect(webviewKind('https://evil.example', 'persist:wa-tab-1')).toBeNull();
    });

    it('WhatsApp n\'emprunte pas la partition de la carte ; adresse illisible refusée', () => {
        expect(webviewKind('https://web.whatsapp.com', MAPS_PARTITION)).toBeNull();
        expect(webviewKind('pas une adresse', MAPS_PARTITION)).toBeNull();
        expect(webviewKind(undefined, undefined)).toBeNull();
    });
});
