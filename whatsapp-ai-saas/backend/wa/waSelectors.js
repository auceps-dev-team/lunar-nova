/**
 * Registre des sélecteurs WhatsApp Web, et leur mise à jour signée.
 *
 * POURQUOI — WhatsApp Web renomme ses classes et réorganise son DOM sans
 * prévenir. Jusqu'au 26/11/2026, chaque sélecteur était écrit en dur dans le
 * code (orderListener, notes vocales, vérification de numéro, contexte du
 * copilote) : une refonte côté WhatsApp exigeait une nouvelle version de
 * l'application, téléchargée et installée par chaque client.
 *
 * CE QUI PEUT ÊTRE MIS À JOUR — des DONNÉES seulement : pour chaque clé
 * connue, une liste de sélecteurs CSS, chaînes passées en argument à
 * querySelector. Jamais de code : aucun champ du fichier n'est évalué,
 * interpolé dans un script ni utilisé comme chemin.
 *
 * CONFIANCE — le fichier est publié sur la release fixe `wa-selectors` du
 * dépôt wacopilote-releases, avec sa signature Ed25519 (`.sig`, base64, sur
 * les octets exacts du fichier). Il n'est appliqué que si la signature est
 * valide pour une clé de TRUSTED_KEYS. Liste vide = mises à jour distantes
 * DÉSACTIVÉES, et l'état le dit (jamais un « à jour » silencieux).
 *
 * REPLIS — un fichier distant n'enlève rien : pour chaque clé, ses
 * candidats passent AVANT ceux livrés avec l'application, qui restent
 * derrière. Un sélecteur syntaxiquement invalide est écarté dans la page
 * (voir `inPageSelectors`), pas seulement ici.
 *
 * RETOUR ARRIÈRE — la version précédente est conservée. `rollback()` y
 * revient (ou aux sélecteurs livrés) et marque la version fautive comme
 * rejetée : elle ne sera pas réappliquée. `reportHealth()` le fait seul quand
 * la page montre que le fichier distant casse ce que les sélecteurs livrés
 * trouvaient.
 */
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const SCHEMA = 1;
const FILE_NAME = 'wa-selectors.json';
const RELEASE_BASE = 'https://github.com/auceps-dev-team/wacopilote-releases/releases/download/wa-selectors';
const MAX_FILE_BYTES = 64 * 1024;
const MAX_SIG_BYTES = 1024;
const MAX_CANDIDATES = 8;
const MAX_SELECTOR_LENGTH = 300;
const FETCH_TIMEOUT_MS = 15000;

/**
 * Clés publiques Ed25519 autorisées à signer (SPKI DER en base64, telles que
 * les imprime `scripts/wa-selectors/keygen.cjs`). VIDE tant que la garde de
 * la clé privée n'est pas décidée : rien de distant n'est appliqué.
 */
const TRUSTED_KEYS = [];

/**
 * Clés connues. `mode` décide de l'usage dans la page, et n'est PAS réglable
 * à distance :
 *   - 'first' : candidats essayés dans l'ordre, le premier qui trouve gagne ;
 *   - 'any'   : candidats réunis en une liste de sélecteurs (union, ordre du
 *               document) — c'était déjà l'écriture du code pour ces clés.
 * `critical` + `max` : bornes du contrôle de santé (voir reportHealth).
 * Les valeurs par défaut sont celles du code au 26/11/2026, dans le même ordre.
 */
const KEYS = {
    appReady: { mode: 'any', critical: true, max: 3, defaults: ['#pane-side'] },
    chatListPane: { mode: 'any', defaults: ['#pane-side'] },
    chatListItem: { mode: 'any', critical: true, max: 200, defaults: ['[data-testid="cell-frame-container"]'] },
    chatListName: { mode: 'any', defaults: ['#pane-side span[title][dir="auto"]'] },
    chatListRow: { mode: 'any', defaults: ['div[role="row"]', 'div[role="listitem"]', 'div[style*="transform"]'] },
    chatItemTitle: { mode: 'first', defaults: ['[data-testid="cell-frame-title"] span[title][dir="auto"]', 'span[title][dir="auto"]'] },
    chatItemPreview: { mode: 'first', defaults: ['[data-testid="cell-frame-secondary"]'] },
    previewText: { mode: 'any', defaults: ['span[dir="ltr"]'] },
    messageLegacy: { mode: 'any', defaults: ['.copyable-text[data-pre-plain-text]'] },
    messageRow: { mode: 'any', defaults: ['div[role="row"]'] },
    prePlainText: { mode: 'any', defaults: ['[data-pre-plain-text]'] },
    messageText: { mode: 'any', defaults: ['span.selectable-text', 'span.copyable-text', 'span[dir="ltr"]'] },
    voiceStatus: { mode: 'any', defaults: ['[data-testid="ptt-status"]'] },
    messageAuthor: { mode: 'first', defaults: ['[data-testid="author"]'] },
    conversationTitle: { mode: 'first', defaults: ['#main header span[title]'] },
    conversationOpen: { mode: 'any', defaults: ['#main header', '#main footer', '[data-testid="conversation-panel-wrapper"]', 'div[title="Type a message"]', 'div[title="Tapez un message"]'] },
    errorModalBody: { mode: 'first', defaults: ['[data-animate-modal-body="true"]'] },
    copilotHeaderTitle: { mode: 'first', defaults: ['[data-testid="conversation-info-header-chat-title"]', '[data-testid="conversation-header"] span[dir="auto"]', 'header span[dir="auto"]', '[data-testid="conversation-info-header"] span'] },
    copilotMainPanel: { mode: 'first', defaults: ['#main'] },
    copilotLegacyMessage: { mode: 'any', defaults: ['div.message-in', 'div.message-out'] },
    copilotMessageText: { mode: 'any', defaults: ['.selectable-text', '.copyable-text', 'span[dir="ltr"]'] },
    copilotMessageTime: { mode: 'any', defaults: ['[data-icon="msg-time"]', '.copyable-text[data-pre-plain-text]', '[data-pre-plain-text]'] },
};

// Défense en profondeur : les sélecteurs voyagent en arguments, jamais
// interpolés dans du code — mais rien de ce qui ressemble à du code ou à du
// balisage n'a de raison d'y figurer.
// eslint-disable-next-line no-control-regex -- les caractères de contrôle sont justement ce qu'on refuse
const CARACTERES_REFUSES = /[\u0000-\u001f\u007f{};<`\\]/;

/** Fusion : candidats distants d'abord, livrés ensuite, sans doublon. */
function mergeSelectors(distants) {
    const fusion = {};
    for (const [cle, def] of Object.entries(KEYS)) {
        const ajout = (distants && Array.isArray(distants[cle])) ? distants[cle] : [];
        fusion[cle] = [...new Set([...ajout, ...def.defaults])];
    }
    return fusion;
}

function defaultSelectors() {
    return mergeSelectors(null);
}

function compareVersions(a, b) {
    const pa = String(a).split('.').map((n) => parseInt(n, 10) || 0);
    const pb = String(b).split('.').map((n) => parseInt(n, 10) || 0);
    for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
        const d = (pa[i] || 0) - (pb[i] || 0);
        if (d) return Math.sign(d);
    }
    return 0;
}

/**
 * Valide un fichier déjà analysé. Les clés inconnues (fichier publié pour une
 * version plus récente) sont ignorées, et nommées dans `ignorees`.
 * @returns {{ ok: boolean, erreurs: string[], ignorees: string[], selectors?: object, version?: number }}
 */
function validateSelectorFile(fichier, { appVersion } = {}) {
    const erreurs = [];
    const ignorees = [];
    if (!fichier || typeof fichier !== 'object' || Array.isArray(fichier)) return { ok: false, erreurs: ['fichier : objet attendu'], ignorees };
    if (fichier.schema !== SCHEMA) erreurs.push(`schema : ${SCHEMA} attendu, reçu ${JSON.stringify(fichier.schema)}`);
    if (!Number.isInteger(fichier.version) || fichier.version < 1) erreurs.push('version : entier ≥ 1 attendu');
    if (fichier.minApp !== undefined) {
        if (typeof fichier.minApp !== 'string' || !/^\d+\.\d+\.\d+$/.test(fichier.minApp)) erreurs.push('minApp : version x.y.z attendue');
        else if (appVersion && compareVersions(appVersion, fichier.minApp) < 0) erreurs.push(`minApp : exige ${fichier.minApp}, application en ${appVersion}`);
    }
    const sel = fichier.selectors;
    if (!sel || typeof sel !== 'object' || Array.isArray(sel)) {
        erreurs.push('selectors : objet attendu');
        return { ok: false, erreurs, ignorees };
    }
    const retenus = {};
    for (const [cle, liste] of Object.entries(sel)) {
        if (!Object.prototype.hasOwnProperty.call(KEYS, cle)) { ignorees.push(cle); continue; }
        if (!Array.isArray(liste) || liste.length === 0 || liste.length > MAX_CANDIDATES) {
            erreurs.push(`${cle} : liste de 1 à ${MAX_CANDIDATES} sélecteurs attendue`);
            continue;
        }
        for (const s of liste) {
            if (typeof s !== 'string' || !s.trim() || s.length > MAX_SELECTOR_LENGTH) erreurs.push(`${cle} : sélecteur vide, non textuel ou de plus de ${MAX_SELECTOR_LENGTH} caractères`);
            else if (CARACTERES_REFUSES.test(s)) erreurs.push(`${cle} : caractère refusé dans « ${s.slice(0, 60)} »`);
        }
        retenus[cle] = liste;
    }
    if (erreurs.length) return { ok: false, erreurs, ignorees };
    return { ok: true, erreurs, ignorees, selectors: retenus, version: fichier.version };
}

/** Vrai si `signatureB64` signe exactement `octets` pour l'une des clés. */
function verifySignature(octets, signatureB64, cles = TRUSTED_KEYS) {
    if (!cles.length || typeof signatureB64 !== 'string') return false;
    let signature;
    try { signature = Buffer.from(signatureB64.trim(), 'base64'); } catch { return false; }
    if (signature.length !== 64) return false;
    return cles.some((cle) => {
        try {
            const publique = crypto.createPublicKey({ key: Buffer.from(cle, 'base64'), format: 'der', type: 'spki' });
            return crypto.verify(null, octets, publique, signature);
        } catch {
            return false;
        }
    });
}

/** Vérifie puis valide des octets bruts. Rend la même forme que validateSelectorFile. */
function verifyAndParse(octets, signatureB64, { cles = TRUSTED_KEYS, appVersion } = {}) {
    if (!cles.length) return { ok: false, erreurs: ['aucune clé de confiance : mises à jour distantes désactivées'], ignorees: [] };
    if (octets.length > MAX_FILE_BYTES) return { ok: false, erreurs: [`fichier de plus de ${MAX_FILE_BYTES} octets`], ignorees: [] };
    if (!verifySignature(octets, signatureB64, cles)) return { ok: false, erreurs: ['signature invalide'], ignorees: [] };
    let fichier;
    try { fichier = JSON.parse(octets.toString('utf8')); } catch { return { ok: false, erreurs: ['JSON illisible'], ignorees: [] }; }
    return validateSelectorFile(fichier, { appVersion });
}

function defaultDataDir() {
    return process.env.USER_DATA_PATH || path.join(__dirname, '..', '..');
}

function appVersionDefault() {
    try { return require('../../package.json').version; } catch { return undefined; }
}

/**
 * Registre : un état en mémoire, des fichiers dans le dossier de données.
 *   wa-selectors.json(.sig)           version appliquée
 *   wa-selectors.previous.json(.sig)  version d'avant, pour le retour arrière
 *   wa-selectors.rejected.json        versions écartées par retour arrière
 */
function createSelectorRegistry({ dataDir = defaultDataDir(), cles = TRUSTED_KEYS, fetchImpl = globalThis.fetch, appVersion = appVersionDefault(), now = () => new Date() } = {}) {
    const fichier = (nom) => path.join(dataDir, nom);
    const actuel = { json: fichier(FILE_NAME), sig: fichier(`${FILE_NAME}.sig`) };
    const precedent = { json: fichier('wa-selectors.previous.json'), sig: fichier('wa-selectors.previous.json.sig') };
    const rejetees = fichier('wa-selectors.rejected.json');

    const etat = {
        source: 'bundled',
        version: 0,
        selectors: defaultSelectors(),
        remoteEnabled: cles.length > 0,
        lastCheck: null,
        lastResult: cles.length ? null : 'désactivé : aucune clé de confiance',
        ignoredKeys: [],
    };

    const lireRejetees = () => {
        try { return new Set(JSON.parse(fs.readFileSync(rejetees, 'utf8'))); } catch { return new Set(); }
    };
    const ecrireAtomique = (cible, contenu) => {
        const tmp = `${cible}.${process.pid}.tmp`;
        fs.writeFileSync(tmp, contenu);
        fs.renameSync(tmp, cible);
    };
    const appliquer = (resultat, source) => {
        etat.source = source;
        etat.version = resultat.version;
        etat.selectors = mergeSelectors(resultat.selectors);
        etat.ignoredKeys = resultat.ignorees;
    };
    const revenirAuLivre = () => {
        etat.source = 'bundled';
        etat.version = 0;
        etat.selectors = defaultSelectors();
        etat.ignoredKeys = [];
    };
    const lirePaire = (paire) => {
        try { return { octets: fs.readFileSync(paire.json), sig: fs.readFileSync(paire.sig, 'utf8') }; } catch { return null; }
    };

    /** Au démarrage : reprend la version enregistrée, re-vérifiée (le disque n'est pas une source de confiance). */
    function loadCached() {
        const paire = lirePaire(actuel);
        if (!paire) return { applied: false, raison: 'aucune version enregistrée' };
        const r = verifyAndParse(paire.octets, paire.sig, { cles, appVersion });
        if (!r.ok) {
            revenirAuLivre();
            etat.lastResult = `version enregistrée écartée : ${r.erreurs.join(' ; ')}`;
            return { applied: false, raison: etat.lastResult };
        }
        if (lireRejetees().has(r.version)) {
            revenirAuLivre();
            return { applied: false, raison: `version ${r.version} rejetée par un retour arrière` };
        }
        appliquer(r, 'remote');
        return { applied: true, version: r.version };
    }

    async function telecharger(url, limite) {
        const ctrl = new AbortController();
        const minuteur = setTimeout(() => ctrl.abort(), FETCH_TIMEOUT_MS);
        try {
            const rep = await fetchImpl(url, { signal: ctrl.signal, headers: { 'User-Agent': 'WaCopilote-selectors' } });
            if (!rep.ok) throw new Error(`HTTP ${rep.status} sur ${url.split('/').pop()}`);
            const octets = Buffer.from(await rep.arrayBuffer());
            if (octets.length > limite) throw new Error(`${url.split('/').pop()} : plus de ${limite} octets`);
            return octets;
        } finally {
            clearTimeout(minuteur);
        }
    }

    /** Télécharge, vérifie, et applique si la version est plus récente. */
    async function checkForUpdate() {
        etat.lastCheck = now().toISOString();
        if (!cles.length) {
            etat.lastResult = 'désactivé : aucune clé de confiance';
            return { updated: false, raison: etat.lastResult };
        }
        let octets;
        let sig;
        try {
            octets = await telecharger(`${RELEASE_BASE}/${FILE_NAME}`, MAX_FILE_BYTES);
            sig = (await telecharger(`${RELEASE_BASE}/${FILE_NAME}.sig`, MAX_SIG_BYTES)).toString('utf8');
        } catch (e) {
            etat.lastResult = `téléchargement impossible : ${e.name === 'AbortError' ? 'délai dépassé' : e.message}`;
            return { updated: false, raison: etat.lastResult };
        }
        const r = verifyAndParse(octets, sig, { cles, appVersion });
        if (!r.ok) {
            etat.lastResult = `fichier refusé : ${r.erreurs.join(' ; ')}`;
            return { updated: false, raison: etat.lastResult };
        }
        if (lireRejetees().has(r.version)) {
            etat.lastResult = `version ${r.version} rejetée par un retour arrière`;
            return { updated: false, raison: etat.lastResult };
        }
        if (r.version <= etat.version) {
            etat.lastResult = r.version === etat.version ? `à jour (version ${r.version})` : `version distante ${r.version} plus ancienne que ${etat.version} : ignorée`;
            return { updated: false, raison: etat.lastResult };
        }
        fs.mkdirSync(dataDir, { recursive: true });
        const ancienne = lirePaire(actuel);
        if (ancienne) {
            ecrireAtomique(precedent.json, ancienne.octets);
            ecrireAtomique(precedent.sig, ancienne.sig);
        }
        ecrireAtomique(actuel.json, octets);
        ecrireAtomique(actuel.sig, sig);
        appliquer(r, 'remote');
        etat.lastResult = `mis à jour en version ${r.version}${r.ignorees.length ? ` (clés inconnues ignorées : ${r.ignorees.join(', ')})` : ''}`;
        return { updated: true, version: r.version, ignorees: r.ignorees };
    }

    /**
     * Retour arrière : écarte la version distante appliquée (marquée rejetée)
     * et revient à la précédente si elle se vérifie, sinon aux sélecteurs livrés.
     */
    function rollback(raison = 'manuel') {
        if (etat.source !== 'remote') return { rolledBack: false, raison: 'déjà sur les sélecteurs livrés' };
        const fautive = etat.version;
        const liste = lireRejetees();
        liste.add(fautive);
        fs.mkdirSync(dataDir, { recursive: true });
        ecrireAtomique(rejetees, JSON.stringify([...liste].sort((a, b) => a - b)));

        const paire = lirePaire(precedent);
        const r = paire ? verifyAndParse(paire.octets, paire.sig, { cles, appVersion }) : null;
        if (r && r.ok && !liste.has(r.version)) {
            ecrireAtomique(actuel.json, paire.octets);
            ecrireAtomique(actuel.sig, paire.sig);
            appliquer(r, 'remote');
        } else {
            for (const f of [actuel.json, actuel.sig]) { try { fs.unlinkSync(f); } catch { /* absent */ } }
            revenirAuLivre();
        }
        etat.lastResult = `retour arrière (${raison}) : version ${fautive} écartée, ${etat.source === 'remote' ? `version ${etat.version}` : 'sélecteurs livrés'} en service`;
        return { rolledBack: true, rejected: fautive, source: etat.source, version: etat.version };
    }

    /**
     * Contrôle de santé relevé dans une page WhatsApp chargée (voir
     * inPageHealth). Pour chaque clé critique : nombre d'éléments trouvés
     * avec la fusion et avec les seuls sélecteurs livrés. Un fichier distant
     * n'enlève aucun candidat, il ne peut donc casser qu'en trouvant TROP
     * (sélecteur trop large) — ou, en mode 'first', le mauvais élément.
     * Règle : fusion hors bornes alors que les livrés sont dans les bornes →
     * le fichier distant est fautif, retour arrière automatique.
     */
    function reportHealth(sante) {
        if (etat.source !== 'remote' || !sante || typeof sante !== 'object') return { rolledBack: false };
        const dansBornes = (n, max) => Number.isInteger(n) && n >= 1 && n <= max;
        const fautives = Object.entries(KEYS)
            .filter(([, def]) => def.critical)
            .filter(([cle, def]) => sante[cle] && !dansBornes(sante[cle].merged, def.max) && dansBornes(sante[cle].defaults, def.max))
            .map(([cle]) => cle);
        if (!fautives.length) return { rolledBack: false };
        return { ...rollback(`santé : ${fautives.join(', ')} hors bornes avec la version ${etat.version}`), keys: fautives };
    }

    function status() {
        return {
            source: etat.source,
            version: etat.version,
            remoteEnabled: etat.remoteEnabled,
            lastCheck: etat.lastCheck,
            lastResult: etat.lastResult,
            ignoredKeys: etat.ignoredKeys,
        };
    }

    /** Ce que reçoit une page : listes fusionnées, livrées, et modes. */
    function forPage() {
        const modes = {};
        const livres = {};
        for (const [cle, def] of Object.entries(KEYS)) { modes[cle] = def.mode; livres[cle] = def.defaults; }
        return { version: etat.version, source: etat.source, lists: etat.selectors, defaults: livres, modes };
    }

    return { loadCached, checkForUpdate, rollback, reportHealth, status, forPage, get selectors() { return etat.selectors; } };
}

/**
 * Exécuté DANS la page (sérialisé par puppeteer ou executeJavaScript) :
 * écarte les candidats que le navigateur refuse, puis rend pour chaque clé
 * soit une liste de sélecteurs ('any'), soit les candidats ordonnés ('first').
 * Doit rester autonome : aucune référence extérieure.
 */
/* eslint-disable no-undef */
function inPageSelectors(paquet) {
    const valide = (s) => { try { document.createDocumentFragment().querySelector(s); return true; } catch { return false; } };
    const S = {};
    const F = {};
    for (const cle of Object.keys(paquet.modes)) {
        let liste = (paquet.lists[cle] || []).filter(valide);
        if (!liste.length) liste = (paquet.defaults[cle] || []).filter(valide);
        F[cle] = liste;
        S[cle] = liste.join(', ');
    }
    const first = (racine, cle) => {
        for (const s of F[cle] || []) {
            const el = racine.querySelector(s);
            if (el) return el;
        }
        return null;
    };
    return { S, F, first };
}

/** Exécuté DANS la page : comptages du contrôle de santé (voir reportHealth). */
function inPageHealth(paquet, critiques) {
    const valide = (s) => { try { document.createDocumentFragment().querySelector(s); return true; } catch { return false; } };
    const compter = (liste) => {
        const ok = (liste || []).filter(valide);
        return ok.length ? document.querySelectorAll(ok.join(', ')).length : 0;
    };
    const sante = {};
    for (const cle of critiques) sante[cle] = { merged: compter(paquet.lists[cle]), defaults: compter(paquet.defaults[cle]) };
    return sante;
}
/* eslint-enable no-undef */

const CRITICAL_KEYS = Object.entries(KEYS).filter(([, d]) => d.critical).map(([k]) => k);

let registreParDefaut = null;
/** Registre partagé du processus backend (créé au premier appel). */
function getSelectorRegistry() {
    if (!registreParDefaut) {
        registreParDefaut = createSelectorRegistry();
        registreParDefaut.loadCached();
    }
    return registreParDefaut;
}

const PREMIERE_VERIFICATION_MS = 30 * 1000;
const INTERVALLE_VERIFICATION_MS = 6 * 60 * 60 * 1000;

/**
 * Vérifications périodiques de la release (30 s après le démarrage, puis
 * toutes les 6 h). Rien n'est planifié sans clé de confiance, ni en test
 * (NODE_ENV=test) : une suite ne touche jamais le réseau.
 * @returns {boolean} vrai si des vérifications sont planifiées.
 */
function scheduleSelectorUpdates({ registre = getSelectorRegistry(), journal = console.error } = {}) {
    if (process.env.NODE_ENV === 'test') return false;
    const etat = registre.status();
    if (!etat.remoteEnabled) {
        journal(`[Sélecteurs WhatsApp] ${etat.lastResult} — sélecteurs livrés en service.`);
        return false;
    }
    const verifier = async () => {
        try {
            const r = await registre.checkForUpdate();
            journal(`[Sélecteurs WhatsApp] ${r.updated ? `mis à jour en version ${r.version}` : r.raison}`);
        } catch (e) {
            journal(`[Sélecteurs WhatsApp] vérification en échec : ${e.message}`);
        }
    };
    setTimeout(verifier, PREMIERE_VERIFICATION_MS).unref();
    setInterval(verifier, INTERVALLE_VERIFICATION_MS).unref();
    return true;
}

module.exports = {
    SCHEMA,
    FILE_NAME,
    RELEASE_BASE,
    KEYS,
    CRITICAL_KEYS,
    TRUSTED_KEYS,
    mergeSelectors,
    defaultSelectors,
    validateSelectorFile,
    verifySignature,
    verifyAndParse,
    createSelectorRegistry,
    getSelectorRegistry,
    scheduleSelectorUpdates,
    inPageSelectors,
    inPageHealth,
    compareVersions,
};
