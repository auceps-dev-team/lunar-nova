// Requête du copilote de l'espace WhatsApp (S3) : dès que la conversation
// est jointe, la requête porte untrustedInput, et le reste pour la suite de
// la discussion.
import { describe, it, expect } from 'vitest';
import { buildCopilotAgentRequest, WHATSAPP_CONTEXT_MESSAGES } from '../utils/copilotRequest';

const conversation = (n, extra = {}) => ({
    contactName: 'Awa Boutique',
    messages: Array.from({ length: n }, (_, i) => ({
        time: `10:0${i % 10}`,
        sender: 'Awa Boutique',
        text: `message ${i + 1}`,
        ...extra
    }))
});

describe('buildCopilotAgentRequest', () => {
    it('conversation jointe : texte du contact dans le message, requête marquée', () => {
        const body = buildCopilotAgentRequest({
            userMsg: 'Propose une réponse',
            whatsappContext: conversation(2),
            provider: 'cli',
            model: 'claude'
        });

        expect(body.untrustedInput).toBe(true);
        expect(body.persona).toBe('copilot');
        expect(body.message).toContain('[Contexte Whatsapp Actuel: Chat with Awa Boutique]');
        expect(body.message).toContain('Awa Boutique: message 2');
        expect(body.message.endsWith('[USER]: Propose une réponse')).toBe(true);
        expect(body.provider).toBe('cli');
        expect(body.model).toBe('claude');
    });

    it(`ne joint que les ${WHATSAPP_CONTEXT_MESSAGES} derniers messages, et leurs images`, () => {
        const body = buildCopilotAgentRequest({
            userMsg: 'Résume',
            whatsappContext: conversation(12, { media: 'aW1hZ2U=' }),
            attachments: [{ name: 'devis.pdf', data: 'cGRm', mimeType: 'application/pdf' }]
        });

        expect(body.message).not.toContain('message 4');
        expect(body.message).toContain('message 5');
        expect(body.message).toContain('message 12');
        expect(body.attachments).toHaveLength(1 + WHATSAPP_CONTEXT_MESSAGES);
        expect(body.attachments[0].name).toBe('devis.pdf');
        expect(body.attachments[1]).toEqual({ name: 'whatsapp_image.jpg', data: 'aW1hZ2U=', mimeType: 'image/jpeg' });
    });

    it('sans conversation jointe, la requête n\'est pas marquée et le message est inchangé', () => {
        for (const whatsappContext of [null, { error: 'Sélecteurs indisponibles' }, conversation(0)]) {
            const body = buildCopilotAgentRequest({ userMsg: 'Bonjour', whatsappContext });
            expect(body.untrustedInput).toBe(false);
            expect(body.message).toBe('Bonjour');
            expect(body.attachments).toEqual([]);
        }
    });

    it('reste marquée quand la conversation a été jointe plus tôt dans la discussion', () => {
        // Lecture désactivée entre-temps, ou lecture qui échoue : l'historique
        // contient encore des réponses fondées sur le texte du contact.
        const body = buildCopilotAgentRequest({
            userMsg: 'Et maintenant ?',
            whatsappContext: null,
            contactTextEarlier: true
        });
        expect(body.untrustedInput).toBe(true);
        expect(body.message).toBe('Et maintenant ?');
    });

    it('historique : propositions écartées, rôles convertis', () => {
        const body = buildCopilotAgentRequest({
            userMsg: 'Suite',
            chatHistory: [
                { role: 'agent', text: 'Bienvenue' },
                { role: 'user', text: 'Analyse' },
                { role: 'agent', text: 'Voici trois réponses', proposals: ['a', 'b', 'c'] }
            ]
        });
        expect(body.messages).toEqual([
            { role: 'model', text: 'Bienvenue' },
            { role: 'user', text: 'Analyse' }
        ]);
    });
});
