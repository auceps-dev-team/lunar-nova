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

/**
 * Fermeture bornée. Mesuré le 27/11/2026 (Edge 158, poste chargé) : le PDF est
 * prêt en 3 s, mais close() rendait la main après 16 à 29 s — le processus
 * principal d'Edge et son StorageService écrivent le profil jetable sur le
 * disque ; Chrome, lui, se ferme en moins d'une seconde. Attendre cette
 * écriture n'apporte rien : au-delà du délai, la fermeture se poursuit en
 * arrière-plan (Playwright supprime ensuite le profil temporaire).
 */
const DELAI_FERMETURE_MS = 3000;

function borner(fermer, delaiMs) {
    return (...args) => {
        const fermeture = Promise.resolve().then(() => fermer(...args)).catch(() => {});
        let minuteur;
        const delai = new Promise((resolve) => { minuteur = setTimeout(resolve, delaiMs); });
        return Promise.race([fermeture, delai]).finally(() => clearTimeout(minuteur));
    };
}

function premiereLigne(message) {
    return String(message || '').split('\n').map((l) => l.trim()).find(Boolean) || 'échec sans message';
}

/**
 * @param {object} [options]  options de chromium.launch (headless, args…)
 * @param {object} [dependances]
 * @param {{ launch: Function }} [dependances.chromium]  injecté par les tests
 * @param {number} [dependances.delaiFermetureMs]  délai maximal de close()
 * @returns {Promise<import('playwright').Browser>} le navigateur, avec
 *   `wacopiloteNavigateur` : le nom du canal retenu ; close() rend la main au
 *   plus tard après le délai de fermeture
 */
async function lancerNavigateur(options = {}, { chromium, delaiFermetureMs = DELAI_FERMETURE_MS } = {}) {
    const lanceur = chromium || require('playwright').chromium;
    const echecs = [];
    for (const { nom, channel } of CANAUX) {
        try {
            const navigateur = await lanceur.launch(channel ? { ...options, channel } : { ...options });
            navigateur.wacopiloteNavigateur = nom;
            navigateur.close = borner(navigateur.close.bind(navigateur), delaiFermetureMs);
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

module.exports = { lancerNavigateur, CANAUX, DELAI_FERMETURE_MS };
