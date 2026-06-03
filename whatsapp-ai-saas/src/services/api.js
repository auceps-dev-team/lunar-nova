import { API_BASE_URL } from '../config';

/**
 * Wrapper centralisé pour les appels fetch vers l'API.
 * Gère automatiquement le baseUrl, les headers JSON, et le parsing de la réponse.
 * 
 * @param {string} endpoint L'endpoint à appeler (doit commencer par '/')
 * @param {RequestInit} options Options fetch standard (method, headers, body...)
 * @returns {Promise<any>}
 */
export async function apiFetch(endpoint, options = {}) {
    const url = `${API_BASE_URL}${endpoint}`;
    
    // Configurer les headers par défaut (JSON)
    const headers = {
        'Content-Type': 'application/json',
        ...options.headers,
    };

    // Si on envoie un FormData (par exemple pour l'upload de fichier), 
    // le navigateur définit lui-même le Content-Type avec le boundary.
    if (options.body instanceof FormData) {
        delete headers['Content-Type'];
    }

    const config = {
        ...options,
        headers,
    };

    try {
        const response = await fetch(url, config);
        
        // Certaines API (comme la suppression) peuvent ne pas retourner de contenu
        if (response.status === 204) {
            return { status: 'success' };
        }

        const data = await response.json();
        
        if (!response.ok) {
            throw new Error(data.error || data.message || `API Error: ${response.status}`);
        }

        return data;
    } catch (error) {
        console.error(`[API Fetch Error] ${endpoint}:`, error);
        throw error;
    }
}
