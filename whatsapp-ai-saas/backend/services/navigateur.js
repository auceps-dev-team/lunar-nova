/**
 * Navigateur des automatisations du backend (factures PDF, extracteurs de la
 * prospection) : Microsoft Edge d'abord, puis Google Chrome, puis le Chromium
 * téléchargé par Playwright.
 *
 * Pourquoi Edge (27/11/2026) : le projet n'a jamais installé les navigateurs de
 * Playwright. Chaque version de Playwright attend sa propre révision de
 * Chromium dans %LOCALAPPDATA%\ms-playwright (mesuré : la 1.58 attend 1208,
 * la 1.65.1 attend 1255) ; sur un poste où elle manque, factures et extracteurs
 * échouaient (« Executable doesn't exist »). Edge, lui, fait partie de Windows
 * 10 et 11 : Playwright le pilote par son canal `msedge`, sans téléchargement,
 * et il se met à jour avec le système.
 *
 * Chaque échec de canal est gardé : s'ils échouent tous, l'erreur les nomme.
 */
const CANAUX = [
    { nom: 'Microsoft Edge', channel: 'msedge' },
    { nom: 'Google Chrome', channel: 'chrome' },
    { nom: 'Chromium de Playwright', channel: null },
];

function premiereLigne(message) {
    return String(message || '').split('\n').map((l) => l.trim()).find(Boolean) || 'échec sans message';
}

/**
 * @param {object} [options]  options de chromium.launch (headless, args…)
 * @param {object} [dependances]
 * @param {{ launch: Function }} [dependances.chromium]  injecté par les tests
 * @returns {Promise<import('playwright').Browser>} le navigateur, avec
 *   `wacopiloteNavigateur` : le nom du canal retenu
 */
async function lancerNavigateur(options = {}, { chromium } = {}) {
    const lanceur = chromium || require('playwright').chromium;
    const echecs = [];
    for (const { nom, channel } of CANAUX) {
        try {
            const navigateur = await lanceur.launch(channel ? { ...options, channel } : { ...options });
            navigateur.wacopiloteNavigateur = nom;
            return navigateur;
        } catch (err) {
            echecs.push(`${nom} : ${premiereLigne(err.message)}`);
        }
    }
    const erreur = new Error(`Aucun navigateur disponible pour l'automatisation (Edge, Chrome ou Chromium de Playwright). ${echecs.join(' | ')}`);
    erreur.statusCode = 503;
    erreur.echecs = echecs;
    throw erreur;
}

module.exports = { lancerNavigateur, CANAUX };
