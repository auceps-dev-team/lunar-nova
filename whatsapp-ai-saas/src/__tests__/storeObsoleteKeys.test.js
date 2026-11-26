// Clés retirées du store avec la génération d'image (agentHistory,
// pendingEditImage, aiQuota). Elles restent dans l'IndexedDB des installations
// existantes : ce fichier prouve qu'elles ne sont ni réhydratées, ni réécrites.
// Sans le filtre, agentHistory — jusqu'à 20 images en base64 — serait recopié
// à chaque sauvegarde, sans que rien ne le signale.
import { describe, it, expect } from 'vitest';
import useAppStore, { OBSOLETE_PERSISTED_KEYS, withoutObsoleteKeys } from '../store';

const ancienEtatPersiste = {
    agentHistory: [{ id: '1', agentId: 'photoshoot', generatedImage: 'data:image/jpeg;base64,QUJD' }],
    pendingEditImage: { data: 'data:image/png;base64,QUJD' },
    aiQuota: { hasCustomKey: false, imageUsed: 12, imageLimit: 40 },
    prospectSearchQuery: 'Pharmacies Abidjan'
};

describe('store — clés obsolètes de la génération d\'image', () => {
    it('liste exactement les trois clés retirées', () => {
        expect(OBSOLETE_PERSISTED_KEYS).toEqual(['agentHistory', 'pendingEditImage', 'aiQuota']);
    });

    it('withoutObsoleteKeys les retire et garde le reste, sans modifier l\'entrée', () => {
        const copie = structuredClone(ancienEtatPersiste);
        expect(withoutObsoleteKeys(copie)).toEqual({ prospectSearchQuery: 'Pharmacies Abidjan' });
        expect(copie).toEqual(ancienEtatPersiste);
    });

    it('la réhydratation ne les ramène pas en mémoire', () => {
        const { merge } = useAppStore.persist.getOptions();
        const fusion = merge(structuredClone(ancienEtatPersiste), useAppStore.getState());
        for (const cle of OBSOLETE_PERSISTED_KEYS) expect(fusion).not.toHaveProperty(cle);
        expect(fusion.prospectSearchQuery).toBe('Pharmacies Abidjan');
    });

    it('la sauvegarde ne les réécrit pas, même présentes en mémoire', () => {
        const { partialize } = useAppStore.persist.getOptions();
        const sauvegarde = partialize({ ...useAppStore.getState(), ...structuredClone(ancienEtatPersiste) });
        for (const cle of OBSOLETE_PERSISTED_KEYS) expect(sauvegarde).not.toHaveProperty(cle);
        expect(sauvegarde.prospectSearchQuery).toBe('Pharmacies Abidjan');
    });

    it('un état persisté absent se réhydrate sans erreur', () => {
        const { merge } = useAppStore.persist.getOptions();
        expect(() => merge(undefined, useAppStore.getState())).not.toThrow();
    });
});
