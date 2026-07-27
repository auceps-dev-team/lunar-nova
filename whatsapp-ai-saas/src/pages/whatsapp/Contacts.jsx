import React, { useState, useEffect, useRef, useMemo } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import useAppStore from '../../store';

import { useTranslation } from 'react-i18next';
import CustomSelect from '../../components/CustomSelect';
import { API_BASE_URL } from '../../config';
import { TableSkeleton } from '../../components/ui/SkeletonLoader';



export default function Contacts({ activeId }) {
    const { t } = useTranslation();
    const language = useAppStore(state => state.appSettings?.language) || 'en';
    const [contacts, setContacts] = useState([]);
    const [isLoading, setIsLoading] = useState(true);

    // --- Global WA Analysis State (persists across navigations) ---
    const waAnalysis = useAppStore(state => state.waAnalysis);
    const startWaAnalysis = useAppStore(state => state.startWaAnalysis);
    const updateWaContactAnalysis = useAppStore(state => state.updateWaContactAnalysis);
    const finishWaAnalysis = useAppStore(state => state.finishWaAnalysis);
    const isAnalyzing = waAnalysis.isRunning;
    const contactStatus = waAnalysis.contactStatuses;

    const [countryCode, setCountryCode] = useState(() => {
        return localStorage.getItem('wa_country_code') || '225';
    });

    useEffect(() => {
        localStorage.setItem('wa_country_code', countryCode);
    }, [countryCode]);

    const [currentPage, setCurrentPage] = useState(() => {
        const saved = sessionStorage.getItem('wa_contacts_page');
        return saved ? parseInt(saved, 10) : 1;
    });
    const [sortField, setSortField] = useState('id');
    const [sortDirection, setSortDirection] = useState('desc');
    const [filterStatus, setFilterStatus] = useState('all');

    useEffect(() => {
        sessionStorage.setItem('wa_contacts_page', currentPage.toString());
    }, [currentPage]);
    const [filterSegment, setFilterSegment] = useState('all');
    const [filterList, setFilterList] = useState('all');
    const [allSegments, setAllSegments] = useState([]);
    const [allLists, setAllLists] = useState([]);

    // Bulk Actions State
    const [selectedContacts, setSelectedContacts] = useState([]);
    const [isBulkEditModalOpen, setIsBulkEditModalOpen] = useState(false);
    const [isBulkListEditModalOpen, setIsBulkListEditModalOpen] = useState(false);
    const [bulkSegmentId, setBulkSegmentId] = useState('');
    const [bulkListId, setBulkListId] = useState('');
    const [isSubmittingBulk, setIsSubmittingBulk] = useState(false);

    // Dynamic Template State
    const [isTemplateModalOpen, setIsTemplateModalOpen] = useState(false);
    const [dynamicTemplate, setDynamicTemplate] = useState('');
    const [isSavingTemplate, setIsSavingTemplate] = useState(false);
    const templateTextareaRef = useRef(null);

    const insertVariable = (variable) => {
        const textarea = templateTextareaRef.current;
        if (textarea) {
            const start = textarea.selectionStart;
            const end = textarea.selectionEnd;
            const textBefore = dynamicTemplate.substring(0, start);
            const textAfter = dynamicTemplate.substring(end);
            const newValue = textBefore + variable + textAfter;
            setDynamicTemplate(newValue);

            // Re-focus and set cursor position (setTimeout to allow React state update)
            setTimeout(() => {
                textarea.focus();
                textarea.setSelectionRange(start + variable.length, start + variable.length);
            }, 0);
        } else {
            setDynamicTemplate(prev => prev + variable);
        }
    };

    const itemsPerPage = 10;

    const navigate = useNavigate();
    const showAppNotification = useAppStore(state => state.showAppNotification);
    const fileInputRef = useRef(null);

    const fetchContacts = async () => {
        try {
            const res = await fetch('http://127.0.0.1:3000/api/wa/contacts');
            const data = await res.json();
            if (data.status === 'success') {
                setContacts(data.data);
            }
        } catch (error) {
            console.error("Failed to fetch contacts", error);
            showAppNotification('Failed to load contacts', 'error');
        } finally {
            setIsLoading(false);
        }
    };

    const fetchSettings = async () => {
        try {
            const res = await fetch('http://127.0.0.1:3000/api/settings');
            const data = await res.json();
            if (data.status === 'success' && data.settings && data.settings.dynamic_message_template) {
                setDynamicTemplate(data.settings.dynamic_message_template);
            }
        } catch (error) {
            console.error("Failed to fetch settings", error);
        }
    };

    const handleSaveTemplate = async (e) => {
        e.preventDefault();
        setIsSavingTemplate(true);
        try {
            const res = await fetch('http://127.0.0.1:3000/api/settings', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ dynamic_message_template: dynamicTemplate })
            });
            const data = await res.json();
            if (data.status === 'success') {
                showAppNotification('Modèle de message enregistré !', 'success');
                setIsTemplateModalOpen(false);
            } else {
                throw new Error(data.error);
            }
        } catch (error) {
            console.error('Save template error:', error);
            showAppNotification('Erreur lors de la sauvegarde du modèle', 'error');
        } finally {
            setIsSavingTemplate(false);
        }
    };

    useEffect(() => {
        fetchContacts();
        fetchSettings();
        fetchMetadata();
    }, []);

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

    const handleDelete = async (id) => {
        if (!window.confirm("Are you sure you want to delete this contact?")) return;

        try {
            // Note: Currently no backend delete route written, simulating for UI
            // await fetch(`${API_BASE_URL}/api/wa/contacts/${id}`, { method: 'DELETE' });
            setContacts(contacts.filter(c => c.id !== id));
            showAppNotification('Contact deleted locally (Backend route pending)', 'success');
        } catch (error) {
            showAppNotification('Failed to delete contact', 'error');
        }
    };

    // Derive unique segments for the filter dropdown
    const uniqueSegments = useMemo(() => [...new Set(contacts.map(c => c.segment_name).filter(Boolean))], [contacts]);
    const uniqueLists = useMemo(() => [...new Set(contacts.map(c => c.list_name).filter(Boolean))], [contacts]);
    // Also get segments with IDs for bulk update modal
    const segments = useMemo(() => [...new Map(contacts.filter(c => c.segment_name && c.segment_id).map(item => [item.segment_id, { id: item.segment_id, name: item.segment_name }])).values()], [contacts]);
    const listsMap = useMemo(() => [...new Map(contacts.filter(c => c.list_name && c.list_id).map(item => [item.list_id, { id: item.list_id, name: item.list_name }])).values()], [contacts]);


    // Apply filtering and sorting
    const processedContacts = useMemo(() => {
        let filtered = contacts.filter(c => {
            let matchStatus = true;
            let matchSegment = true;
            let matchList = true;

            // Status filter: unverified, valid, invalid
            if (filterStatus !== 'all') {
                matchStatus = (c.status || 'unverified') === filterStatus;
            }

            // Segment filter
            if (filterSegment !== 'all') {
                matchSegment = c.segment_name === filterSegment;
            }

            // List filter
            if (filterList !== 'all') {
                matchList = c.list_name === filterList;
            }

            return matchStatus && matchSegment && matchList;
        });

        return filtered.sort((a, b) => {
            let valA = a[sortField];
            let valB = b[sortField];

            if (typeof valA === 'string') valA = valA.toLowerCase();
            if (typeof valB === 'string') valB = valB.toLowerCase();

            let comparison = 0;
            if (valA < valB) comparison = -1;
            if (valA > valB) comparison = 1;
            return sortDirection === 'asc' ? comparison : -comparison;
        });
    }, [contacts, filterStatus, filterSegment, filterList, sortField, sortDirection]);

    const handleSelectAll = (e) => {
        if (e.target.checked) {
            // Select all currently visible (or processed) contacts
            setSelectedContacts(processedContacts.map(c => c.id));
        } else {
            setSelectedContacts([]);
        }
    };

    const handleSelectContact = (id) => {
        if (selectedContacts.includes(id)) {
            setSelectedContacts(selectedContacts.filter(contactId => contactId !== id));
        } else {
            setSelectedContacts([...selectedContacts, id]);
        }
    };

    const handleBulkDelete = async () => {
        if (!window.confirm(`Are you sure you want to delete ${selectedContacts.length} contacts?`)) return;

        try {
            const res = await fetch('http://127.0.0.1:3000/api/wa/contacts/bulk-delete', {
                method: 'DELETE',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ contactIds: selectedContacts })
            });
            const data = await res.json();
            if (data.status === 'success') {
                showAppNotification(`Successfully deleted ${data.deletedCount} contacts`, 'success');
                setContacts(contacts.filter(c => !selectedContacts.includes(c.id)));
                setSelectedContacts([]);
            } else {
                throw new Error(data.error);
            }
        } catch (error) {
            console.error('Bulk delete error:', error);
            showAppNotification('Failed to delete contacts', 'error');
        }
    };

    const handleBulkUpdate = async (e) => {
        e.preventDefault();
        setIsSubmittingBulk(true);
        try {
            const res = await fetch('http://127.0.0.1:3000/api/wa/contacts/bulk-update', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    contactIds: selectedContacts,
                    segmentId: bulkSegmentId
                })
            });
            const data = await res.json();
            if (data.status === 'success') {
                showAppNotification(`Successfully updated ${data.updatedCount} contacts`, 'success');
                // Refresh contacts to get new segment names from DB
                fetchContacts();
                setSelectedContacts([]);
                setIsBulkEditModalOpen(false);
                setBulkSegmentId('');
            } else {
                throw new Error(data.error);
            }
        } catch (error) {
            console.error('Bulk update error:', error);
            showAppNotification('Failed to update contacts', 'error');
        } finally {
            setIsSubmittingBulk(false);
        }
    };

    const handleBulkUpdateList = async (e) => {
        e.preventDefault();
        setIsSubmittingBulk(true);
        try {
            const res = await fetch('http://127.0.0.1:3000/api/wa/contacts/bulk-update-list', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    contactIds: selectedContacts,
                    listId: bulkListId
                })
            });
            const data = await res.json();
            if (data.status === 'success') {
                showAppNotification(`Successfully updated ${data.updatedCount} contacts`, 'success');
                fetchContacts();
                setSelectedContacts([]);
                setIsBulkListEditModalOpen(false);
                setBulkListId('');
            } else {
                throw new Error(data.error);
            }
        } catch (error) {
            console.error('Bulk update error:', error);
            showAppNotification('Failed to update lists', 'error');
        } finally {
            setIsSubmittingBulk(false);
        }
    };

    const totalFiltered = processedContacts.length;
    const contactsOnPage = processedContacts.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);
    const totalPages = Math.ceil(totalFiltered / itemsPerPage);

    const handleSort = (field) => {
        if (sortField === field) {
            setSortDirection(prev => prev === 'asc' ? 'desc' : 'asc');
        } else {
            setSortField(field);
            setSortDirection('asc');
        }
    };

    const handleAnalyze = async () => {
        if (!activeId) {
            showAppNotification('Please start a WhatsApp session first.', 'error');
            return;
        }
        if (isAnalyzing) return;

        // Launch global analysis (survives page navigation)
        const contactsToAnalyze = [...contactsOnPage];
        startWaAnalysis(contactsToAnalyze.length);

        // Run in the background — no local state, uses global store
        (async () => {
            for (const contact of contactsToAnalyze) {
                updateWaContactAnalysis(contact.id, 'loading');
                try {
                    const rawPhone = contact.phone ? contact.phone.toString().replace(/[^0-9]/g, '') : '';

                    if (!rawPhone || rawPhone.length < 5) {
                        updateWaContactAnalysis(contact.id, 'invalid');
                        continue;
                    }

                    const controller = new AbortController();
                    const timeoutId = setTimeout(() => controller.abort(), 40000); // 40s max per contact

                    const res = await fetch('http://127.0.0.1:3000/api/wa/verify-contact', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ instance_id: activeId, contact_id: contact.id, phone: rawPhone, country_code: countryCode }),
                        signal: controller.signal
                    });
                    clearTimeout(timeoutId);

                    const data = await res.json();
                    if (data.status === 'success') {
                        updateWaContactAnalysis(contact.id, data.is_valid ? 'valid' : 'invalid');
                    } else {
                        updateWaContactAnalysis(contact.id, 'error');
                    }
                } catch (err) {
                    if (err.name === 'AbortError') {
                        console.warn(`[Analyse] Timeout pour ${contact.name} — passage au suivant`);
                    } else {
                        console.error('Error analyzing contact', contact.name, err);
                    }
                    updateWaContactAnalysis(contact.id, 'error');
                }
            }

            // Done — always fires even if user navigated away
            finishWaAnalysis();
            const { waAnalysis: finalState } = useAppStore.getState();
            showAppNotification(
                `Analyse terminée : ${finalState.totalValid} numéros WhatsApp valides trouvés, ${finalState.totalInvalid} invalides.`,
                'success'
            );
        })();
    };

    const [openingChatFor, setOpeningChatFor] = useState(null);

    const handleOpenChat = async (phone, contactId) => {
        if (!activeId) {
            showAppNotification('Veuillez démarrer une session WhatsApp d\'abord.', 'error');
            return;
        }

        setOpeningChatFor(contactId);
        try {
            const rawPhone = phone.replace(/[^0-9]/g, '');
            const res = await fetch('http://127.0.0.1:3000/api/wa/open-chat', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ instance_id: activeId, phone: rawPhone, contact_id: contactId, country_code: countryCode })
            });
            const data = await res.json();
            if (data.status === 'success') {
                if (data.formattedMessage && data.formattedMessage.trim().length > 0) {
                    try {
                        await navigator.clipboard.writeText(data.formattedMessage);
                        showAppNotification('Chat ouvert et message copié ! Faites Ctrl+V', 'success');
                    } catch (err) {
                        console.error('Failed to copy text', err);
                        showAppNotification('Ouverture de la conversation WhatsApp...', 'success');
                    }
                } else {
                    showAppNotification('Ouverture de la conversation WhatsApp...', 'success');
                }
                // Give WhatsApp time to load the chat before navigating
                await new Promise(r => setTimeout(r, 1200));
                navigate('/whatsapp-hub');
            } else {
                throw new Error(data.error);
            }
        } catch (error) {
            console.error(error);
            showAppNotification('Impossible d\'ouvrir la conversation', 'error');
        } finally {
            setOpeningChatFor(null);
        }
    };

    return (
        <div className="max-w-7xl mx-auto space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <Link to="/dashboard" className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 text-sm flex items-center gap-1 mb-2 transition-colors">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M15 18l-6-6 6-6" /></svg>
                        {t('backToDashboard')}
                    </Link>
                    <h1 className="text-3xl font-extrabold text-gray-900 dark:text-white tracking-tight">{t('contacts')}</h1>
                </div>
                <div className="flex items-center gap-3">
                    {selectedContacts.length > 0 && (
                        <div className="flex items-center gap-2 bg-emerald-50 dark:bg-emerald-900/20 px-3 py-1.5 rounded-lg border border-emerald-100 dark:border-emerald-800/50">
                            <span className="text-sm font-medium text-emerald-700 dark:text-emerald-400">
                                {selectedContacts.length} {t('selected')}
                            </span>
                            <div className="h-4 w-px bg-emerald-200 dark:bg-emerald-800 mx-1"></div>
                            <button
                                onClick={() => setIsBulkEditModalOpen(true)}
                                className="text-sm font-medium text-emerald-600 hover:text-emerald-800 dark:text-emerald-400 dark:hover:text-emerald-300 transition-colors"
                            >
                                {t('editSegment')}
                            </button>
                            <button
                                onClick={() => setIsBulkListEditModalOpen(true)}
                                className="text-sm font-medium text-emerald-600 hover:text-emerald-800 dark:text-emerald-400 dark:hover:text-emerald-300 transition-colors ml-2"
                            >
                                {t('editList')}
                            </button>
                            <button
                                onClick={handleBulkDelete}
                                className="text-sm font-medium text-red-600 hover:text-red-800 dark:text-red-400 dark:hover:text-red-300 transition-colors ml-2"
                            >
                                {t('deleteAll')}
                            </button>
                        </div>
                    )}
                    <button
                        onClick={() => setIsTemplateModalOpen(true)}
                        className="bg-emerald-50 text-emerald-700 hover:bg-emerald-100 dark:bg-emerald-900/20 dark:text-emerald-400 dark:hover:bg-emerald-900/40 border border-emerald-200 dark:border-emerald-800/50 px-4 py-2 rounded-lg font-medium text-sm flex items-center gap-2 transition-colors shadow-sm"
                    >
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path></svg>
                        {t('messageTemplate')}
                    </button>
                    <button
                        onClick={() => navigate('/wa/contacts/import')}
                        className="bg-white hover:bg-gray-50 text-gray-700 dark:bg-zinc-800 dark:hover:bg-zinc-700 dark:text-gray-200 border border-gray-200 dark:border-zinc-700 px-4 py-2 rounded-lg font-medium text-sm transition-colors shadow-sm"
                    >
                        {t('importContact')}
                    </button>
                    <button
                        onClick={() => navigate('/wa/contacts/add')}
                        className="bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 rounded-lg font-medium text-sm flex items-center gap-2 transition-colors shadow-sm"
                    >
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 5v14M5 12h14" /></svg>
                        {t('addNewContact')}
                    </button>
                </div>
            </div>

            {/* Filters Bar */}
            <div className="flex flex-wrap gap-4 items-center bg-white dark:bg-zinc-900 p-4 border border-gray-100 dark:border-zinc-800 rounded-xl shadow-sm">
                {/* Filtre Statut */}
                <div className="flex items-center gap-2">
                    <label className="text-sm font-medium text-gray-600 dark:text-gray-400">{t('status')}:</label>
                    <CustomSelect
                        value={filterStatus}
                        onChange={(v) => { setFilterStatus(v); setCurrentPage(1); }}
                        panelWidth="w-44"
                        options={[
                            { value: 'all', label: t('all') },
                            { value: 'valid', label: `✅ ${t('valid')}` },
                            { value: 'invalid', label: `❌ ${t('invalid')}` },
                            { value: 'unverified', label: `⏱️ ${t('unverified')}` },
                        ]}
                    />
                </div>

                {/* Filtre Indicatif Pays */}
                <div className="flex items-center gap-2">
                    <label className="text-sm font-medium text-gray-600 dark:text-gray-400">Pays:</label>
                    <select
                        value={countryCode}
                        onChange={(e) => setCountryCode(e.target.value)}
                        className="bg-gray-50 border border-gray-200 text-gray-900 text-sm rounded-lg focus:ring-emerald-500 focus:border-emerald-500 p-2.5 dark:bg-zinc-800 dark:border-zinc-700 dark:text-white"
                    >
                        <option value="225">🇨🇮 Côte d'Ivoire (+225)</option>
                        <option value="221">🇸🇳 Sénégal (+221)</option>
                        <option value="237">🇨🇲 Cameroun (+237)</option>
                        <option value="243">🇨🇩 RDC (+243)</option>
                        <option value="228">🇹🇬 Togo (+228)</option>
                        <option value="226">🇧🇫 Burkina Faso (+226)</option>
                        <option value="223">🇲🇱 Mali (+223)</option>
                        <option value="229">🇧🇯 Bénin (+229)</option>
                        <option value="241">🇬🇦 Gabon (+241)</option>
                        <option value="242">🇨🇬 Congo (+242)</option>
                        <option value="none">Autre (Format libre)</option>
                    </select>
                </div>

                {/* Filtre Segment */}
                <div className="flex items-center gap-2">
                    <label className="text-sm font-medium text-gray-600 dark:text-gray-400">{t('segment')}:</label>
                    <CustomSelect
                        value={filterSegment}
                        onChange={(v) => { setFilterSegment(v); setCurrentPage(1); }}
                        searchable={uniqueSegments.length > 5}
                        panelWidth="w-52"
                        options={[
                            { value: 'all', label: t('allSegments') },
                            ...uniqueSegments.map(seg => ({ value: seg, label: seg })),
                        ]}
                    />
                </div>

                {/* Filtre Liste */}
                <div className="flex items-center gap-2">
                    <label className="text-sm font-medium text-gray-600 dark:text-gray-400">{t('list')}:</label>
                    <CustomSelect
                        value={filterList}
                        onChange={(v) => { setFilterList(v); setCurrentPage(1); }}
                        searchable={uniqueLists.length > 5}
                        panelWidth="w-52"
                        options={[
                            { value: 'all', label: t('allLists') },
                            ...uniqueLists.map(lst => ({ value: lst, label: lst })),
                        ]}
                    />
                </div>

                <div className="ml-auto text-sm text-gray-500 dark:text-gray-400 font-medium">
                    {totalFiltered} {t('contactsFound')}
                </div>
            </div>

            {isLoading ? (
                <div className="mt-4"><TableSkeleton rows={8} columns={9} /></div>
            ) : (
            <div className="bg-white dark:bg-zinc-900 border border-gray-100 dark:border-zinc-800 rounded-xl overflow-hidden shadow-sm">
                <div className="overflow-x-auto">
                    <table className="w-full text-left text-sm">
                        <thead className="bg-gray-50 dark:bg-zinc-800/50 text-gray-500 dark:text-gray-400 font-semibold text-xs tracking-wider uppercase select-none">
                            <tr>
                                <th className="p-4 border-b border-gray-100 dark:border-zinc-800 w-10">
                                    <input
                                        type="checkbox"
                                        className="rounded border-gray-300 text-emerald-600 shadow-sm focus:border-emerald-300 focus:ring focus:ring-emerald-200 focus:ring-opacity-50 dark:border-zinc-600 dark:bg-zinc-700 dark:checked:bg-emerald-500"
                                        checked={processedContacts.length > 0 && selectedContacts.length === processedContacts.length}
                                        onChange={handleSelectAll}
                                    />
                                </th>
                                <th
                                    className="px-6 py-4 border-b border-gray-100 dark:border-zinc-800 cursor-pointer hover:bg-gray-100 dark:hover:bg-zinc-700/50 transition-colors"
                                    onClick={() => handleSort('id')}
                                >
                                    <div className="flex items-center gap-1">{t('id')} {sortField === 'id' && (sortDirection === 'asc' ? '↑' : '↓')}</div>
                                </th>
                                <th
                                    className="px-6 py-4 border-b border-gray-100 dark:border-zinc-800 cursor-pointer hover:bg-gray-100 dark:hover:bg-zinc-700/50 transition-colors"
                                    onClick={() => handleSort('name')}
                                >
                                    <div className="flex items-center gap-1">{t('name')} {sortField === 'name' && (sortDirection === 'asc' ? '↑' : '↓')}</div>
                                </th>
                                <th className="px-6 py-4 border-b border-gray-100 dark:border-zinc-800">{t('phone')}</th>
                                <th className="px-6 py-4 border-b border-gray-100 dark:border-zinc-800">{t('email')}</th>
                                <th className="px-6 py-4 border-b border-gray-100 dark:border-zinc-800">{t('address')}</th>
                                <th className="px-6 py-4 border-b border-gray-100 dark:border-zinc-800">{t('list')}</th>
                                <th className="px-6 py-4 border-b border-gray-100 dark:border-zinc-800">{t('segment')}</th>
                                <th className="px-6 py-4 border-b border-gray-100 dark:border-zinc-800 text-right min-w-[150px]">{t('action')}</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100 dark:divide-zinc-800 text-gray-800 dark:text-zinc-200">
                            {contactsOnPage.length === 0 ? (
                                <tr>
                                    <td colSpan="9" className="px-6 py-12 text-center text-gray-500 dark:text-zinc-500">
                                        {t('noContactsFound')}
                                    </td>
                                </tr>
                            ) : contactsOnPage.map((contact) => (
                                <tr key={contact.id} className="hover:bg-gray-50/50 dark:hover:bg-zinc-800/30 transition-colors">
                                    <td className="p-4">
                                        <input
                                            type="checkbox"
                                            className="rounded border-gray-300 text-emerald-600 shadow-sm focus:border-emerald-300 focus:ring focus:ring-emerald-200 focus:ring-opacity-50 dark:border-zinc-600 dark:bg-zinc-700 dark:checked:bg-emerald-500"
                                            checked={selectedContacts.includes(contact.id)}
                                            onChange={() => handleSelectContact(contact.id)}
                                        />
                                    </td>
                                    <td className="px-6 py-4 text-gray-500 dark:text-zinc-400">#{contact.id}</td>
                                    <td className="px-6 py-4 font-medium flex items-center gap-2 max-w-[250px] truncate" title={contact.name}>
                                        <span className="truncate">{contact.name}</span>
                                        {contactStatus[contact.id] === 'loading' && <svg className="animate-spin h-3 w-3 flex-shrink-0 text-gray-400" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>}

                                        {/* Show live status if available, else DB status */}
                                        {(contactStatus[contact.id] === 'valid' || (!contactStatus[contact.id] && contact.status === 'valid')) && <span className="bg-green-100 flex-shrink-0 text-green-700 text-[10px] px-1.5 py-0.5 rounded-full font-bold">✓ WA</span>}
                                        {(contactStatus[contact.id] === 'invalid' || (!contactStatus[contact.id] && contact.status === 'invalid')) && <span className="bg-red-100 flex-shrink-0 text-red-700 text-[10px] px-1.5 py-0.5 rounded-full font-bold">✗ N/A</span>}
                                        {contactStatus[contact.id] === 'error' && <span className="text-yellow-500 flex-shrink-0 text-xs" title="API Error">⚠️</span>}
                                    </td>
                                    <td className="px-6 py-4 font-mono text-gray-600 dark:text-gray-400">{contact.phone}</td>
                                    <td className="px-6 py-4 text-gray-500 dark:text-gray-400 text-xs truncate max-w-[180px]" title={contact.email || ''}>{contact.email || '-'}</td>
                                    <td className="px-6 py-4 text-gray-500 dark:text-gray-400 text-xs truncate max-w-[160px]" title={contact.address || ''}>{contact.address || '-'}</td>
                                    <td className="px-6 py-4 text-gray-600 dark:text-gray-400 text-xs truncate max-w-[120px]" title={contact.list_name || ''}>{contact.list_name || '-'}</td>
                                    <td className="px-6 py-4 text-gray-600 dark:text-gray-400 text-xs">{contact.segment_name || '-'}</td>
                                    <td className="px-6 py-4 text-right">
                                        <button
                                            onClick={() => handleOpenChat(contact.phone, contact.id)}
                                            disabled={openingChatFor === contact.id || isAnalyzing}
                                            className={`text-emerald-600 hover:text-emerald-800 dark:text-emerald-400 dark:hover:text-emerald-300 font-medium text-xs bg-emerald-50 dark:bg-emerald-900/20 px-3 py-1.5 rounded-md transition-all flex items-center justify-center gap-1 ml-auto ${isAnalyzing ? 'opacity-40 cursor-not-allowed' : 'disabled:opacity-50'
                                                }`}
                                            title={isAnalyzing ? 'Analyse en cours...' : 'Contacter sur WhatsApp'}
                                        >
                                            {openingChatFor === contact.id ? (
                                                <svg className="animate-spin h-3 w-3" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
                                            ) : (
                                                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"></path></svg>
                                            )}
                                            {openingChatFor === contact.id ? 'Ouverture...' : 'Contacter'}
                                        </button>
                                        <div className="flex justify-end gap-2 mt-2">
                                            <button
                                                onClick={() => navigate('/wa/contacts/edit/' + contact.id)}
                                                disabled={isAnalyzing}
                                                className={`text-emerald-600 hover:text-emerald-800 dark:text-emerald-400 dark:hover:text-emerald-300 font-medium text-xs bg-emerald-50 dark:bg-emerald-900/20 px-3 py-1.5 rounded-md transition-colors ${isAnalyzing ? 'opacity-40 cursor-not-allowed' : ''}`}
                                            >
                                                {t('edit')}
                                            </button>
                                            <button
                                                onClick={() => handleDelete(contact.id)}
                                                disabled={isAnalyzing}
                                                className={`text-red-600 hover:text-red-800 dark:text-red-400 dark:hover:text-red-300 font-medium text-xs bg-red-50 dark:bg-red-900/20 px-3 py-1.5 rounded-md transition-colors ${isAnalyzing ? 'opacity-40 cursor-not-allowed' : ''}`}
                                            >
                                                {t('delete')}
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>

                {totalPages > 1 && (
                    <div className="flex justify-between items-center p-4 border-t border-gray-100 dark:border-zinc-800 text-sm text-gray-500 dark:text-gray-400">
                        <span>{t('showing')} {(currentPage - 1) * itemsPerPage + 1} {t('to')} {Math.min(currentPage * itemsPerPage, totalFiltered)} {t('of')} {totalFiltered} {t('entries')}</span>
                        <div className="flex gap-2">
                            <button
                                onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                                disabled={currentPage === 1}
                                className="px-3 py-1 border border-gray-200 dark:border-zinc-700 rounded hover:bg-gray-50 dark:hover:bg-zinc-800 disabled:opacity-50 transition-colors"
                            >
                                {t('previous')}
                            </button>
                            <button
                                onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                                disabled={currentPage === totalPages}
                                className="px-3 py-1 border border-gray-200 dark:border-zinc-700 rounded hover:bg-gray-50 dark:hover:bg-zinc-800 disabled:opacity-50 transition-colors"
                            >
                                {t('next')}
                            </button>
                        </div>
                    </div>
                )}

                {contacts.length > 0 && (
                    <div className="p-4 border-t border-gray-100 dark:border-zinc-800 bg-gray-50/50 dark:bg-zinc-900/50 flex justify-end">
                        <button
                            onClick={handleAnalyze}
                            disabled={isAnalyzing}
                            className="bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed text-white px-5 py-2.5 rounded-lg font-medium text-sm flex items-center gap-2 transition-colors shadow-sm"
                        >
                            {isAnalyzing ? (
                                <svg className="animate-spin h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
                                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                </svg>
                            ) : (
                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path><polyline points="22 4 12 14.01 9 11.01"></polyline></svg>
                            )}
                            {t('analyzeContact')}
                        </button>
                    </div>
                )}
            </div>
            )}

            {/* Bulk Edit Modal */}
            {isBulkEditModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
                    <div className="bg-white dark:bg-zinc-900 rounded-2xl shadow-xl w-full max-w-md overflow-hidden animate-in fade-in zoom-in duration-200">
                        <div className="p-6">
                            <div className="flex justify-between items-start mb-4">
                                <div>
                                    <h3 className="text-xl font-bold text-gray-900 dark:text-white">{t('bulkEditSegment')}</h3>
                                    <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">{t('bulkEditSegmentDesc')}</p>
                                </div>
                                <button
                                    onClick={() => setIsBulkEditModalOpen(false)}
                                    className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
                                >
                                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
                                </button>
                            </div>

                            <form onSubmit={handleBulkUpdate} className="space-y-4">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{t('selectNewSegment')}</label>
                                    <select
                                        className="w-full bg-gray-50 border border-gray-200 text-gray-900 text-sm rounded-lg focus:ring-emerald-500 focus:border-emerald-500 block p-2.5 dark:bg-zinc-800 dark:border-zinc-700 dark:placeholder-gray-400 dark:text-white transition-colors"
                                        value={bulkSegmentId}
                                        onChange={(e) => setBulkSegmentId(e.target.value)}
                                        required
                                    >
                                        <option value="">{t('chooseSegment')}</option>
                                        {allSegments.map(s => (
                                            <option key={s.id} value={s.id}>{s.name}</option>
                                        ))}
                                    </select>
                                </div>

                                <div className="pt-2 flex gap-3">
                                    <button
                                        type="button"
                                        onClick={() => setIsBulkEditModalOpen(false)}
                                        className="flex-1 text-gray-700 bg-gray-100 hover:bg-gray-200 dark:text-gray-300 dark:bg-zinc-800 dark:hover:bg-zinc-700 focus:ring-4 focus:outline-none focus:ring-gray-300 font-medium rounded-lg text-sm px-5 py-2.5 text-center transition-colors"
                                    >
                                        {t('cancel')}
                                    </button>
                                    <button
                                        type="submit"
                                        disabled={isSubmittingBulk}
                                        className="flex-1 text-white bg-[#0b9f84] hover:bg-[#088b73] focus:ring-4 focus:outline-none focus:ring-[#0b9f84]/50 font-medium rounded-lg text-sm px-5 py-2.5 text-center transition-colors disabled:opacity-50"
                                    >
                                        {isSubmittingBulk ? t('updating') : t('update')}
                                    </button>
                                </div>
                            </form>
                        </div>
                    </div>
                </div>
            )}

            {/* Bulk Edit List Modal */}
            {isBulkListEditModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
                    <div className="bg-white dark:bg-zinc-900 rounded-2xl shadow-xl w-full max-w-md overflow-hidden animate-in fade-in zoom-in duration-200">
                        <div className="p-6">
                            <div className="flex justify-between items-start mb-4">
                                <div>
                                    <h3 className="text-xl font-bold text-gray-900 dark:text-white">{t('bulkEditList')}</h3>
                                    <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">{t('bulkEditListDesc')}</p>
                                </div>
                                <button
                                    onClick={() => setIsBulkListEditModalOpen(false)}
                                    className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
                                >
                                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
                                </button>
                            </div>

                            <form onSubmit={handleBulkUpdateList} className="space-y-4">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{t('selectNewList')}</label>
                                    <select
                                        className="w-full bg-gray-50 border border-gray-200 text-gray-900 text-sm rounded-lg focus:ring-emerald-500 focus:border-emerald-500 block p-2.5 dark:bg-zinc-800 dark:border-zinc-700 dark:placeholder-gray-400 dark:text-white transition-colors"
                                        value={bulkListId}
                                        onChange={(e) => setBulkListId(e.target.value)}
                                        required
                                    >
                                        <option value="">{t('chooseList')}</option>
                                        {allLists.map(l => (
                                            <option key={l.id} value={l.id}>{l.name}</option>
                                        ))}
                                    </select>
                                </div>

                                <div className="pt-2 flex gap-3">
                                    <button
                                        type="button"
                                        onClick={() => setIsBulkListEditModalOpen(false)}
                                        className="flex-1 text-gray-700 bg-gray-100 hover:bg-gray-200 dark:text-gray-300 dark:bg-zinc-800 dark:hover:bg-zinc-700 focus:ring-4 focus:outline-none focus:ring-gray-300 font-medium rounded-lg text-sm px-5 py-2.5 text-center transition-colors"
                                    >
                                        {t('cancel')}
                                    </button>
                                    <button
                                        type="submit"
                                        disabled={isSubmittingBulk}
                                        className="flex-1 text-white bg-[#0b9f84] hover:bg-[#088b73] focus:ring-4 focus:outline-none focus:ring-[#0b9f84]/50 font-medium rounded-lg text-sm px-5 py-2.5 text-center transition-colors disabled:opacity-50"
                                    >
                                        {isSubmittingBulk ? t('updating') : t('update')}
                                    </button>
                                </div>
                            </form>
                        </div>
                    </div>
                </div>
            )}

            {/* Dynamic Template Modal */}
            {isTemplateModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
                    <div className="bg-white dark:bg-zinc-900 rounded-2xl shadow-xl w-full max-w-lg overflow-hidden animate-in fade-in zoom-in duration-200">
                        <div className="p-6">
                            <div className="flex justify-between items-start mb-4">
                                <div>
                                    <h3 className="text-xl font-bold text-gray-900 dark:text-white">{t('messageTemplate')}</h3>
                                    <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">{t('configAutoMessage')}</p>
                                </div>
                                <button
                                    onClick={() => setIsTemplateModalOpen(false)}
                                    className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
                                >
                                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
                                </button>
                            </div>

                            <form onSubmit={handleSaveTemplate} className="space-y-4">
                                <div>
                                    <textarea
                                        ref={templateTextareaRef}
                                        value={dynamicTemplate}
                                        onChange={(e) => setDynamicTemplate(e.target.value)}
                                        rows={5}
                                        placeholder="Bonjour [Nom], merci pour l'intérêt que vous portez à nos services..."
                                        className="w-full bg-gray-50 border border-gray-200 text-gray-900 text-sm rounded-lg focus:ring-emerald-500 focus:border-emerald-500 block p-3 dark:bg-zinc-800 dark:border-zinc-700 dark:placeholder-gray-400 dark:text-white transition-colors outline-none resize-none"
                                    ></textarea>
                                    <div className="flex flex-wrap items-center gap-2 mt-2">
                                        <span className="text-xs text-gray-500 dark:text-gray-400">Cliquez pour insérer :</span>
                                        <button type="button" onClick={() => insertVariable('[Nom]')} className="text-[11px] bg-gray-100 dark:bg-zinc-800 px-2 py-1 rounded text-emerald-600 dark:text-emerald-400 font-mono hover:bg-gray-200 dark:hover:bg-zinc-700 transition">[Nom]</button>
                                        <button type="button" onClick={() => insertVariable('[Email]')} className="text-[11px] bg-gray-100 dark:bg-zinc-800 px-2 py-1 rounded text-emerald-600 dark:text-emerald-400 font-mono hover:bg-gray-200 dark:hover:bg-zinc-700 transition">[Email]</button>
                                        <button type="button" onClick={() => insertVariable('[Adresse]')} className="text-[11px] bg-gray-100 dark:bg-zinc-800 px-2 py-1 rounded text-emerald-600 dark:text-emerald-400 font-mono hover:bg-gray-200 dark:hover:bg-zinc-700 transition">[Adresse]</button>
                                    </div>
                                </div>

                                <div className="pt-2 flex gap-3">
                                    <button
                                        type="button"
                                        onClick={() => setIsTemplateModalOpen(false)}
                                        className="flex-1 text-gray-700 bg-gray-100 hover:bg-gray-200 dark:text-gray-300 dark:bg-zinc-800 dark:hover:bg-zinc-700 focus:ring-4 focus:outline-none focus:ring-gray-300 font-medium rounded-lg text-sm px-5 py-2.5 text-center transition-colors"
                                    >
                                        {t('cancel')}
                                    </button>
                                    <button
                                        type="submit"
                                        disabled={isSavingTemplate}
                                        className="flex-1 text-white bg-emerald-600 hover:bg-emerald-700 focus:ring-4 focus:outline-none focus:ring-emerald-300 font-medium rounded-lg text-sm px-5 py-2.5 text-center transition-colors disabled:opacity-50"
                                    >
                                        {isSavingTemplate ? t('saving') : t('saveTemplate')}
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
