import React, { useState, useEffect, useRef } from 'react';
import { Search, MapPin, Phone, Globe, Download, Database, CheckSquare, Square, Loader2, Building2, Map as MapIcon, Globe2, Trash2, Clock, Target, RefreshCw } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import useAppStore from '../../store';
import CustomSelect from '../../components/CustomSelect';
import { API_BASE_URL } from '../../config';

export default function Prospection() {
    // i18n partielle (P1-11) : les libellés de notification et de logique sont
    // traduits via `t()`. Les libellés de formulaire restent à internationaliser.
    const { t } = useTranslation();
    const showAppNotification = useAppStore(state => state.showAppNotification);

    const query = useAppStore(state => state.prospectSearchQuery);
    const setQuery = useAppStore(state => state.setProspectSearchQuery);
    const [ignoreLandlines, setIgnoreLandlines] = useState(true);
    const [isSearching, setIsSearching] = useState(false);
    const leads = useAppStore(state => state.prospectLeads);
    const setLeads = useAppStore(state => state.setProspectLeads);
    const [source, setSource] = useState('google');
    const [pages, setPages] = useState(1);
    const [zone, setZone] = useState('');
    const [duration, setDuration] = useState(5);
    const [quantity, setQuantity] = useState(20);
    const [googleApiKey, setGoogleApiKey] = useState('');
    
    // GoAfrica State
    const [goAfricaMetadata, setGoAfricaMetadata] = useState({ countries: [], categories: [] });
    const [goAfricaCountry, setGoAfricaCountry] = useState('ci');
    const [goAfricaCategory, setGoAfricaCategory] = useState('');
    const [goAfricaSubcategory, setGoAfricaSubcategory] = useState('');
    const [isRefreshingMetadata, setIsRefreshingMetadata] = useState(false);

    const handleRefreshGoAfricaMetadata = async () => {
        setIsRefreshingMetadata(true);
        try {
            const response = await fetch(API_BASE_URL + '/api/prospection/goafrica-update-metadata', {
                method: 'POST'
            });
            const result = await response.json();
            if (result.success) {
                showAppNotification(t('prospection.updateStarted'), 'success');
            } else {
                showAppNotification(
                    result.error ? `${t('prospection.error')} : ${result.error}` : t('prospection.error'),
                    'error'
                );
            }
        } catch (err) {
            showAppNotification(
                `${t('prospection.connectionError')}${err.message ? ` : ${err.message}` : ''}`,
                'error'
            );
        } finally {
            setIsRefreshingMetadata(false);
        }
    };
    
    // For Import Modal
    const [isImportModalOpen, setIsImportModalOpen] = useState(false);
    const [allLists, setAllLists] = useState([]);
    const [allSegments, setAllSegments] = useState([]);
    const [selectedListId, setSelectedListId] = useState('');
    const [selectedSegmentId, setSelectedSegmentId] = useState('');
    const [isImporting, setIsImporting] = useState(false);

    // Real-time progress tracking
    const [progressPhase, setProgressPhase] = useState(''); // 'scroll' | 'extract' | 'done' | 'info'
    const [progressMessage, setProgressMessage] = useState('');
    const [progressPercent, setProgressPercent] = useState(0);
    const abortControllerRef = useRef(null);
    const [selectedLeadNames, setSelectedLeadNames] = useState(new Set());

    const toggleSelectAll = () => {
        if (selectedLeadNames.size === leads.length) {
            setSelectedLeadNames(new Set());
        } else {
            setSelectedLeadNames(new Set(leads.map(l => l.name)));
        }
    };

    const toggleSelectLead = (name) => {
        const newSet = new Set(selectedLeadNames);
        if (newSet.has(name)) {
            newSet.delete(name);
        } else {
            newSet.add(name);
        }
        setSelectedLeadNames(newSet);
    };

    const handleDeleteLead = (name) => {
        setLeads(leads.filter(l => l.name !== name));
        if (selectedLeadNames.has(name)) {
            const newSet = new Set(selectedLeadNames);
            newSet.delete(name);
            setSelectedLeadNames(newSet);
        }
    };

    const getTargetLeads = () => {
        return selectedLeadNames.size > 0 
            ? leads.filter(l => selectedLeadNames.has(l.name)) 
            : leads;
    };

    useEffect(() => {
        fetchMetadata();
        fetchConfig();
    }, []);

    const fetchConfig = async () => {
        try {
            const res = await fetch(API_BASE_URL + '/api/config');
            if (res.ok) {
                const data = await res.json();
                if (data.googleMapsApiKey) setGoogleApiKey(data.googleMapsApiKey);
            }
        } catch (error) {
            console.error('Config fetch error:', error);
        }
    };

    const fetchMetadata = async () => {
        try {
            const [listsRes, segmentsRes, goAfricaRes] = await Promise.all([
                fetch(API_BASE_URL + '/api/wa/contact-lists'),
                fetch(API_BASE_URL + '/api/wa/segments'),
                fetch(API_BASE_URL + '/api/prospection/goafrica-metadata').catch(() => null)
            ]);
            const listsData = await listsRes.json();
            const segmentsData = await segmentsRes.json();
            if (listsData.status === 'success') setAllLists(listsData.data);
            if (segmentsData.status === 'success') setAllSegments(segmentsData.data);
            
            if (goAfricaRes && goAfricaRes.ok) {
                const gaData = await goAfricaRes.json();
                if (gaData.success && gaData.data) {
                    setGoAfricaMetadata(gaData.data);
                }
            }
        } catch (error) {
            console.error('Fetch metadata error:', error);
        }
    };

    const handleSearch = async (e) => {
        e.preventDefault();
        
        // Pour GoAfrica, on peut chercher par catégorie seule (sans texte)
        const hasQuery = query.trim().length > 0;
        const hasGoAfricaCategory = source === 'goafrica' && (goAfricaCategory || goAfricaSubcategory);
        
        if (!hasQuery && !hasGoAfricaCategory) return;
        
        setIsSearching(true);
        setProgressPhase('scroll');
        setProgressMessage(t('prospection.starting'));
        setProgressPercent(0);

        const controller = new AbortController();
        abortControllerRef.current = controller;
        
        try {
            const currentLeads = useAppStore.getState().prospectLeads || [];
            const knownLinks = currentLeads
                .filter(l => l.link)
                .map(l => l.link);

            const res = await fetch(API_BASE_URL + '/api/prospection/search-stream', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ 
                    query, 
                    ignoreLandlines, 
                    source, 
                    pages, 
                    zone, 
                    duration, 
                    quantity, 
                    knownLinks,
                    country: source === 'goafrica' ? goAfricaCountry : undefined,
                    subcategorySlug: source === 'goafrica' ? (goAfricaSubcategory || goAfricaCategory) : undefined
                }),
                signal: controller.signal
            });

            const reader = res.body.getReader();
            const decoder = new TextDecoder();
            let buffer = '';

            while (true) {
                const { done, value } = await reader.read();
                if (done) break;

                buffer += decoder.decode(value, { stream: true });
                const lines = buffer.split('\n');
                buffer = lines.pop() || '';

                for (const line of lines) {
                    if (line.startsWith('data: ')) {
                        try {
                            const data = JSON.parse(line.slice(6));
                            console.log("SSE Received:", data);
                            
                            // Handle progress events
                            if (data.phase) {
                                setProgressPhase(data.phase);
                                setProgressMessage(data.message || '');
                                if (data.phase === 'scroll' && data.target > 0) {
                                    setProgressPercent(Math.min(Math.round((data.newCount / data.target) * 50), 50));
                                } else if (data.phase === 'extract' && data.total > 0) {
                                    setProgressPercent(50 + Math.round((data.current / data.total) * 50));
                                } else if (data.phase === 'done') {
                                    setProgressPercent(100);
                                }
                            }
                            
                            // Handle final result
                            if (data.success !== undefined) {
                                if (data.success) {
                                    const formattedLeads = data.leads.map(l => ({
                                        ...l,
                                        source: source,
                                        name: l.name || l.nom,
                                        phone: l.phone || l.numero,
                                        email: l.email || l.details?.email || '',
                                        address: l.address || l.details?.adresse || t('prospection.notSpecified'),
                                        website: l.website || l.details?.siteWeb || ''
                                    }));
                                    
                                    const latestLeads = useAppStore.getState().prospectLeads || [];
                                    const existingNames = new Set(latestLeads.map(p => p.name));
                                    const newUniqueLeads = formattedLeads.filter(l => !existingNames.has(l.name));
                                    setLeads([...latestLeads, ...newUniqueLeads]);
                                    showAppNotification(t('prospection.leadsFound', { count: data.count }), 'success');
                                }
                            }
                            
                            // Handle error
                            if (data.message && !data.phase && !data.success) {
                                throw new Error(data.message);
                            }
                        } catch (parseErr) {
                            if (parseErr.message && !parseErr.message.includes('JSON')) {
                                throw parseErr;
                            }
                        }
                    }
                }
            }
        } catch (error) {
            if (error.name !== 'AbortError') {
                console.error('Search error:', error);
                showAppNotification(error.message || t('prospection.searchError'), 'error');
            }
        } finally {
            setIsSearching(false);
            setProgressPhase('');
            setProgressMessage('');
            abortControllerRef.current = null;
        }
    };

    const handleClearLeads = async () => {
        setLeads([]);
        setSelectedLeadNames(new Set());
        // Also clear the backend session cache so next search starts fresh
        try {
            await fetch(API_BASE_URL + '/api/prospection/clear-cache', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({}) // Empty = clear all sessions
            });
        } catch { /* Non-critical */ }
        showAppNotification(t('prospection.listCleared'), 'success');
    };

    const handleExportCSV = () => {
        if (leads.length === 0) return;
        const targetLeads = getTargetLeads();
        
        const headers = ["Nom", "Téléphone", "Email", "Adresse", "Site Web", "Source", "Lien"];
        const csvContent = [
            headers.join(","),
            ...targetLeads.map(l => `"${(l.name || '').replace(/"/g, '""')}","${l.phone || ''}","${l.email || ''}","${(l.address || '').replace(/"/g, '""')}","${l.website || ''}","${l.source || 'google'}","${l.link || ''}"`)
        ].join("\n");
        
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.setAttribute("href", url);
        link.setAttribute("download", `Leads_${query.replace(/\\s+/g, '_')}.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    const handleImportCRM = async (e) => {
        e.preventDefault();
        if (leads.length === 0) return;
        
        setIsImporting(true);
        
        try {
            const targetLeads = getTargetLeads();
            // Convert leads to WA Contacts format
            const contactsToImport = targetLeads.map(l => ({
                name: l.name,
                phone: l.phone,
                email: l.email || null,
                address: l.address + (l.website ? ` | Web: ${l.website}` : ''),
                list_id: selectedListId || null,
                segment_id: selectedSegmentId || null
            }));

            const res = await fetch(API_BASE_URL + '/api/wa/contacts/bulk', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ contacts: contactsToImport })
            });
            
            const data = await res.json();
            
            if (data.status === 'success') {
                showAppNotification(data.message || t('prospection.importedContacts', { count: data.imported }), 'success');
                setIsImportModalOpen(false);
                setLeads([]); // Clear leads after import
            } else {
                throw new Error(data.error);
            }
        } catch (error) {
            console.error('Import error:', error);
            showAppNotification(error.message || t('prospection.importError'), 'error');
        } finally {
            setIsImporting(false);
        }
    };

    return (
        <div className="max-w-7xl mx-auto space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-extrabold text-gray-900 dark:text-white tracking-tight">Générateur de Leads</h1>
                    <p className="text-gray-500 dark:text-gray-400 mt-1">Recherchez des prospects B2B via Google Maps</p>
                </div>
            </div>

            {/* Search Card */}
            <div className="bg-white dark:bg-zinc-900 border border-gray-200 dark:border-zinc-800 rounded-xl p-6 shadow-sm">
                <form onSubmit={handleSearch} className="space-y-4">
                    <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                            {source === 'goafrica' ? 'Que recherchez-vous ? (ex: "Boulangerie" - Optionnel si une catégorie est sélectionnée)' : 'Que recherchez-vous ? (ex: "Plombiers à Paris", "Agences immobilières Abidjan")'}
                        </label>
                        <div className="relative">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 h-5 w-5" />
                            <input
                                type="text"
                                className="w-full pl-10 pr-4 py-3 bg-gray-50 border border-gray-200 text-gray-900 rounded-lg focus:ring-emerald-500 focus:border-emerald-500 block dark:bg-zinc-800 dark:border-zinc-700 dark:placeholder-gray-400 dark:text-white transition-colors"
                                placeholder="Tapez votre recherche..."
                                value={query}
                                onChange={(e) => setQuery(e.target.value)}
                                required={source !== 'goafrica' || (!goAfricaCategory && !goAfricaSubcategory && !query)}
                            />
                        </div>
                    </div>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                                Source de prospection
                            </label>
                            <div className="relative">
                                <CustomSelect 
                                    value={source}
                                    onChange={setSource}
                                    className="py-3"
                                    icon={
                                        source === 'google' ? <MapIcon className="h-5 w-5 pointer-events-none" /> :
                                        source === 'annuaireci' ? <Building2 className="h-5 w-5 pointer-events-none" /> :
                                        source === 'goafrica' ? <Globe2 className="h-5 w-5 pointer-events-none" /> : null
                                    }
                                    options={[
                                        { value: 'google', label: 'Google Maps' },
                                        { value: 'annuaireci', label: 'Annuaire CI' },
                                        { value: 'goafrica', label: 'Go Africa Online' }
                                    ]}
                                />
                            </div>
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1 flex justify-between">
                                <span>Quantité de pages (Scraping)</span>
                                <span className="font-bold text-emerald-600">{pages}</span>
                            </label>
                            <input 
                                type="range" 
                                min="1" 
                                max="10" 
                                value={pages} 
                                onChange={(e) => setPages(parseInt(e.target.value))}
                                disabled={source === 'google'}
                                className={`w-full h-2 mt-4 bg-gray-200 rounded-lg appearance-none cursor-pointer dark:bg-zinc-700 ${source === 'google' ? 'opacity-50 cursor-not-allowed' : 'accent-emerald-600'}`}
                            />
                            {source === 'google' && <p className="text-xs text-gray-500 mt-1">Géré par les options ci-dessous</p>}
                        </div>
                    </div>

                    {/* Go Africa Specific Settings */}
                    {source === 'goafrica' && (
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-2 border-t border-gray-100 dark:border-zinc-800 mt-2">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Pays</label>
                                <CustomSelect 
                                    value={goAfricaCountry}
                                    onChange={setGoAfricaCountry}
                                    options={(goAfricaMetadata?.countries || []).map(c => ({
                                        value: c.code, label: c.name
                                    }))}
                                    searchable
                                    className="py-2.5"
                                />
                            </div>
                            <div>
                                <div className="flex items-center justify-between mb-1">
                                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Catégorie</label>
                                    <button 
                                        type="button"
                                        onClick={handleRefreshGoAfricaMetadata} 
                                        disabled={isRefreshingMetadata}
                                        className="text-xs text-emerald-600 hover:text-emerald-700 dark:text-emerald-500 dark:hover:text-emerald-400 flex items-center gap-1 disabled:opacity-50"
                                        title="Rafraîchir les catégories depuis Go Africa"
                                    >
                                        <RefreshCw className={`w-3 h-3 ${isRefreshingMetadata ? 'animate-spin' : ''}`} />
                                        <span>Actualiser</span>
                                    </button>
                                </div>
                                <CustomSelect 
                                    value={goAfricaCategory}
                                    onChange={(val) => {
                                        setGoAfricaCategory(val);
                                        setGoAfricaSubcategory('');
                                    }}
                                    placeholder="-- Toutes les catégories --"
                                    searchable
                                    className="py-2.5"
                                    options={(goAfricaMetadata?.categories || []).map(c => ({
                                        value: c.slug, label: c.name
                                    }))}
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Sous-catégorie</label>
                                <CustomSelect 
                                    value={goAfricaSubcategory}
                                    onChange={setGoAfricaSubcategory}
                                    disabled={!goAfricaCategory}
                                    placeholder="-- Toutes les sous-catégories --"
                                    searchable
                                    className="py-2.5"
                                    options={(goAfricaMetadata?.categories?.find(c => c.slug === goAfricaCategory)?.subcategories || []).map(s => ({
                                        value: s.slug, label: s.name
                                    }))}
                                />
                            </div>
                        </div>
                    )}

                    {/* Google Maps Specific Settings */}
                    {source === 'google' && (
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-2 border-t border-gray-100 dark:border-zinc-800 mt-2">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                                    Zone de scraping (Lieu exact)
                                </label>
                                <div className="relative">
                                    <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 h-5 w-5" />
                                    <input
                                        type="text"
                                        className="w-full pl-10 pr-4 py-2 bg-gray-50 border border-gray-200 text-gray-900 rounded-lg focus:ring-emerald-500 focus:border-emerald-500 block dark:bg-zinc-800 dark:border-zinc-700 dark:placeholder-gray-400 dark:text-white transition-colors"
                                        placeholder="Ex: Abidjan, Côte d'Ivoire"
                                        value={zone}
                                        onChange={(e) => setZone(e.target.value)}
                                    />
                                </div>
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1 flex justify-between">
                                    <span>Quantité max (Leads)</span>
                                    <span className="font-bold text-emerald-600">{quantity}</span>
                                </label>
                                <input 
                                    type="range" 
                                    min="5" 
                                    max="200" 
                                    step="5"
                                    value={quantity} 
                                    onChange={(e) => setQuantity(parseInt(e.target.value))}
                                    className="w-full h-2 mt-3 bg-gray-200 rounded-lg appearance-none cursor-pointer dark:bg-zinc-700 accent-emerald-600"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1 flex justify-between">
                                    <span>Durée max (Minutes)</span>
                                    <span className="font-bold text-emerald-600">{duration} min</span>
                                </label>
                                <input 
                                    type="range" 
                                    min="2" 
                                    max="30" 
                                    value={duration} 
                                    onChange={(e) => setDuration(parseInt(e.target.value))}
                                    className="w-full h-2 mt-3 bg-gray-200 rounded-lg appearance-none cursor-pointer dark:bg-zinc-700 accent-emerald-600"
                                />
                            </div>
                        </div>
                    )}

                    <div className="flex items-center gap-2 cursor-pointer pt-2" onClick={() => setIgnoreLandlines(!ignoreLandlines)}>
                        {ignoreLandlines ? <CheckSquare className="text-emerald-500 h-5 w-5" /> : <Square className="text-gray-400 h-5 w-5" />}
                        <span className="text-sm font-medium text-gray-700 dark:text-gray-300 select-none">
                            Tenter d'ignorer les numéros de téléphone fixes (recommandé pour WhatsApp)
                        </span>
                    </div>

                    <div className="pt-4 flex flex-col md:flex-row gap-4 items-start md:items-end">
                        <button
                            type="submit"
                            disabled={isSearching || (!query.trim() && !(source === 'goafrica' && (goAfricaCategory || goAfricaSubcategory)))}
                            className="bg-emerald-600 hover:bg-emerald-700 text-white px-6 py-3 rounded-lg font-medium text-sm flex items-center justify-center gap-2 w-full md:w-auto transition-colors disabled:opacity-50 shadow-sm"
                        >
                            {isSearching ? <Loader2 className="animate-spin h-5 w-5" /> : <Search className="h-5 w-5" />}
                            {isSearching ? 'Recherche en cours...' : (leads.length > 0 ? 'Continuer la recherche' : 'Générer des leads')}
                        </button>
                    </div>
                </form>

                {/* Map en temps réel pour Google Maps */}
                {source === 'google' && query && googleApiKey && (
                    <div className="mt-6 rounded-xl overflow-hidden border border-gray-200 dark:border-zinc-700 shadow-sm h-[350px] relative">
                        <iframe
                            width="100%"
                            height="100%"
                            style={{ border: 0 }}
                            loading="lazy"
                            allowFullScreen
                            referrerPolicy="no-referrer-when-downgrade"
                            src={`https://www.google.com/maps/embed/v1/place?key=${googleApiKey}&q=${encodeURIComponent(query)}`}
                        ></iframe>
                    </div>
                )}
                {source === 'google' && query && !googleApiKey && (
                    <div className="mt-6 p-4 bg-orange-50 dark:bg-orange-900/20 border border-orange-200 dark:border-orange-800 rounded-lg">
                        <p className="text-orange-800 dark:text-orange-300 text-sm">
                            <MapPin className="inline h-4 w-4 mr-1 mb-1" />
                            Pour afficher la carte en temps réel, veuillez ajouter votre clé API Google Maps (GOOGLE_MAPS_API_KEY) dans la configuration du serveur (fichier .env).
                        </p>
                    </div>
                )}
            </div>

            {/* Live Progress Panel */}
            {isSearching && (
                <div className="bg-white dark:bg-zinc-900 border border-gray-200 dark:border-zinc-800 rounded-xl overflow-hidden shadow-sm">
                    <div className="p-5 space-y-4">
                        {/* Progress header */}
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                                <Loader2 className="animate-spin h-5 w-5 text-emerald-500" />
                                <span className="font-semibold text-gray-900 dark:text-white">
                                    {progressPhase === 'scroll' && 'Phase 1 — Recherche de liens...'}
                                    {progressPhase === 'extract' && 'Phase 2 — Extraction des données...'}
                                    {progressPhase === 'done' && 'Terminé !'}
                                    {progressPhase === 'info' && 'Information'}
                                    {!progressPhase && 'Démarrage...'}
                                </span>
                            </div>
                            <span className="text-sm font-mono text-emerald-600 dark:text-emerald-400">{progressPercent}%</span>
                        </div>

                        {/* Progress bar */}
                        <div className="w-full bg-gray-200 dark:bg-zinc-700 rounded-full h-2.5 overflow-hidden">
                            <div 
                                className="bg-gradient-to-r from-emerald-500 to-emerald-400 h-2.5 rounded-full transition-all duration-500 ease-out"
                                style={{ width: `${progressPercent}%` }}
                            ></div>
                        </div>

                        {/* Status message */}
                        <p className="text-sm text-gray-600 dark:text-gray-400 flex items-center gap-2">
                            {progressPhase === 'scroll' && <MapPin className="h-4 w-4 text-blue-500" />}
                            {progressPhase === 'extract' && <Target className="h-4 w-4 text-amber-500" />}
                            {progressPhase === 'done' && <CheckSquare className="h-4 w-4 text-emerald-500" />}
                            {progressMessage || 'Préparation...'}
                        </p>

                        {/* Abort button */}
                        <button
                            onClick={() => { if (abortControllerRef.current) abortControllerRef.current.abort(); }}
                            className="text-sm text-red-500 hover:text-red-600 dark:text-red-400 dark:hover:text-red-300 transition-colors"
                        >
                            Annuler la recherche
                        </button>
                    </div>
                </div>
            )}

            {/* Results Section */}
            {!isSearching && leads.length > 0 && (
                <div className="bg-white dark:bg-zinc-900 border border-gray-200 dark:border-zinc-800 rounded-xl overflow-hidden shadow-sm">
                    <div className="p-4 border-b border-gray-200 dark:border-zinc-800 flex flex-wrap items-center justify-between gap-4">
                        <h3 className="font-semibold text-gray-900 dark:text-white">Résultats ({leads.length} leads trouvés {selectedLeadNames.size > 0 && `, ${selectedLeadNames.size} sélectionnés`})</h3>
                        <div className="flex items-center gap-3">
                            <button
                                onClick={handleClearLeads}
                                disabled={isSearching}
                                className="bg-red-50 hover:bg-red-100 text-red-600 dark:bg-red-900/20 dark:hover:bg-red-900/40 dark:text-red-400 border border-red-200 dark:border-red-800/30 px-4 py-2 rounded-lg font-medium text-sm flex items-center gap-2 transition-colors shadow-sm disabled:opacity-50"
                            >
                                <Trash2 className="h-4 w-4" />
                                Vider
                            </button>
                            <button
                                onClick={handleExportCSV}
                                className="bg-white hover:bg-gray-50 text-gray-700 dark:bg-zinc-800 dark:hover:bg-zinc-700 dark:text-gray-200 border border-gray-200 dark:border-zinc-700 px-4 py-2 rounded-lg font-medium text-sm flex items-center gap-2 transition-colors shadow-sm"
                            >
                                <Download className="h-4 w-4" />
                                Exporter CSV
                            </button>
                            <button
                                onClick={() => setIsImportModalOpen(true)}
                                className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg font-medium text-sm flex items-center gap-2 transition-colors shadow-sm"
                            >
                                <Database className="h-4 w-4" />
                                Importer dans le CRM
                            </button>
                        </div>
                    </div>
                    
                    <div className="overflow-x-auto">
                        <table className="w-full text-left text-sm">
                            <thead className="bg-gray-50 dark:bg-zinc-800/50 text-gray-500 dark:text-gray-400 font-semibold text-xs tracking-wider uppercase select-none">
                                <tr>
                                    <th className="px-4 py-4 border-b border-gray-100 dark:border-zinc-800 w-12 text-center">
                                        <input 
                                            type="checkbox" 
                                            className="rounded border-gray-300 text-emerald-600 focus:ring-emerald-500 cursor-pointer"
                                            checked={leads.length > 0 && selectedLeadNames.size === leads.length}
                                            onChange={toggleSelectAll}
                                        />
                                    </th>
                                    <th className="px-6 py-4 border-b border-gray-100 dark:border-zinc-800">Nom</th>
                                    <th className="px-6 py-4 border-b border-gray-100 dark:border-zinc-800">Téléphone</th>
                                    <th className="px-6 py-4 border-b border-gray-100 dark:border-zinc-800">Email</th>
                                    <th className="px-6 py-4 border-b border-gray-100 dark:border-zinc-800">Adresse & Web</th>
                                    <th className="px-6 py-4 border-b border-gray-100 dark:border-zinc-800 text-right">Actions</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100 dark:divide-zinc-800 text-gray-800 dark:text-zinc-200">
                                {leads.map((lead, idx) => (
                                    <tr key={idx} className={`hover:bg-gray-50/50 dark:hover:bg-zinc-800/30 transition-colors ${selectedLeadNames.has(lead.name) ? 'bg-emerald-50/50 dark:bg-emerald-900/10' : ''}`}>
                                        <td className="px-4 py-4 text-center">
                                            <input 
                                                type="checkbox" 
                                                className="rounded border-gray-300 text-emerald-600 focus:ring-emerald-500 cursor-pointer"
                                                checked={selectedLeadNames.has(lead.name)}
                                                onChange={() => toggleSelectLead(lead.name)}
                                            />
                                        </td>
                                        <td className="px-6 py-4 font-medium">{lead.name}</td>
                                        <td className="px-6 py-4 font-mono text-gray-600 dark:text-gray-400 flex items-center gap-1">
                                            <Phone className="h-3 w-3" />
                                            {lead.phone}
                                        </td>
                                        <td className="px-6 py-4 text-gray-500 dark:text-gray-400">
                                            {lead.email ? (
                                                <a href={`mailto:${lead.email}`} className="text-emerald-600 hover:underline">{lead.email}</a>
                                            ) : '-'}
                                        </td>
                                        <td className="px-6 py-4 text-gray-500 dark:text-gray-400">
                                            <div className="space-y-1">
                                                <div className="flex items-start gap-2 text-gray-600 dark:text-gray-300 text-sm">
                                                    <MapPin className="h-4 w-4 mt-0.5 shrink-0" />
                                                    <span className="flex items-center flex-wrap gap-1">
                                                        {(lead.link || lead.details?.link) ? (
                                                            <a 
                                                                href={lead.link || lead.details?.link} 
                                                                target="_blank" 
                                                                rel="noopener noreferrer" 
                                                                className="hover:underline text-gray-700 dark:text-gray-200" 
                                                                title="Voir la source originale"
                                                            >
                                                                {lead.details?.adresse || lead.address || '-'}
                                                            </a>
                                                        ) : (
                                                            <span>{lead.details?.adresse || lead.address || '-'}</span>
                                                        )}
                                                    </span>
                                                </div>
                                                {(lead.details?.siteWeb || lead.website) && (
                                                    <a href={lead.details?.siteWeb || lead.website} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 text-emerald-600 hover:underline mt-1 text-xs">
                                                        <Globe className="h-3 w-3 flex-shrink-0" />
                                                        <span className="truncate">{(lead.details?.siteWeb || lead.website).replace('https://', '').replace('http://', '')}</span>
                                                    </a>
                                                )}
                                            </div>
                                        </td>
                                        <td className="px-6 py-4 text-right">
                                            <button 
                                                onClick={() => handleDeleteLead(lead.name)}
                                                className="text-gray-400 hover:text-red-500 transition-colors"
                                                title="Supprimer ce lead"
                                            >
                                                <Trash2 className="h-4 w-4" />
                                            </button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            {/* Import CRM Modal */}
            {isImportModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
                    <div className="bg-white dark:bg-zinc-900 rounded-2xl shadow-xl w-full max-w-md overflow-hidden animate-in fade-in zoom-in duration-200">
                        <div className="p-6">
                            <div className="flex justify-between items-start mb-4">
                                <div>
                                    <h3 className="text-xl font-bold text-gray-900 dark:text-white">Importer dans le CRM</h3>
                                    <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                                        Importez ces {selectedLeadNames.size > 0 ? selectedLeadNames.size : leads.length} leads dans votre base de contacts.
                                    </p>
                                </div>
                                <button
                                    onClick={() => setIsImportModalOpen(false)}
                                    className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
                                >
                                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
                                </button>
                            </div>

                            <form onSubmit={handleImportCRM} className="space-y-4">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Associer à une Liste (Optionnel)</label>
                                    <CustomSelect
                                        value={selectedListId}
                                        onChange={setSelectedListId}
                                        placeholder="-- Aucune Liste --"
                                        options={allLists.map(l => ({
                                            value: l.id, label: l.name
                                        }))}
                                        className="py-2.5"
                                    />
                                </div>

                                <div>
                                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Associer à un Segment (Optionnel)</label>
                                    <CustomSelect
                                        value={selectedSegmentId}
                                        onChange={setSelectedSegmentId}
                                        placeholder="-- Aucun Segment --"
                                        options={allSegments.map(s => ({
                                            value: s.id, label: s.name
                                        }))}
                                        className="py-2.5"
                                    />
                                </div>

                                <div className="pt-2 flex gap-3">
                                    <button
                                        type="button"
                                        onClick={() => setIsImportModalOpen(false)}
                                        className="flex-1 text-gray-700 bg-gray-100 hover:bg-gray-200 dark:text-gray-300 dark:bg-zinc-800 dark:hover:bg-zinc-700 focus:ring-4 focus:outline-none focus:ring-gray-300 font-medium rounded-lg text-sm px-5 py-2.5 text-center transition-colors"
                                    >
                                        Annuler
                                    </button>
                                    <button
                                        type="submit"
                                        disabled={isImporting}
                                        className="flex-1 text-white bg-blue-600 hover:bg-blue-700 focus:ring-4 focus:outline-none focus:ring-blue-300 font-medium rounded-lg text-sm px-5 py-2.5 text-center transition-colors disabled:opacity-50"
                                    >
                                        {isImporting ? 'Importation...' : 'Confirmer l\'import'}
                                    </button>
                                </div>
                            </form>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
