#!/usr/bin/env node
/**
 * P2-1 — Réconciliation i18n es/ar vers la parité avec fr (canonique).
 *
 * Stratégie :
 *  - fr.json est la source de vérité des CLÉS (canonique, complète comme en.json).
 *  - On SUPPRIME les clés présentes dans es/ar mais absentes de fr (clés
 *    orphelines, 47 chacun) — elles ne sont pas consommées par l'UI (qui clé
 *    sur fr) et fausent la parité.
 *  - On AJOUTE les clés manquantes (824 chacun) en utilisant la valeur de
 *    en.json comme base, car `fallbackLng` d'i18next est 'en' : un utilisateur
 *    es/ar voit déjà de l'anglais pour ces clés. C'est donc une base neutre et
 *    cohérente, à traduire ensuite humainement.
 *
 * Les fichiers résultants ont exactement le jeu de clés de fr (parité stricte).
 * Idempotent : relancer après traduction ne casse rien (les clés présentes sont
 * conservées).
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const localesDir = path.resolve(__dirname, '..', 'src', 'locales');

const read = (f) => JSON.parse(fs.readFileSync(path.join(localesDir, f), 'utf8'));
const fr = read('fr.json');
const en = read('en.json');
const frKeys = Object.keys(fr);

function reconcile(file) {
    const target = read(file);
    const targetKeys = Object.keys(target);
    const extras = targetKeys.filter((k) => !frKeys.includes(k));
    const missing = frKeys.filter((k) => !targetKeys.includes(k));

    const out = {};
    for (const k of frKeys) {
        // Conserve la traduction existante si présente, sinon base anglaise (repli i18n),
        // sinon repli français (ne devrait pas arriver : en est complet).
        out[k] = target[k] !== undefined ? target[k] : (en[k] !== undefined ? en[k] : fr[k]);
    }

    fs.writeFileSync(path.join(localesDir, file), JSON.stringify(out, null, 2) + '\n');
    return { extras: extras.length, missing: missing.length, total: frKeys.length };
}

let changed = false;
for (const f of ['es.json', 'ar.json']) {
    const r = reconcile(f);
    changed = true;
    console.log(`${f}: +${r.missing} clés ajoutées, -${r.extras} orphelines retirées, total ${r.total}`);
}
console.log(changed ? 'Parité es/ar restaurée (base anglaise pour les clés manquantes).' : 'Rien à faire.');
