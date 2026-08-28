import React, { useState, useEffect } from 'react';
import useAppStore from '../store';
import { useTranslation } from 'react-i18next';

const GITHUB_REPO = 'https://github.com/auceps-dev-team/lunar-nova';

/**
 * Ouvre un lien dans le navigateur du système.
 *
 * Un simple target="_blank" ne suffit pas dans Electron : sans
 * setWindowOpenHandler, la fenêtre est soit bloquée, soit ouverte dans une
 * fenêtre applicative sans barre d'adresse. Le passage par le processus
 * principal garantit l'ouverture dans le navigateur par défaut.
 */
const openExternal = (url) => (e) => {
    if (window.electronAPI?.openExternalUrl) {
        e.preventDefault();
        window.electronAPI.openExternalUrl(url);
    }
};

const Support = () => {
    const { t } = useTranslation();
    const userProfile = useAppStore(state => state.userProfile) || {};
    const [appVersion, setAppVersion] = useState('');
    const [ticketSent, setTicketSent] = useState(false);

    useEffect(() => {
        // La version vient du processus principal : c'est celle réellement
        // installée, pas une constante qui se désynchronise à chaque release.
        window.updaterAPI?.getVersion?.()
            .then(v => setAppVersion(v))
            .catch(() => { });
    }, []);
    const [form, setForm] = useState({
        email: userProfile.email || '',
        subject: '',
        category: 'bug',
        message: ''
    });

    const categories = [
        { id: 'bug', label: t('bugReport') },
        { id: 'feature', label: t('featureReq') },
        { id: 'billing', label: t('billing') },
        { id: 'other', label: t('other') }
    ];

    const changelog = [
        {
            version: 'v1.45.0',
            date: '2026-08-28',
            changes: [
                'Architecture CLI & Serveur MCP (Model Context Protocol) complet : pilotage de WaCopilote depuis le terminal (wacopilote run, list-agents, pipeline run, status) et serveur MCP stdio prêt pour Claude Code, Cursor et Antigravity',
                'Refactorisation modulaire du Backend en architecture par Services (pipelineService, prospectionService, documentsService, invoiceService, wordpressService, waInstancesService)',
                'Intégration Google Maps Embed API : prévisualisation en direct de la carte dans le Générateur de Leads avec chargement sécurisé via backend/.env',
                'Passerelle Outbound CLI & délégation locale : exécution sécurisée et sandboxing des outils d\'agents machine (gemini, claude, ollama, aider, python) avec liste blanche et gouvernance HITL',
                'Nouvel onglet de réglages dédié « Bridge CLI & Protocoles Agentiques » avec console de test interactive et statut en direct'
            ]
        },
        { version: 'v1.43.1', date: '2026-08-27', changes: ['Prospection B2B fiabilisée : correction d\'un crash d\'initialisation lié au store global Zustand et persistance des requêtes/leads entre onglets', 'Scraping Google Maps : nettoyage automatique des icônes de géolocalisation parasites dans les adresses', 'Streaming SSE : détection et remontée claire des erreurs HTTP de recherche'] },
        { version: 'v1.43.0', date: '2026-08-26', changes: ['Nouveau : bouton « Supprimer la clé » (🗑️) dans les Réglages pour effacer proprement une clé API — la suppression est limitée aux clés secrètes, les autres réglages restent protégés', 'Prospection : notifications et libellés traduits dans la langue de l\'interface, et correction d\'une inversion qui affichait « success » à la place du vrai message'] },
        { version: 'v1.42.14', date: '2026-08-26', changes: ['Infrastructure : intégration continue GitHub Actions (lint, tests automatisés, build)', 'Centralisation des constantes OpenRouter et mise à jour du modèle Gemini par défaut (gemini-2.5-flash)', 'Nettoyage des variables d\'environnement et des canaux IPC obsolètes'] },
        { version: 'v1.42.13', date: '2026-08-26', changes: ['Sécurité : les modifications WordPress ne passent plus que par la validation humaine — suppression des écritures directes résiduelles, tout transite désormais par la file d\'approbation'] },
        { version: 'v1.42.12', date: '2026-08-21', changes: ['Système de mise à jour réparé : il ne proposait jamais de mise à jour à cause d\'une release obsolète, et couvre maintenant macOS et Linux (Windows en installation silencieuse, les autres plateformes en ouverture guidée)', 'Téléchargement des mises à jour vérifié (intégrité des octets) et messages d\'erreur lisibles (limite de requêtes, dépôt introuvable, réseau)'] },
        { version: 'v1.42.11', date: '2026-08-21', changes: ['Audit complet traité : durcissement de la sécurité (CORS, sessions OAuth, validation des numéros), découpage des plus grosses pages et 114 tests unitaires', 'Correction du masquage du bandeau de quota : le réglage « ne plus afficher » est désormais mémorisé'] },
        { version: 'v1.42.0', date: '2026-08-14', changes: ['Mise à jour majeure du moteur Electron (v40) et de React 19', 'Nouvelle architecture du service Gemini unifiée', 'Support du mode hors-ligne partiel pour le Copilote'] },
        { version: 'v1.41.0', date: '2026-08-01', changes: ['Nouveau : gestionnaire de mises à jour intégré avec notes de version (cet écran)', 'Amélioration du chiffrement au repos : migration automatique des bases existantes vers AES-256-GCM v2', 'Correction du rechargement des modèles NVIDIA après changement de clé API'] },
        { version: 'v1.40.0', date: '2026-07-30', changes: ['Nouveau : choisissez les onglets affichés dans le menu latéral depuis les Réglages, pour une interface réduite à ce dont vous vous servez', 'Nouveau : assistant de première configuration en quatre étapes — langue, espace de travail, première instance WhatsApp et connexion à une IA. Chaque étape peut être passée.', 'Correction : la barre de progression restait bloquée à 0 % pendant le téléchargement d\'une mise à jour', 'Correction : l\'ordre personnalisé du menu latéral n\'était pas restauré au démarrage'] },
        { version: 'v1.39.3', date: '2026-07-28', changes: ['Le service interne redémarre désormais tout seul s\'il s\'arrête, au lieu de laisser l\'application inerte sans explication', 'Correction d\'une fuite mémoire qui dégradait les sessions WhatsApp laissées ouvertes plusieurs jours ; la surveillance des commandes s\'arrête maintenant réellement quand vous la désactivez', 'Démarrage fiabilisé : une requête lancée dans la première seconde pouvait partir sans votre clé d\'API et échouer sans raison apparente', 'Analyse des réponses des modèles d\'IA fiabilisée : certaines réponses étaient rejetées à tort quand le modèle ajoutait une phrase autour du résultat', 'Limitation de débit étendue à l\'ensemble du service, avec un plafond spécifique sur le scraping et l\'envoi au catalogue'] },
        { version: 'v1.38.0', date: '2026-07-28', changes: ['Le graphique d\'activité du tableau de bord affichait des valeurs générées aléatoirement tant qu\'aucune activité n\'était enregistrée ; il affiche désormais la réalité', 'L\'écran Rédacteur IA se charge bien plus vite : près d\'1 Mo de bibliothèque n\'est plus téléchargé qu\'au moment de l\'export PDF', 'Correction de la mise à jour des catégories GoAfrica, qui ne fonctionnait pas dans l\'application installée', 'Première série de tests automatisés (43 cas) sur le chiffrement, l\'analyse des réponses IA et le formatage des numéros'] },
        { version: 'v1.37.0', date: '2026-07-28', changes: ['Vos clés d\'API et mots de passe WordPress sont désormais chiffrés (AES-256-GCM) dans la base locale, avec une clé scellée par le magasin de secrets de votre système', 'Copier le fichier de base sur une autre machine ne permet plus d\'en extraire les secrets', 'La conversion des données existantes est automatique au premier lancement : aucune ressaisie nécessaire'] },
        { version: 'v1.36.0', date: '2026-07-27', changes: ['WaCopilote devient open source sous licence AGPL-3.0 — le code source complet est publié et auditable', 'Le service interne n\'est plus accessible depuis le réseau : il n\'écoute que sur votre machine et exige une authentification. Important si vous travaillez en coworking ou sur un Wi-Fi partagé', 'Les clés d\'API ne sont plus jamais réaffichées : les Réglages indiquent seulement si une clé est configurée', 'Publication au catalogue WhatsApp réparée — elle échouait à chaque tentative', 'Envoi d\'images et consultation des journaux WordPress réparés', 'Vérifier un numéro ne modifie plus le statut d\'autres contacts partageant les mêmes chiffres', '21 vulnérabilités de dépendances corrigées'] },
        { version: 'v1.35.0', date: '2026-07-08', changes: ['Nouveau Pipeline Agentique : un onglet dédié pour enchaîner Agent Prospection → Agent Contacts → Antoine (Stratège Outbound) → Clarisse jusqu\'à un tableau Kanban de suivi commercial', 'Assistant étape par étape avec validation humaine à chaque stade (recherche de leads, sauvegarde des contacts, relecture des messages)', 'Messages d\'approche toujours générés en brouillon, jamais envoyés automatiquement', 'Tableau Kanban drag-and-drop pour organiser le suivi des contacts prospectés'] },
        { version: 'v1.34.2', date: '2026-07-07', changes: ['Correction du tracking des messages WhatsApp suite à la refonte de l\'interface WhatsApp Web (nouveaux sélecteurs, ancrage sur les identifiants internes plutôt que sur les classes CSS)', 'Correction de la détection du sens des messages qui faisait apparaître les suggestions du Copilote comme des réponses de l\'interlocuteur au lieu des vôtres'] },
        { version: 'v1.34.1', date: '2026-07-07', changes: ['Correction : suppression de 3 modèles NVIDIA obsolètes (Gemma 3N E2B/E4B ne répondaient plus, Kimi K2 retiré par NVIDIA)', 'Remplacement du modèle de secours par défaut par un modèle vérifié disponible (Llama 3.1 8B)'] },
        { version: 'v1.34.0', date: '2026-07-07', changes: ['Live Message & Order Radar : détection IA en temps réel des intentions d\'achat dans les conversations WhatsApp', 'Nouvel agent dédié "Order Radar" pour une classification structurée des commandes', 'Catalogue étendu à 56 modèles NVIDIA NIM avec clé API par défaut unique pour tout le système', 'Refonte des réglages IA : séparation claire du provider Chat/Image et sélecteur rapide de modèle dans le chat', 'Simplification des clés API NVIDIA dans les réglages (un seul champ au lieu de 14)'] },
        { version: 'v1.33.2', date: '2026-06-03', changes: ['Amélioration du scraping Annuaire CI (Emails & Sites Web)', 'Ajout des colonnes Email et Site Web dans la Prospection', 'Correction du bug d\'initialisation Puppeteer', 'Mise en place de Skeletons de chargement (UI)'] },
        { version: 'v1.33.1', date: '2026-06-02', changes: ['Nouveau système de prospection (Annuaires CI & Go Africa)', 'Recherche sur Google Maps en temps réel', 'Extraction asynchrone et intelligente de numéros et adresses'] },
        { version: 'v1.33.0', date: '2026-05-23', changes: ['Support des Modèles Vision (NVIDIA & Together AI)', 'Extraction multimodale WhatsApp dynamique', 'Génération d\'images avec Stable Diffusion 3'] },
        { version: 'v1.29.1', date: '2026-05-22', changes: ['Correctif notification de mise à jour persistante', 'Exclusion de l\'état updateAvailable de la persistance IndexedDB', 'Garde de version côté client (double vérification sémantique)'] },
        { version: 'v1.29.0', date: '2026-04-13', changes: ['Correctif du système de mise à jour', 'Harmonisation visuelle (Émeraude)', 'Drag & Drop complet du menu latéral', 'Nouvel écran d\'installation (Onboarding)'] },
        { version: 'v1.28.8', date: '2026-04-12', changes: ['Amélioration mineur de la mise à jour (UX)', 'Vérification silencieuse', 'Bannière et notes de patch automatisées'] },
        { version: 'v1.1.0', date: '2026-04-03', changes: ['AI Photo Studio optimization', 'Custom icons integration', 'Auto-update engine'] },
        { version: 'v1.0.5', date: '2026-03-25', changes: ['WhatsApp Hub performance fix', 'Advanced Analytics dashboard', 'State management refactor'] },
        { version: 'v1.0.0', date: '2026-03-01', changes: ['Initial Beta Release', 'Multi-instance support', 'Gemini AI integration'] }
    ];

    const handleSubmit = (e) => {
        e.preventDefault();
        console.log('Submitting ticket:', form);
        setTicketSent(true);
        setTimeout(() => setTicketSent(false), 5000);

        // Potential deep link to mail client
        const mailBody = encodeURIComponent(`Category: ${form.category}\n\n${form.message}`);
        const mailTo = `mailto:support@auceps-digital.agency?subject=${encodeURIComponent(form.subject)}&body=${mailBody}`;
        window.location.href = mailTo;
    };

    return (
        <div className="max-w-6xl mx-auto space-y-8 animate-in fade-in duration-500">
            {/* Header Section */}
            <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-emerald-600 to-teal-900 p-12 text-white shadow-2xl">
                <div className="relative z-10">
                    <h1 className="text-4xl md:text-5xl font-display font-bold mb-4">{t('supportTitle')}</h1>
                    <p className="text-emerald-50 opacity-90 text-lg max-w-2xl">
                        {t('promoHelpAuceps')}
                    </p>
                </div>
                {/* Abstract background shapes */}
                <div className="absolute top-0 right-0 -translate-y-1/2 translate-x-1/4 w-96 h-96 bg-white/10 rounded-full blur-3xl opacity-30"></div>
                <div className="absolute bottom-0 left-0 translate-y-1/2 -translate-x-1/4 w-64 h-64 bg-emerald-400/20 rounded-full blur-2xl opacity-20"></div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                {/* Left: Contact Info */}
                <div className="lg:col-span-1 space-y-6">
                    <div className="bg-surface dark:bg-gray-900 p-6 rounded-2xl border border-gray-100 dark:border-gray-800 shadow-soft">
                        <div className="flex items-center gap-3 mb-6">
                            <div className="size-10 bg-emerald-500/10 rounded-xl flex items-center justify-center text-emerald-600">
                                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"></path></svg>
                            </div>
                            <h2 className="text-xl font-display font-bold dark:text-white">{t('brandAucepsDigital')}</h2>
                        </div>

                        <div className="space-y-4">
                            <a href="https://auceps-digital.agency" target="_blank" rel="noopener noreferrer" className="flex items-center gap-3 text-sm text-gray-600 dark:text-gray-400 hover:text-emerald-600 dark:hover:text-emerald-400 transition-colors">
                                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"></circle><line x1="2" y1="12" x2="22" y2="12"></line><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"></path></svg>
                                {t('brandAucepsDigitalAgency')}
                            </a>
                            <div className="flex items-start gap-3 text-sm text-gray-600 dark:text-gray-400 transition-colors">
                                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"></path><polyline points="22,6 12,13 2,6"></polyline></svg>
                                <div>
                                    <p className="font-medium">{t('emailSupportAuceps')}</p>
                                    <p className="opacity-70">{t('emailInfoAuceps')}</p>
                                </div>
                            </div>
                            <div className="flex items-start gap-3 text-sm text-gray-600 dark:text-gray-400">
                                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"></path></svg>
                                <div>
                                    <p>+225 07 18 35 04 82</p>
                                    <p>+225 07 69 63 09 87</p>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Open Source */}
                    <div className="bg-surface dark:bg-gray-900 p-6 rounded-2xl border border-gray-100 dark:border-gray-800 shadow-soft">
                        <div className="flex items-center gap-3 mb-4">
                            <div className="size-10 bg-emerald-500/10 rounded-xl flex items-center justify-center text-emerald-600">
                                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M9 19c-5 1.5-5-2.5-7-3m14 6v-3.87a3.37 3.37 0 0 0-.94-2.61c3.14-.35 6.44-1.54 6.44-7A5.44 5.44 0 0 0 20 4.77 5.07 5.07 0 0 0 19.91 1S18.73.65 16 2.48a13.38 13.38 0 0 0-7 0C6.27.65 5.09 1 5.09 1A5.07 5.07 0 0 0 5 4.77a5.44 5.44 0 0 0-1.5 3.78c0 5.42 3.3 6.61 6.44 7A3.37 3.37 0 0 0 9 18.13V22"></path></svg>
                            </div>
                            <div>
                                <h2 className="text-xl font-display font-bold dark:text-white">{t('openSourceTitle')}</h2>
                                {appVersion && <p className="text-xs text-gray-400">{t('installedVersion')} {appVersion}</p>}
                            </div>
                        </div>

                        <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
                            {t('openSourceDesc')}
                        </p>

                        <div className="inline-flex items-center gap-1.5 px-2.5 py-1 mb-4 rounded-full bg-emerald-500/10 text-emerald-600 text-[11px] font-semibold">
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="20 6 9 17 4 12"></polyline></svg>
                            AGPL-3.0
                        </div>

                        <div className="space-y-3">
                            <a href={GITHUB_REPO} onClick={openExternal(GITHUB_REPO)} target="_blank" rel="noopener noreferrer"
                                className="flex items-center gap-3 text-sm text-gray-600 dark:text-gray-400 hover:text-emerald-600 dark:hover:text-emerald-400 transition-colors">
                                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="16 18 22 12 16 6"></polyline><polyline points="8 6 2 12 8 18"></polyline></svg>
                                {t('viewSourceCode')}
                            </a>
                            <a href={`${GITHUB_REPO}/issues`} onClick={openExternal(`${GITHUB_REPO}/issues`)} target="_blank" rel="noopener noreferrer"
                                className="flex items-center gap-3 text-sm text-gray-600 dark:text-gray-400 hover:text-emerald-600 dark:hover:text-emerald-400 transition-colors">
                                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="8" x2="12" y2="12"></line><line x1="12" y1="16" x2="12.01" y2="16"></line></svg>
                                {t('reportIssueGithub')}
                            </a>
                            <a href={`${GITHUB_REPO}/blob/main/CONTRIBUTING.md`} onClick={openExternal(`${GITHUB_REPO}/blob/main/CONTRIBUTING.md`)} target="_blank" rel="noopener noreferrer"
                                className="flex items-center gap-3 text-sm text-gray-600 dark:text-gray-400 hover:text-emerald-600 dark:hover:text-emerald-400 transition-colors">
                                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path><circle cx="9" cy="7" r="4"></circle><path d="M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"></path></svg>
                                {t('contributeToProject')}
                            </a>
                            <a href={`${GITHUB_REPO}/blob/main/SECURITY.md`} onClick={openExternal(`${GITHUB_REPO}/blob/main/SECURITY.md`)} target="_blank" rel="noopener noreferrer"
                                className="flex items-center gap-3 text-sm text-gray-600 dark:text-gray-400 hover:text-emerald-600 dark:hover:text-emerald-400 transition-colors">
                                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 2 4 5v6c0 5.25 3.4 10.16 8 11.5 4.6-1.34 8-6.25 8-11.5V5z"></path></svg>
                                {t('reportVulnerability')}
                            </a>
                        </div>

                        <p className="mt-5 pt-4 border-t border-gray-100 dark:border-gray-800 text-xs text-gray-500 dark:text-gray-500">
                            {t('commercialLicenseNote')}
                        </p>
                    </div>

                    {/* Version History */}
                    <div className="bg-surface dark:bg-gray-900 p-6 rounded-2xl border border-gray-100 dark:border-gray-800 shadow-soft">
                        <h2 className="text-xl font-display font-bold mb-6 dark:text-white">{t('changelog')}</h2>
                        <div className="space-y-6">
                            {changelog.map((entry) => (
                                <div key={entry.version} className="relative pl-6 border-l-2 border-emerald-500/20 last:border-0 pb-6 last:pb-0">
                                    <div className="absolute top-0 left-[-9px] size-4 rounded-full bg-emerald-500 border-4 border-surface dark:border-gray-900"></div>
                                    <div className="flex items-center justify-between mb-1">
                                        <span className="text-sm font-bold text-emerald-600">{entry.version}</span>
                                        <span className="text-[10px] text-gray-400">{entry.date}</span>
                                    </div>
                                    <ul className="text-xs text-gray-600 dark:text-gray-400 space-y-1">
                                        {entry.changes.map((item, i) => <li key={i}>• {item}</li>)}
                                    </ul>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>

                {/* Right: Ticket Form */}
                <div className="lg:col-span-2">
                    <div className="bg-surface dark:bg-gray-900 p-8 rounded-2xl border border-gray-100 dark:border-gray-800 shadow-soft h-full">
                        <h2 className="text-2xl font-display font-bold mb-6 dark:text-white">{t('submitTicket')}</h2>

                        {ticketSent ? (
                            <div className="h-64 flex flex-col items-center justify-center space-y-4 text-center">
                                <div className="size-16 bg-emerald-500 text-white rounded-full flex items-center justify-center animate-bounce">
                                    <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><polyline points="20 6 9 17 4 12"></polyline></svg>
                                </div>
                                <h3 className="text-xl font-bold dark:text-white">{t('ticketSuccess')}</h3>
                                <p className="text-gray-500">{t('emailClientOpened')}</p>
                            </div>
                        ) : (
                            <form onSubmit={handleSubmit} className="space-y-6">
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                    <div className="space-y-2">
                                        <label className="text-sm font-medium text-gray-700 dark:text-gray-300">{t('email')}</label>
                                        <input
                                            type="email"
                                            required
                                            value={form.email}
                                            onChange={e => setForm({ ...form, email: e.target.value })}
                                            disabled={!!userProfile.email}
                                            className="w-full px-4 py-3 rounded-xl border border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-950 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500/50 transition-all disabled:opacity-60"
                                            placeholder={t('placeholderEmail')}
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <label className="text-sm font-medium text-gray-700 dark:text-gray-300">{t('category')}</label>
                                        <select
                                            value={form.category}
                                            onChange={e => setForm({ ...form, category: e.target.value })}
                                            className="w-full px-4 py-3 rounded-xl border border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-950 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500/50 transition-all"
                                        >
                                            {categories.map(c => <option key={c.id} value={c.id}>{c.label}</option>)}
                                        </select>
                                    </div>
                                </div>

                                <div className="space-y-2">
                                    <label className="text-sm font-medium text-gray-700 dark:text-gray-300">{t('subject')}</label>
                                    <input
                                        type="text"
                                        required
                                        value={form.subject}
                                        onChange={e => setForm({ ...form, subject: e.target.value })}
                                        className="w-full px-4 py-3 rounded-xl border border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-950 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500/50 transition-all"
                                        placeholder={t('subjectPlaceholder')}
                                    />
                                </div>

                                <div className="space-y-2">
                                    <label className="text-sm font-medium text-gray-700 dark:text-gray-300">{t('message')}</label>
                                    <textarea
                                        rows="6"
                                        required
                                        value={form.message}
                                        onChange={e => setForm({ ...form, message: e.target.value })}
                                        className="w-full px-4 py-3 rounded-xl border border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-950 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500/50 transition-all resize-none"
                                        placeholder={t('describeRequestInDetail')}
                                    ></textarea>
                                </div>

                                <button
                                    type="submit"
                                    className="w-full py-4 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl shadow-lg shadow-emerald-600/20 transition-all hover:scale-[1.02] active:scale-[0.98] flex items-center justify-center gap-2"
                                >
                                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="22" y1="2" x2="11" y2="13"></line><polygon points="22 2 15 22 11 13 2 9 22 2"></polygon></svg>
                                    {t('sendTicket')}
                                </button>
                            </form>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default Support;
