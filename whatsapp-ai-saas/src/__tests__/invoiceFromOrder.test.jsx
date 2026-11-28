// Facture ouverte depuis une commande détectée (Orders.jsx pose invoiceDraft
// dans le store, puis navigue vers l'éditeur).
//
// Jusqu'au 27/11/2026, deux effets d'InvoiceBuilder consommaient ce brouillon.
// Le second écrasait le premier dans le même rendu : la facture perdait le
// profil de l'émetteur et la ligne reprenant le message WhatsApp.
import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import useAppStore from '../store';
import InvoiceBuilder from '../pages/InvoiceBuilder';
import { invoiceFromOrderDraft } from '../components/invoice/helpers';

const commande = {
    clientName: 'Fatou Diallo',
    notes: 'Commande WhatsApp détectée: "2 pagnes bazin"',
    rawMessage: '2 pagnes bazin',
    confidence: 0.9
};
const profil = { companyName: 'Boutique Awa', firstName: 'Awa', lastName: 'Koné', email: 'awa@example.com' };

describe('facture depuis une commande', () => {
    beforeEach(() => {
        useAppStore.setState({ invoiceDraft: null, userProfile: null });
    });

    it('invoiceFromOrderDraft : profil, client, notes et message en première ligne', () => {
        const facture = invoiceFromOrderDraft(commande, profil);
        expect(facture.companyName).toBe('Boutique Awa');
        expect(facture.senderInfo).toContain('Awa Koné');
        expect(facture.clientName).toBe('Fatou Diallo');
        expect(facture.notes).toBe(commande.notes);
        expect(facture.items).toHaveLength(1);
        expect(facture.items[0]).toMatchObject({ description: 'WhatsApp Request: 2 pagnes bazin...', qty: 1, price: 0 });
    });

    it('InvoiceBuilder s\'ouvre sur la facture complète et vide le brouillon du store', () => {
        useAppStore.setState({ invoiceDraft: commande, userProfile: profil });

        render(<MemoryRouter><InvoiceBuilder /></MemoryRouter>);

        expect(screen.getByDisplayValue('Fatou Diallo')).toBeInTheDocument();
        expect(screen.getByDisplayValue('Boutique Awa')).toBeInTheDocument();
        expect(screen.getByDisplayValue('WhatsApp Request: 2 pagnes bazin...')).toBeInTheDocument();
        expect(useAppStore.getState().invoiceDraft).toBeNull();
    });

    it('sans brouillon, InvoiceBuilder s\'ouvre sur le tableau de bord', () => {
        render(<MemoryRouter><InvoiceBuilder /></MemoryRouter>);
        expect(screen.queryByDisplayValue('WhatsApp Request: 2 pagnes bazin...')).toBeNull();
    });
});
