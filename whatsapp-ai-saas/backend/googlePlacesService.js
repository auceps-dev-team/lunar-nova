const fetch = require('node-fetch');

class GooglePlacesService {
    constructor() {
        this.apiKey = process.env.GOOGLE_MAPS_API_KEY || '';
    }

    async searchPlaces(query, ignoreLandlines = false) {
        if (!this.apiKey) {
            throw new Error("Clé API Google Maps (GOOGLE_MAPS_API_KEY) manquante dans l'environnement.");
        }

        try {
            // 1. Text Search to get place IDs
            const searchUrl = `https://maps.googleapis.com/maps/api/place/textsearch/json?query=${encodeURIComponent(query)}&key=${this.apiKey}`;
            const searchResponse = await fetch(searchUrl);
            const searchData = await searchResponse.json();

            if (searchData.status !== 'OK' && searchData.status !== 'ZERO_RESULTS') {
                throw new Error(`Google Places API Error: ${searchData.status} - ${searchData.error_message || ''}`);
            }

            const results = searchData.results || [];
            const leads = [];

            // 2. Fetch details for each place to get phone numbers (limit to 10-20 to avoid rate limits/costs during testing)
            // Let's process the first 20 results (one page)
            const placesToProcess = results.slice(0, 20);

            for (const place of placesToProcess) {
                if (!place.place_id) continue;

                const detailsUrl = `https://maps.googleapis.com/maps/api/place/details/json?place_id=${place.place_id}&fields=name,formatted_phone_number,international_phone_number,formatted_address,website&key=${this.apiKey}`;
                const detailsResponse = await fetch(detailsUrl);
                const detailsData = await detailsResponse.json();

                if (detailsData.status === 'OK' && detailsData.result) {
                    const result = detailsData.result;
                    let phone = result.international_phone_number || result.formatted_phone_number;

                    if (phone) {
                        // Nettoyage basique (garder que les chiffres et le +)
                        phone = phone.replace(/[^\d+]/g, '');

                        // Filtrage (basique) des numéros fixes si demandé
                        // En France par exemple, les mobiles commencent par +336 ou +337.
                        // En Afrique, ça dépend du pays.
                        let isMobile = true; // Par défaut, on assume que c'est bon si on ne peut pas vérifier
                        
                        if (ignoreLandlines) {
                            // Implémentation basique : on pourrait vérifier la longueur ou le préfixe
                            // Ceci est une vérification simplifiée.
                            if (phone.startsWith('+33')) {
                                // France: Mobile = +33 6 ou +33 7
                                if (!phone.match(/^\+33[67]/)) isMobile = false;
                            } else if (phone.startsWith('+225')) {
                                // Côte d'Ivoire: Mobile = +225 01, 05, 07
                                if (!phone.match(/^\+225[01|05|07]/)) isMobile = false;
                            }
                            // Ajouter d'autres règles selon le marché cible.
                        }

                        if (!ignoreLandlines || isMobile) {
                            leads.push({
                                name: result.name || place.name,
                                phone: phone,
                                address: result.formatted_address || place.formatted_address,
                                website: result.website || ''
                            });
                        }
                    }
                }
            }

            return leads;
        } catch (error) {
            console.error('[GooglePlacesService] Error:', error);
            throw error;
        }
    }
}

module.exports = new GooglePlacesService();
