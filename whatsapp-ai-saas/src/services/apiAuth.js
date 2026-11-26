import { API_BASE_URL } from '../config';

/**
 * Authentification des appels au backend local.
 *
 * Le backend n'écoute plus que sur 127.0.0.1 et exige un token sur chaque route.
 * Plutôt que de modifier la centaine de points d'appel `fetch` répartis dans les
 * pages (dont quelques-uns codent l'URL en dur), on instrumente `fetch` et
 * `EventSource` une seule fois au démarrage : toute requête à destination du
 * backend se voit ajouter le token, les autres passent inchangées.
 */

let apiToken = null;

/**
 * Attente du backend au démarrage.
 *
 * En production, la fenêtre se charge pendant que le backend démarre (fork
 * Electron, puis initialisation de la base). Mesuré le 26/11/2026 sur la
 * v1.49.0 installée : les premières requêtes échouaient en
 * ERR_CONNECTION_REFUSED, et un appel fait une seule fois au montage — la clé
 * de la carte de prospection, les réglages — restait vide pour toute la
 * session, sans erreur visible.
 *
 * Les requêtes vers le backend sont donc retenues jusqu'à sa première réponse
 * (n'importe quel statut HTTP prouve qu'il écoute), puis partent normalement.
 * Rien n'est rejoué : une requête retenue n'a jamais quitté le renderer. Au
 * bout de `timeoutMs`, on cesse d'attendre et les requêtes échouent comme
 * avant, plutôt que de rester bloquées.
 */
const BACKEND_WAIT_MS = 30000;
const RETRY_DELAYS_MS = [100, 200, 400, 800, 1000];

export function createBackendGate(fetchImpl, { url, headers = {}, timeoutMs = BACKEND_WAIT_MS, wait } = {}) {
    const pause = wait || ((ms) => new Promise((r) => setTimeout(r, ms)));
    const deadline = Date.now() + timeoutMs;
    return (async () => {
        for (let attempt = 0; ; attempt++) {
            try {
                await fetchImpl(url, { headers, cache: 'no-store' });
                return true;
            } catch {
                // Connexion refusée : le serveur n'écoute pas encore.
            }
            if (Date.now() >= deadline) return false;
            await pause(RETRY_DELAYS_MS[Math.min(attempt, RETRY_DELAYS_MS.length - 1)]);
        }
    })();
}

let backendGate = Promise.resolve(true);

function backendOrigins() {
    const origins = new Set(['http://localhost:3000', 'http://127.0.0.1:3000']);
    try {
        origins.add(new URL(API_BASE_URL, window.location.href).origin);
    } catch {
        // API_BASE_URL malformée : on garde les valeurs par défaut.
    }
    return origins;
}

const ORIGINS = backendOrigins();

function isBackendUrl(rawUrl) {
    if (!rawUrl) return false;
    try {
        return ORIGINS.has(new URL(rawUrl, window.location.href).origin);
    } catch {
        return false;
    }
}

/**
 * Récupère le token auprès du process principal Electron.
 *
 * Hors Electron (ex. `npm run dev` ouvert dans un navigateur classique), l'IPC
 * n'existe pas : on retombe sur VITE_API_TOKEN, que le développeur peut recopier
 * depuis le fichier `api-token` généré à la racine du projet.
 */
export async function initApiAuth() {
    if (window.electronAPI?.getApiToken) {
        try {
            apiToken = await window.electronAPI.getApiToken();
        } catch (err) {
            console.error('[ApiAuth] Failed to obtain API token from main process:', err);
        }
    }

    if (!apiToken) {
        apiToken = import.meta.env.VITE_API_TOKEN || null;
    }

    if (!apiToken) {
        console.error(
            '[ApiAuth] No API token available — backend calls will be rejected with 401. ' +
            'Run the app through Electron, or set VITE_API_TOKEN from the generated `api-token` file.'
        );
    }

    patchFetch();
    patchEventSource();
}

function patchFetch() {
    const originalFetch = window.fetch.bind(window);

    if (apiToken) {
        backendGate = createBackendGate(originalFetch, {
            url: `${API_BASE_URL}/api/health`,
            headers: { Authorization: `Bearer ${apiToken}` }
        });
    }

    const send = (input, init) => {
        // Un objet Request porte ses en-têtes en interne : on le reconstruit pour
        // pouvoir y ajouter l'Authorization sans muter l'original.
        if (input instanceof Request && !init) {
            const request = new Request(input);
            request.headers.set('Authorization', `Bearer ${apiToken}`);
            return originalFetch(request);
        }

        const headers = new Headers(init?.headers || (input instanceof Request ? input.headers : undefined));
        headers.set('Authorization', `Bearer ${apiToken}`);
        return originalFetch(input, { ...init, headers });
    };

    window.fetch = (input, init) => {
        const url = typeof input === 'string' ? input : input?.url;
        if (!apiToken || !isBackendUrl(url)) {
            return originalFetch(input, init);
        }
        // Retenue jusqu'à ce que le backend écoute (voir createBackendGate).
        return backendGate.then(() => send(input, init));
    };
}

function patchEventSource() {
    const OriginalEventSource = window.EventSource;
    if (!OriginalEventSource) return;

    // `EventSource` ne permet pas de poser d'en-tête : le token passe en query,
    // ce que le backend n'accepte que sur les routes SSE. L'URL ne quitte pas la
    // boucle locale.
    window.EventSource = function PatchedEventSource(url, config) {
        if (apiToken && isBackendUrl(url)) {
            const target = new URL(url, window.location.href);
            target.searchParams.set('token', apiToken);
            return new OriginalEventSource(target.toString(), config);
        }
        return new OriginalEventSource(url, config);
    };
    window.EventSource.prototype = OriginalEventSource.prototype;
    Object.assign(window.EventSource, OriginalEventSource);
}
