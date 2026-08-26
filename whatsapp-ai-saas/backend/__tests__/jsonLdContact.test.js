// @vitest-environment node
import { describe, it, expect } from 'vitest';
import { extractContactFromJsonLd } from '../scrapers/jsonLdContact.js';

describe('extractContactFromJsonLd', () => {
    it('extrait email et url depuis un schéma Organization', () => {
        const out = extractContactFromJsonLd({
            '@type': 'Organization',
            email: 'contact@exemple.ci',
            url: 'https://exemple.ci'
        });
        expect(out).toEqual({ website: 'https://exemple.ci', email: 'contact@exemple.ci' });
    });

    it('extrait email et url depuis un schéma LocalBusiness', () => {
        const out = extractContactFromJsonLd({
            '@type': 'LocalBusiness',
            url: 'https://boutique.tg',
            email: 'info@boutique.tg'
        });
        expect(out).toEqual({ website: 'https://boutique.tg', email: 'info@boutique.tg' });
    });

    it('parcourt un tableau de schémas et retient le dernier pertinent', () => {
        const out = extractContactFromJsonLd([
            { '@type': 'Thing', name: 'inutile' },
            { '@type': 'Organization', email: 'a@b.com', url: 'https://b.com' }
        ]);
        expect(out).toEqual({ website: 'https://b.com', email: 'a@b.com' });
    });

    it('ignore les types non pertinents (Person, etc.)', () => {
        expect(extractContactFromJsonLd({ '@type': 'Person', email: 'x@y.com', url: 'https://y.com' }))
            .toEqual({ website: '', email: '' });
    });

    it('tolère une entrée nulle ou indéfinie', () => {
        expect(extractContactFromJsonLd(null)).toEqual({ website: '', email: '' });
        expect(extractContactFromJsonLd(undefined)).toEqual({ website: '', email: '' });
    });

    it('ne plante pas sur un objet sans @type', () => {
        expect(extractContactFromJsonLd({ email: 'z@z.com' })).toEqual({ website: '', email: '' });
    });
});
