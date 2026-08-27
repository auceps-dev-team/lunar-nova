import { describe, it, expect, beforeEach } from 'vitest';
import useAppStore from '../store';

describe('useAppStore — Prospection B2B State', () => {
    beforeEach(() => {
        useAppStore.setState({
            prospectSearchQuery: '',
            prospectLeads: []
        });
    });

    it('initialise avec une requête vide et un tableau de leads vide', () => {
        const state = useAppStore.getState();
        expect(state.prospectSearchQuery).toBe('');
        expect(state.prospectLeads).toEqual([]);
    });

    it('met à jour prospectSearchQuery via setProspectSearchQuery', () => {
        const { setProspectSearchQuery } = useAppStore.getState();
        setProspectSearchQuery('Pharmacies Abidjan');
        expect(useAppStore.getState().prospectSearchQuery).toBe('Pharmacies Abidjan');
    });

    it('gère les valeurs null/undefined sur setProspectSearchQuery', () => {
        const { setProspectSearchQuery } = useAppStore.getState();
        setProspectSearchQuery(null);
        expect(useAppStore.getState().prospectSearchQuery).toBe('');
    });

    it('stocke les leads découverts via setProspectLeads', () => {
        const { setProspectLeads } = useAppStore.getState();
        const sampleLeads = [
            { name: 'Pharmacie 1', phone: '0707070707', source: 'Google Maps' },
            { name: 'Pharmacie 2', phone: '0101010101', source: 'Annuaire CI' }
        ];
        setProspectLeads(sampleLeads);
        expect(useAppStore.getState().prospectLeads).toHaveLength(2);
        expect(useAppStore.getState().prospectLeads[0].name).toBe('Pharmacie 1');
    });

    it('supporte les mises à jour fonctionnelles de leads (append / filter)', () => {
        const { setProspectLeads } = useAppStore.getState();
        setProspectLeads([{ name: 'Lead 1', phone: '111' }]);
        setProspectLeads(prev => [...prev, { name: 'Lead 2', phone: '222' }]);
        expect(useAppStore.getState().prospectLeads).toHaveLength(2);

        setProspectLeads(prev => prev.filter(l => l.name !== 'Lead 1'));
        expect(useAppStore.getState().prospectLeads).toHaveLength(1);
        expect(useAppStore.getState().prospectLeads[0].name).toBe('Lead 2');
    });
});
