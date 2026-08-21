// @vitest-environment node
import { describe, it, expect } from 'vitest';

// openaiService requiert le SDK openai au chargement (léger, sans réseau).
import { sanitizePromptForTogether } from '../openaiService.js';

describe('sanitizePromptForTogether', () => {
    it('remplace les termes déclencheurs du filtre BFL/Together', () => {
        const prompt = 'A female model with bare skin, skin tone visible, male model in background';
        const out = sanitizePromptForTogether(prompt);
        expect(out).not.toMatch(/female model/i);
        expect(out).not.toMatch(/bare skin/i);
        expect(out).not.toMatch(/skin tone/i);
        expect(out).toMatch(/fashion model/i);
    });

    it('laisse intact un prompt sans terme sensible', () => {
        const prompt = 'Un produit cosmétique sur un fond studio clair';
        expect(sanitizePromptForTogether(prompt)).toBe(prompt);
    });

    it('gère une entrée vide ou absente', () => {
        expect(sanitizePromptForTogether('')).toBe('');
        expect(sanitizePromptForTogether(null)).toBeNull();
        expect(sanitizePromptForTogether(undefined)).toBeUndefined();
    });
});
