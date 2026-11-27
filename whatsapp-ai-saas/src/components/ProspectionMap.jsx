import React, { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { MapPin } from 'lucide-react';
import { mapsSearchUrl } from '../utils/mapsSearchUrl';

/** Délai après la dernière frappe avant de recharger la carte. */
export const MAP_DEBOUNCE_MS = 800;

/** Partition de la webview : ses cookies Google ne côtoient pas ceux des instances WhatsApp. */
export const MAP_PARTITION = 'persist:google-maps';

/**
 * Délai au-delà duquel une carte qui n'a rien chargé est signalée. Le
 * 27/11/2026, un utilisateur a vu un cadre blanc, sans message, que nos
 * sondes n'ont pas reproduit (quatre scénarios) : sans erreur de chargement,
 * rien ne le signalait. Une webview refusée par will-attach-webview
 * (electron/webviewPolicy.cjs) ne produit d'ailleurs aucun événement.
 */
export const MAP_LOAD_TIMEOUT_MS = 15000;

/**
 * Carte Google Maps de la prospection, affichée dans une webview — sans clé.
 *
 * Jusqu'au 27/11/2026, la carte passait par l'API Maps Embed et exigeait une
 * clé Google Cloud ; l'extraction des fiches, elle, n'en a jamais eu besoin
 * (navigateur sans interface sur google.com/maps). La clé n'était donc qu'un
 * secret de plus à garder, pour un aperçu.
 *
 * Isolement : partition dédiée, aucun preload, et pas d'`allowpopups` — une
 * fenêtre que Google Maps tenterait d'ouvrir est refusée. Les webviews ne sont
 * pas soumises à la CSP de l'interface (mesuré le 01/10/2026) : c'est ce
 * cloisonnement qui les protège.
 *
 * La carte suit la saisie après MAP_DEBOUNCE_MS : la recharger à chaque lettre
 * multipliait les requêtes vers Google depuis l'adresse IP que l'extracteur
 * utilise aussi.
 */
export default function ProspectionMap({ query, zone }) {
    const { t, i18n } = useTranslation();
    const cible = mapsSearchUrl(query, zone, i18n?.language);
    const [url, setUrl] = useState(cible);
    // null | 'echec' (erreur de chargement) | 'delai' (rien de chargé après MAP_LOAD_TIMEOUT_MS)
    const [echec, setEchec] = useState(null);
    const [essai, setEssai] = useState(0);
    const vue = useRef(null);
    const montee = Boolean(url);

    useEffect(() => {
        if (cible === url) return undefined;
        const minuteur = setTimeout(() => {
            setUrl(cible);
            setEchec(null);
        }, MAP_DEBOUNCE_MS);
        return () => clearTimeout(minuteur);
    }, [cible, url]);

    // Suivi du chargement de l'adresse en cours (et de chaque nouvel essai).
    useEffect(() => {
        const el = vue.current;
        if (!el) return undefined;
        let chargee = false;
        const garde = setTimeout(() => { if (!chargee) setEchec('delai'); }, MAP_LOAD_TIMEOUT_MS);
        const surEchec = (e) => {
            // -3 (ERR_ABORTED) : navigation remplacée par une plus récente, pas un échec.
            if (e.isMainFrame === false || e.errorCode === -3) return;
            setEchec('echec');
        };
        const surChargement = () => {
            chargee = true;
            clearTimeout(garde);
            setEchec(null);
        };
        el.addEventListener('did-fail-load', surEchec);
        el.addEventListener('did-finish-load', surChargement);
        return () => {
            clearTimeout(garde);
            el.removeEventListener('did-fail-load', surEchec);
            el.removeEventListener('did-finish-load', surChargement);
        };
    }, [montee, url, essai]);

    if (!url) return null;

    const reessayer = () => {
        setEchec(null);
        setEssai((n) => n + 1);
        if (vue.current && typeof vue.current.reload === 'function') vue.current.reload();
    };

    return (
        <div className="mt-6 rounded-xl overflow-hidden border border-gray-200 dark:border-zinc-700 shadow-sm h-[350px] relative">
            <webview ref={vue} partition={MAP_PARTITION} src={url} className="w-full h-full" />
            {echec && (
                <div role="alert" className="absolute inset-x-0 top-0 m-3 p-4 bg-orange-50 dark:bg-orange-900/90 border border-orange-200 dark:border-orange-800 rounded-lg flex items-center justify-between gap-4">
                    <p className="text-orange-800 dark:text-orange-100 text-sm">
                        <MapPin className="inline h-4 w-4 mr-1 mb-1" />
                        {t(echec === 'delai' ? 'prospectionMapTimeout' : 'prospectionMapLoadFailed')}
                    </p>
                    <button type="button" onClick={reessayer} className="shrink-0 text-sm font-medium text-orange-800 dark:text-orange-100 underline underline-offset-2">
                        {t('prospectionMapRetry')}
                    </button>
                </div>
            )}
        </div>
    );
}
