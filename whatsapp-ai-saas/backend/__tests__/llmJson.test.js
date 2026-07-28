// @vitest-environment node
import { describe, it, expect } from 'vitest';
import { parseLlmJson, stripCodeFences, extractFirstJsonBlock } from '../llmJson.js';

describe('stripCodeFences', () => {
    it('retire les délimiteurs ```json', () => {
        expect(stripCodeFences('```json\n{"a":1}\n```')).toBe('{"a":1}');
    });

    it('retire les délimiteurs sans langage', () => {
        expect(stripCodeFences('```\n{"a":1}\n```')).toBe('{"a":1}');
    });

    it('laisse intact un texte sans délimiteur', () => {
        expect(stripCodeFences('{"a":1}')).toBe('{"a":1}');
    });
});

describe('extractFirstJsonBlock', () => {
    it('isole un objet entouré de texte', () => {
        expect(extractFirstJsonBlock('Voici : {"a":1} voilà.')).toBe('{"a":1}');
    });

    it('isole un tableau', () => {
        expect(extractFirstJsonBlock('Réponses : ["x","y"]')).toBe('["x","y"]');
    });

    it('gère les objets imbriqués', () => {
        expect(extractFirstJsonBlock('x {"a":{"b":[1,2]}} y')).toBe('{"a":{"b":[1,2]}}');
    });

    // Le cas qui met en défaut une recherche naïve du dernier « } » : une
    // accolade à l'intérieur d'une chaîne. Un message client contenant « { »
    // suffit à déclencher ce scénario.
    it('ignore les accolades situées dans une chaîne', () => {
        const input = 'texte {"msg":"prix de }{ chez vous","ok":true} fin';
        expect(extractFirstJsonBlock(input)).toBe('{"msg":"prix de }{ chez vous","ok":true}');
    });

    it('gère les guillemets échappés', () => {
        const input = '{"msg":"il a dit \\"bonjour\\""}';
        expect(extractFirstJsonBlock(input)).toBe(input);
    });

    it('renvoie null si aucun bloc JSON', () => {
        expect(extractFirstJsonBlock('aucune structure ici')).toBeNull();
    });

    it('renvoie null si le bloc est inachevé', () => {
        expect(extractFirstJsonBlock('{"a":1')).toBeNull();
    });
});

describe('parseLlmJson', () => {
    it('analyse un JSON nu', () => {
        expect(parseLlmJson('{"proposed_replies":["ok"]}')).toEqual({ proposed_replies: ['ok'] });
    });

    it('analyse un JSON en bloc de code', () => {
        expect(parseLlmJson('```json\n{"a":1}\n```')).toEqual({ a: 1 });
    });

    // Régression : c'est exactement ce que l'ancien nettoyage ne savait pas faire.
    it('analyse un JSON précédé de texte libre', () => {
        const raw = "Bien sûr ! Voici mes propositions :\n\n```json\n{\"proposed_replies\":[\"Bonjour\"]}\n```\n\nDites-moi si cela convient.";
        expect(parseLlmJson(raw)).toEqual({ proposed_replies: ['Bonjour'] });
    });

    it('analyse un tableau renvoyé directement', () => {
        expect(parseLlmJson('["a","b"]')).toEqual(['a', 'b']);
    });

    it('renvoie le fallback sur une réponse vide', () => {
        const fb = { proposed_replies: [] };
        expect(parseLlmJson('', fb)).toBe(fb);
        expect(parseLlmJson('   ', fb)).toBe(fb);
        expect(parseLlmJson(null, fb)).toBe(fb);
        expect(parseLlmJson(undefined, fb)).toBe(fb);
    });

    it('renvoie le fallback sur du texte sans JSON', () => {
        const fb = { is_order: false };
        expect(parseLlmJson("Je ne peux pas répondre à cette demande.", fb)).toBe(fb);
    });

    it('renvoie le fallback sur un JSON malformé', () => {
        const fb = null;
        expect(parseLlmJson('{"a":1,,}', fb)).toBe(fb);
    });

    it('préserve les accents et emojis', () => {
        const raw = '{"summary":"Commande de 3 pagnes — livraison à Cocody 🚚"}';
        expect(parseLlmJson(raw).summary).toBe('Commande de 3 pagnes — livraison à Cocody 🚚');
    });
});
