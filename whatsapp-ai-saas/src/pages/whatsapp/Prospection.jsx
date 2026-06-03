import React, { useState, useEffect } from 'react';
import { Search, MapPin, Phone, Globe, Download, Database, CheckSquare, Square, Loader2, Building2, Map as MapIcon, Globe2 } from 'lucide-react';
import { Link } from 'react-router-dom';
import useAppStore from '../../store';
import { useTranslation } from 'react-i18next';

export default function Prospection() {
    const { t } = useTranslation();
    const showAppNotification = useAppStore(state => state.showAppNotification);

    const [query, setQuery] = useState('');
    const [ignoreLandlines, setIgnoreLandlines] = useState(true);
    const [isSearching, setIsSearching] = useState(false);
    const [leads, setLeads] = useState([]);
    const [source, setSource] = useState('google');
    const [pages, setPages] = useState(1);
    const [googleApiKey, setGoogleApiKey] = useState('');
    
    // For Import Modal
    const [isImportModalOpen, setIsImportModalOpen] = useState(false);
    const [allLists, setAllLists] = useState([]);
    const [allSegments, setAllSegments] = useState([]);
    const [selectedListId, setSelectedListId] = useState('');
    const [selectedSegmentId, setSelectedSegmentId] = useState('');
    const [isImporting, setIsImporting] = useState(false);

    useEffect(() => {
        fetchMetadata();
        fetchConfig();
    }, []);

    const fetchConfig = async () => {
        try {
            const res = await fetch('http://127.0.0.1:3000/api/config');
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
            const [listsRes, segmentsRes] = await Promise.all([
                fetch('http://127.0.0.1:3000/api/wa/contact-lists'),
                fetch('http://127.0.0.1:3000/api/wa/segments')
            ]);
            const listsData = await listsRes.json();
            const segmentsData = await segmentsRes.json();
            if (listsData.status === 'success') setAllLists(listsData.data);
            if (segmentsData.status === 'success') setAllSegments(segmentsData.data);
        } catch (error) {
            console.error('Fetch metadata error:', error);
        }
    };

    const handleSearch = async (e) => {
        e.preventDefault();
        if (!query.trim()) return;
        
        setIsSearching(true);
        setLeads([]);
        
        try {
            const res = await fetch('http://127.0.0.1:3000/api/prospection/search', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ query, ignoreLandlines, source, pages })
            });
            const data = await res.json();
            
            if (data.success) {
                // Uniformiser le format des leads retournés
                const formattedLeads = data.leads.map(l => ({
                    name: l.name || l.nom,
                    phone: l.phone || l.numero,
                    email: l.email || l.details?.email || '',
                    address: l.address || l.details?.adresse || 'Non précisé',
                    website: l.website || l.details?.siteWeb || ''
                }));
                
                setLeads(formattedLeads);
                showAppNotification(`${data.count} leads trouvés !`, 'success');
            } else {
                throw new Error(data.error);
            }
        } catch (error) {
            console.error('Search error:', error);
            showAppNotification(error.message || 'Erreur lors de la recherche', 'error');
        } finally {
            setIsSearching(false);
        }
    };

    const handleExportCSV = () => {
        if (leads.length === 0) return;
        
        const headers = ["Nom", "Téléphone", "Email", "Adresse", "Site Web"];
        const csvContent = [
            headers.join(","),
            ...leads.map(l => `"${l.name.replace(/"/g, '""')}","${l.phone}","${l.email}","${l.address.replace(/"/g, '""')}","${l.website}"`)
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
            // Convert leads to WA Contacts format
            const contactsToImport = leads.map(l => ({
                name: l.name,
                phone: l.phone,
                email: l.email || null,
                address: l.address + (l.website ? ` | Web: ${l.website}` : ''),
                list_id: selectedListId || null,
                segment_id: selectedSegmentId || null
            }));

            const res = await fetch('http://127.0.0.1:3000/api/wa/contacts/bulk', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ contacts: contactsToImport })
            });
            
            const data = await res.json();
            
            if (data.status === 'success') {
                showAppNotification(`${data.imported} contacts importés dans le CRM !`, 'success');
                setIsImportModalOpen(false);
                setLeads([]); // Clear leads after import
            } else {
                throw new Error(data.error);
            }
        } catch (error) {
            console.error('Import error:', error);
            showAppNotification(error.message || "Erreur lors de l'importation", 'error');
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
                            Que recherchez-vous ? (ex: "Plombiers à Paris", "Agences immobilières Abidjan")
                        </label>
                        <div className="relative">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 h-5 w-5" />
                            <input
                                type="text"
                                className="w-full pl-10 pr-4 py-3 bg-gray-50 border border-gray-200 text-gray-900 rounded-lg focus:ring-emerald-500 focus:border-emerald-500 block dark:bg-zinc-800 dark:border-zinc-700 dark:placeholder-gray-400 dark:text-white transition-colors"
                                placeholder="Tapez votre recherche..."
                                value={query}
                                onChange={(e) => setQuery(e.target.value)}
                                required
                            />
                        </div>
                    </div>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                                Source de prospection
                            </label>
                            <div className="relative">
                                <select 
                                    className="w-full pl-10 pr-4 py-3 bg-gray-50 border border-gray-200 text-gray-900 rounded-lg focus:ring-emerald-500 focus:border-emerald-500 block dark:bg-zinc-800 dark:border-zinc-700 dark:text-white transition-colors appearance-none"
                                    value={source}
                                    onChange={(e) => setSource(e.target.value)}
                                >
                                    <option value="google">Google Maps</option>
                                    <option value="annuaireci">Annuaire CI</option>
                                    <option value="goafrica">Go Africa Online</option>
                                </select>
                                {source === 'google' && <MapIcon className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 h-5 w-5" />}
                                {source === 'annuaireci' && <Building2 className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 h-5 w-5" />}
                                {source === 'goafrica' && <Globe2 className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 h-5 w-5" />}
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
                            {source === 'google' && <p className="text-xs text-gray-500 mt-1">Non applicable pour Google Maps</p>}
                        </div>
                    </div>

                    <div className="flex items-center gap-2 cursor-pointer pt-2" onClick={() => setIgnoreLandlines(!ignoreLandlines)}>
                        {ignoreLandlines ? <CheckSquare className="text-emerald-500 h-5 w-5" /> : <Square className="text-gray-400 h-5 w-5" />}
                        <span className="text-sm font-medium text-gray-700 dark:text-gray-300 select-none">
                            Tenter d'ignorer les numéros de téléphone fixes (recommandé pour WhatsApp)
                        </span>
                    </div>

                    <div className="pt-4 flex flex-col md:flex-row gap-4 items-start md:items-end">
                        <button
                            type="submit"
                            disabled={isSearching || !query.trim()}
                            className="bg-emerald-600 hover:bg-emerald-700 text-white px-6 py-3 rounded-lg font-medium text-sm flex items-center justify-center gap-2 w-full md:w-auto transition-colors disabled:opacity-50 shadow-sm"
                        >
                            {isSearching ? <Loader2 className="animate-spin h-5 w-5" /> : <Search className="h-5 w-5" />}
                            {isSearching ? 'Recherche en cours...' : 'Générer des leads'}
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

            {/* Results Section */}
            {leads.length > 0 && (
                <div className="bg-white dark:bg-zinc-900 border border-gray-200 dark:border-zinc-800 rounded-xl overflow-hidden shadow-sm">
                    <div className="p-4 border-b border-gray-200 dark:border-zinc-800 flex flex-wrap items-center justify-between gap-4">
                        <h3 className="font-semibold text-gray-900 dark:text-white">Résultats ({leads.length} leads trouvés)</h3>
                        <div className="flex items-center gap-3">
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
                                    <th className="px-6 py-4 border-b border-gray-100 dark:border-zinc-800">Nom</th>
                                    <th className="px-6 py-4 border-b border-gray-100 dark:border-zinc-800">Téléphone</th>
                                    <th className="px-6 py-4 border-b border-gray-100 dark:border-zinc-800">Email</th>
                                    <th className="px-6 py-4 border-b border-gray-100 dark:border-zinc-800">Adresse & Web</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100 dark:divide-zinc-800 text-gray-800 dark:text-zinc-200">
                                {leads.map((lead, idx) => (
                                    <tr key={idx} className="hover:bg-gray-50/50 dark:hover:bg-zinc-800/30 transition-colors">
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
                                        <td className="px-6 py-4 text-gray-500 dark:text-gray-400 max-w-[200px] truncate" title={lead.address}>
                                            <div className="flex items-center gap-1">
                                                <MapPin className="h-3 w-3 flex-shrink-0" />
                                                <span className="truncate">{lead.address}</span>
                                            </div>
                                            {lead.website && (
                                                <a href={lead.website} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 text-emerald-600 hover:underline mt-1 text-xs">
                                                    <Globe className="h-3 w-3 flex-shrink-0" />
                                                    <span className="truncate">{lead.website.replace('https://', '').replace('http://', '')}</span>
                                                </a>
                                            )}
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
                                        Importez ces {leads.length} leads dans votre base de contacts.
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
                                    <select
                                        className="w-full bg-gray-50 border border-gray-200 text-gray-900 text-sm rounded-lg focus:ring-emerald-500 focus:border-emerald-500 block p-2.5 dark:bg-zinc-800 dark:border-zinc-700 dark:placeholder-gray-400 dark:text-white transition-colors"
                                        value={selectedListId}
                                        onChange={(e) => setSelectedListId(e.target.value)}
                                    >
                                        <option value="">-- Aucune Liste --</option>
                                        {allLists.map(l => (
                                            <option key={l.id} value={l.id}>{l.name}</option>
                                        ))}
                                    </select>
                                </div>

                                <div>
                                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Associer à un Segment (Optionnel)</label>
                                    <select
                                        className="w-full bg-gray-50 border border-gray-200 text-gray-900 text-sm rounded-lg focus:ring-emerald-500 focus:border-emerald-500 block p-2.5 dark:bg-zinc-800 dark:border-zinc-700 dark:placeholder-gray-400 dark:text-white transition-colors"
                                        value={selectedSegmentId}
                                        onChange={(e) => setSelectedSegmentId(e.target.value)}
                                    >
                                        <option value="">-- Aucun Segment --</option>
                                        {allSegments.map(s => (
                                            <option key={s.id} value={s.id}>{s.name}</option>
                                        ))}
                                    </select>
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
