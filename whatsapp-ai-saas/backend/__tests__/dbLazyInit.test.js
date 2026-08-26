// Constat N14 (P2-2) : le module db.js ne doit plus déclencher son
// initialisation — ni un process.exit — au simple require. L'initialisation
// devient idempotente et démarrée soit par server.js, soit paresseusement par
// le premier accesseur. Ces tests valident ce contrat SANS exiger le binding
// natif sqlite3 : sans binding (bac à sable), initDB() résout à false et les
// accesseurs dégradent vers leurs valeurs par défaut ; avec binding (CI), le
// même contrat booléen tient et getSetting renvoie aussi la valeur par défaut
// pour une clé absente.
// @vitest-environment node
import { describe, it, expect } from 'vitest';

const db = require('../db');

describe('db.js — initialisation injectable (N14)', () => {
    it('le require du module n\'a aucun effet de bord : initDB est exportée et aucune sortie forcée n\'a eu lieu', () => {
        // Si le require avait déclenché le fail fast d'origine, la suite se
        // serait arrêtée avant ce test (process.exit intercepté par Vitest).
        expect(typeof db.initDB).toBe('function');
        expect(typeof db.getSetting).toBe('function');
        expect(typeof db.pool).toBe('object');
    });

    it('initDB() résout vers un booléen (succès avec binding, échec propre sans binding)', async () => {
        const ok = await db.initDB();
        expect(typeof ok).toBe('boolean');
    });

    it('initDB() est idempotente : le même travail n\'est pas rejoué', async () => {
        const first = db.initDB();
        const second = db.initDB();
        expect(second).toBe(first);
        await first;
    });

    it('getSetting dégrade proprement vers la valeur par défaut (clé absente ou base injoignable)', async () => {
        const value = await db.getSetting('__cle_inexistante_p2_2__', 'fallback_p2_2');
        expect(value).toBe('fallback_p2_2');
    });

    it('logCopilotInteraction n\'échoue jamais silencieusement en mode dégradé', async () => {
        await expect(
            db.logCopilotInteraction('inst', 'contact', {}, [], 'gemini', 'gemini-2.5-flash')
        ).resolves.toBeUndefined();
    });
});
