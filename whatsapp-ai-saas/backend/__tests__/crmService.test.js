import { describe, it, expect, beforeAll } from 'vitest';
import db from '../db';
import * as crmService from '../services/crmService';

describe('crmService — CRUD Contacts et Segments (SQLite en mémoire)', () => {
    beforeAll(async () => {
        await db.initDB();
    });

    it('createSegment puis listSegments renvoient le segment créé', async () => {
        const seg = await crmService.createSegment({ name: 'VIP E-Commerce' });
        expect(seg).toBeDefined();
        expect(seg.name).toBe('VIP E-Commerce');

        // Réutilisation si même nom
        const segReuse = await crmService.createSegment({ name: 'VIP E-Commerce' });
        expect(segReuse.id).toBe(seg.id);

        const list = await crmService.listSegments();
        expect(list.some(s => s.id === seg.id)).toBe(true);
    });

    it('createContact crée un contact et l\'associe à un segment', async () => {
        const seg = await crmService.createSegment({ name: 'Immobilier' });
        const contact = await crmService.createContact({
            name: 'Jean Dupont',
            phone: '0708091011',
            email: 'jean@example.com',
            address: 'Abidjan Cocody',
            segmentId: seg.id
        });

        expect(contact.id).toBeDefined();
        expect(contact.name).toBe('Jean Dupont');
        expect(contact.phone).toBe('0708091011');
        expect(contact.segment_id).toBe(seg.id);
        expect(contact.segment_name).toBe('Immobilier');
    });

    it('getContact récupère le contact avec son segment', async () => {
        const created = await crmService.createContact({
            name: 'Alice Konan',
            phone: '0102030405'
        });

        const fetched = await crmService.getContact(created.id);
        expect(fetched.name).toBe('Alice Konan');
        expect(fetched.phone).toBe('0102030405');
    });

    it('updateContact modifie les champs et réaffecte le segment', async () => {
        const segA = await crmService.createSegment({ name: 'Segment Initial' });
        const segB = await crmService.createSegment({ name: 'Segment Cible' });

        const contact = await crmService.createContact({
            name: 'Marc Kouassi',
            phone: '0505050505',
            segmentId: segA.id
        });

        const updated = await crmService.updateContact(contact.id, {
            name: 'Marc Kouassi Senior',
            segmentId: segB.id,
            email: 'marc@pro.ci'
        });

        expect(updated.name).toBe('Marc Kouassi Senior');
        expect(updated.segment_id).toBe(segB.id);
        expect(updated.segment_name).toBe('Segment Cible');
        expect(updated.email).toBe('marc@pro.ci');
    });

    it('listContacts filtre par segment, recherche et pagination', async () => {
        const segSearch = await crmService.createSegment({ name: 'Filtre Spécial' });
        await crmService.createContact({ name: 'Test Contact Alpha', phone: '09090901', segmentId: segSearch.id });
        await crmService.createContact({ name: 'Test Contact Beta', phone: '09090902', segmentId: segSearch.id });
        await crmService.createContact({ name: 'Autre Personne', phone: '09090903' });

        const segFiltered = await crmService.listContacts({ segmentId: segSearch.id });
        expect(segFiltered.length).toBeGreaterThanOrEqual(2);
        expect(segFiltered.every(c => c.segment_id === segSearch.id)).toBe(true);

        const searchFiltered = await crmService.listContacts({ search: 'Alpha' });
        expect(searchFiltered.some(c => c.name === 'Test Contact Alpha')).toBe(true);
        expect(searchFiltered.every(c => c.name.includes('Alpha') || c.phone.includes('Alpha'))).toBe(true);
    });

    it('assignContactsToSegment réaffecte en lot une liste d\'identifiants', async () => {
        const segDest = await crmService.createSegment({ name: 'Destination Lot' });
        const c1 = await crmService.createContact({ name: 'Lot Contact 1', phone: '08010101' });
        const c2 = await crmService.createContact({ name: 'Lot Contact 2', phone: '08020202' });

        const result = await crmService.assignContactsToSegment([c1.id, c2.id], segDest.id);
        expect(result.updatedCount).toBe(2);

        const f1 = await crmService.getContact(c1.id);
        const f2 = await crmService.getContact(c2.id);
        expect(f1.segment_id).toBe(segDest.id);
        expect(f2.segment_id).toBe(segDest.id);
    });

    it('deleteContact supprime le contact', async () => {
        const contact = await crmService.createContact({ name: 'A Supprimer', phone: '0000000001' });
        await crmService.deleteContact(contact.id);
        await expect(crmService.getContact(contact.id)).rejects.toThrow('Contact introuvable.');
    });

    it('deleteSegment dissocie les contacts du segment', async () => {
        const seg = await crmService.createSegment({ name: 'Segment A Supprimer' });
        const contact = await crmService.createContact({ name: 'Lie Au Segment', phone: '0000000002', segmentId: seg.id });

        await crmService.deleteSegment(seg.id);
        const refetched = await crmService.getContact(contact.id);
        expect(refetched.segment_id).toBeNull();
    });
});
