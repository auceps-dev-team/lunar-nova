/**
 * Requête du copilote de l'espace WhatsApp vers POST /api/ai/agent.
 *
 * Le copilote joint au message de l'utilisateur les derniers messages de la
 * conversation ouverte, et leurs images. Ce texte est écrit par le contact,
 * pas par l'utilisateur : la requête porte alors `untrustedInput`, et le
 * backend écarte les agents locaux (Claude Code, Gemini CLI, serveur MCP),
 * qui ont accès aux fichiers du poste (constat S3).
 *
 * Le drapeau reste posé pour toute la suite de la discussion : les réponses
 * précédentes de l'agent, renvoyées dans l'historique, ont pu reprendre des
 * consignes écrites par le contact.
 */

// Nombre de messages de la conversation joints à la requête.
export const WHATSAPP_CONTEXT_MESSAGES = 8;

/**
 * @param {object} params
 * @param {string} params.userMsg Message tapé par l'utilisateur.
 * @param {Array<{role: string, text: string, proposals?: string[]}>} [params.chatHistory]
 *   Discussion du copilote avant ce message.
 * @param {{contactName?: string, messages?: Array<{time?: string, sender?: string, text?: string, media?: string}>}|null} [params.whatsappContext]
 *   Conversation lue dans WhatsApp Web (null si la lecture est désactivée ou a échoué).
 * @param {Array<object>} [params.attachments] Fichiers joints par l'utilisateur.
 * @param {boolean} [params.contactTextEarlier=false] Un message précédent de
 *   cette discussion a déjà joint la conversation.
 * @param {string} [params.provider]
 * @param {string} [params.model]
 * @returns {object} Corps JSON de la requête.
 */
export function buildCopilotAgentRequest({
    userMsg,
    chatHistory = [],
    whatsappContext = null,
    attachments = [],
    contactTextEarlier = false,
    provider,
    model
}) {
    const messages = chatHistory
        .filter((msg) => !msg.proposals)
        .map((msg) => ({ role: msg.role === 'agent' ? 'model' : 'user', text: msg.text }));

    let message = userMsg;
    const finalAttachments = [...attachments];
    const conversation = whatsappContext && Array.isArray(whatsappContext.messages)
        ? whatsappContext.messages
        : [];

    if (conversation.length > 0) {
        let formattedChat = `[Contexte Whatsapp Actuel: Chat with ${whatsappContext.contactName}]\n`;
        conversation.slice(-WHATSAPP_CONTEXT_MESSAGES).forEach((msg) => {
            formattedChat += `[${msg.time}] ${msg.sender}: ${msg.text}\n`;
            if (msg.media) {
                finalAttachments.push({
                    name: 'whatsapp_image.jpg',
                    data: msg.media,
                    mimeType: 'image/jpeg'
                });
            }
        });
        message = `${formattedChat}\n\n[USER]: ${userMsg}`;
    }

    return {
        persona: 'copilot',
        message,
        attachments: finalAttachments,
        messages,
        promptFormat: 'text',
        provider,
        model,
        untrustedInput: conversation.length > 0 || Boolean(contactTextEarlier)
    };
}
