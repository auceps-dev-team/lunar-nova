// Recopie du modèle choisi dans les Paramètres côté backend (default_chat_model).
// Mesuré le 26/11/2026 : ce choix ne vivait que dans l'interface, et la
// Rédaction, la prospection, MCP et le CLI partaient sur le modèle codé en dur
// de chaque adaptateur. La synchronisation ne doit écrire qu'un modèle de la
// liste du fournisseur ENREGISTRÉ, sinon les appels échoueraient.
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import useAppStore from '../store';

let appels;

beforeEach(() => {
    appels = [];
    vi.stubGlobal('fetch', vi.fn(async (url, init) => {
        appels.push({ url: String(url), body: init?.body ? JSON.parse(init.body) : null, method: init?.method });
        return new Response('{"status":"success"}', { status: 200 });
    }));
});
afterEach(() => vi.unstubAllGlobals());

const etat = ({ model, chat, recopie }) => useAppStore.setState((s) => ({
    appSettings: { ...s.appSettings, model },
    availableModels: { chat: chat.map((id) => ({ id, name: id })) },
    backendSettings: { ...s.backendSettings, default_chat_model: recopie }
}));

describe('syncDefaultChatModel', () => {
    it('écrit le modèle choisi s\'il figure dans la liste du fournisseur enregistré', async () => {
        etat({ model: 'qwen/qwen3-coder', chat: ['meta/llama-3.1-8b-instruct', 'qwen/qwen3-coder'], recopie: undefined });

        await expect(useAppStore.getState().syncDefaultChatModel()).resolves.toBe(true);

        expect(appels).toHaveLength(1);
        expect(appels[0]).toMatchObject({ method: 'PUT', body: { default_chat_model: 'qwen/qwen3-coder' } });
        expect(appels[0].url).toMatch(/\/api\/settings$/);
        expect(useAppStore.getState().backendSettings.default_chat_model).toBe('qwen/qwen3-coder');
    });

    it('n\'écrit pas un modèle absent de la liste (identifiant d\'un autre fournisseur)', async () => {
        etat({ model: 'gemini-2.5-pro', chat: ['meta/llama-3.1-8b-instruct'], recopie: undefined });
        await expect(useAppStore.getState().syncDefaultChatModel()).resolves.toBe(false);
        expect(appels).toHaveLength(0);
    });

    it('n\'écrit rien quand le backend a déjà ce modèle', async () => {
        etat({ model: 'qwen/qwen3-coder', chat: ['qwen/qwen3-coder'], recopie: 'qwen/qwen3-coder' });
        await expect(useAppStore.getState().syncDefaultChatModel()).resolves.toBe(false);
        expect(appels).toHaveLength(0);
    });
});
