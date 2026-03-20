import React, { useState, useEffect, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import useAppStore from '../../store';

export default function Contacts({ activeId }) {
    const [contacts, setContacts] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isAnalyzing, setIsAnalyzing] = useState(false);
    const [contactStatus, setContactStatus] = useState({});
    const [currentPage, setCurrentPage] = useState(1);
    const [sortField, setSortField] = useState('id');
    const [sortDirection, setSortDirection] = useState('desc');
    const [filterStatus, setFilterStatus] = useState('all');
    const [filterSegment, setFilterSegment] = useState('all');

    // Bulk Actions State
    const [selectedContacts, setSelectedContacts] = useState([]);
    const [isBulkEditModalOpen, setIsBulkEditModalOpen] = useState(false);
    const [bulkSegmentId, setBulkSegmentId] = useState('');
    const [isSubmittingBulk, setIsSubmittingBulk] = useState(false);

    const itemsPerPage = 10;

    const navigate = useNavigate();
    const showAppNotification = useAppStore(state => state.showAppNotification);
    const fileInputRef = useRef(null);

    const fetchContacts = async () => {
        try {
            const res = await fetch('http://localhost:3000/api/wa/contacts');
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

    useEffect(() => {
        fetchContacts();
    }, []);

    const handleDelete = async (id) => {
        if (!window.confirm("Are you sure you want to delete this contact?")) return;

        try {
            // Note: Currently no backend delete route written, simulating for UI
            // await fetch(`http://localhost:3000/api/wa/contacts/${id}`, { method: 'DELETE' });
            setContacts(contacts.filter(c => c.id !== id));
            showAppNotification('Contact deleted locally (Backend route pending)', 'success');
        } catch (error) {
            showAppNotification('Failed to delete contact', 'error');
        }
    };

    // Derive unique segments for the filter dropdown
    const uniqueSegments = [...new Set(contacts.map(c => c.segment_name).filter(Boolean))];
    // Also get segments with IDs for bulk update modal
    const segments = [...new Map(contacts.filter(c => c.segment_name && c.segment_id).map(item => [item.segment_id, { id: item.segment_id, name: item.segment_name }])).values()];


    // Apply filtering
    let processedContacts = contacts.filter(c => {
        let matchStatus = true;
        let matchSegment = true;

        // Status filter: unverified, valid, invalid
        if (filterStatus !== 'all') {
            matchStatus = (c.status || 'unverified') === filterStatus;
        }

        // Segment filter
        if (filterSegment !== 'all') {
            matchSegment = c.segment_name === filterSegment;
        }

        return matchStatus && matchSegment;
    });

    // Apply sorting
    processedContacts.sort((a, b) => {
        let valA = a[sortField];
        let valB = b[sortField];

        if (typeof valA === 'string') valA = valA.toLowerCase();
        if (typeof valB === 'string') valB = valB.toLowerCase();

        let comparison = 0;
        if (valA < valB) comparison = -1;
        if (valA > valB) comparison = 1;
        return sortDirection === 'asc' ? comparison : -comparison;
    });

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
            const res = await fetch('http://localhost:3000/api/wa/contacts/bulk-delete', {
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
            const res = await fetch('http://localhost:3000/api/wa/contacts/bulk-update', {
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

        setIsAnalyzing(true);
        let validCount = 0;
        let invalidCount = 0;

        for (const contact of contactsOnPage) {
            setContactStatus(prev => ({ ...prev, [contact.id]: 'loading' }));
            try {
                const rawPhone = contact.phone ? contact.phone.toString().replace(/[^0-9]/g, '') : '';

                // If it's empty or totally invalid, immediately flag it and skip
                if (!rawPhone || rawPhone.length < 5) {
                    invalidCount++;
                    setContactStatus(prev => ({ ...prev, [contact.id]: 'invalid' }));
                    continue;
                }

                const res = await fetch('http://localhost:3000/api/wa/verify-contact', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        instance_id: activeId,
                        phone: rawPhone
                    })
                });

                const data = await res.json();
                if (data.status === 'success') {
                    if (data.is_valid) {
                        validCount++;
                        setContactStatus(prev => ({ ...prev, [contact.id]: 'valid' }));
                    } else {
                        invalidCount++;
                        setContactStatus(prev => ({ ...prev, [contact.id]: 'invalid' }));
                    }
                } else {
                    setContactStatus(prev => ({ ...prev, [contact.id]: 'error' }));
                }
            } catch (err) {
                console.error("Error analyzing contact", contact.name, err);
                setContactStatus(prev => ({ ...prev, [contact.id]: 'error' }));
            }
        }

        setIsAnalyzing(false);
        showAppNotification(`Page Analysis: ${validCount} valid WhatsApp numbers found, ${invalidCount} invalid/missing.`, 'success');
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
            const res = await fetch('http://localhost:3000/api/wa/open-chat', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ instance_id: activeId, phone: rawPhone })
            });
            const data = await res.json();
            if (data.status === 'success') {
                showAppNotification('Ouverture de la conversation WhatsApp...', 'success');
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
                        Back to dashboard
                    </Link>
                    <h1 className="text-3xl font-extrabold text-gray-900 dark:text-white tracking-tight">Contacts</h1>
                </div>
                <div className="flex items-center gap-3">
                    {selectedContacts.length > 0 && (
                        <div className="flex items-center gap-2 bg-blue-50 dark:bg-blue-900/20 px-3 py-1.5 rounded-lg border border-blue-100 dark:border-blue-800/50">
                            <span className="text-sm font-medium text-blue-700 dark:text-blue-400">
                                {selectedContacts.length} selected
                            </span>
                            <div className="h-4 w-px bg-blue-200 dark:bg-blue-800 mx-1"></div>
                            <button
                                onClick={() => setIsBulkEditModalOpen(true)}
                                className="text-sm font-medium text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300 transition-colors"
                            >
                                Edit Segment
                            </button>
                            <button
                                onClick={handleBulkDelete}
                                className="text-sm font-medium text-red-600 hover:text-red-800 dark:text-red-400 dark:hover:text-red-300 transition-colors ml-2"
                            >
                                Delete All
                            </button>
                        </div>
                    )}
                    <button
                        onClick={() => navigate('/wa/contacts/import')}
                        className="bg-white hover:bg-gray-50 text-gray-700 dark:bg-zinc-800 dark:hover:bg-zinc-700 dark:text-gray-200 border border-gray-200 dark:border-zinc-700 px-4 py-2 rounded-lg font-medium text-sm transition-colors shadow-sm"
                    >
                        Import Contact
                    </button>
                    <button
                        onClick={() => navigate('/wa/contacts/add')}
                        className="bg-gray-900 hover:bg-gray-800 dark:bg-white dark:hover:bg-gray-200 dark:text-gray-900 text-white px-4 py-2 rounded-lg font-medium text-sm flex items-center gap-2 transition-colors shadow-sm"
                    >
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 5v14M5 12h14" /></svg>
                        Add New Contact
                    </button>
                </div>
            </div>

            {/* Filters Bar */}
            <div className="flex flex-wrap gap-4 items-center bg-white dark:bg-zinc-900 p-4 border border-gray-100 dark:border-zinc-800 rounded-xl shadow-sm">
                <div className="flex items-center gap-2">
                    <label className="text-sm font-medium text-gray-600 dark:text-gray-400">Status:</label>
                    <select
                        value={filterStatus}
                        onChange={(e) => { setFilterStatus(e.target.value); setCurrentPage(1); }}
                        className="bg-gray-50 dark:bg-zinc-800 border border-gray-200 dark:border-zinc-700 text-gray-800 dark:text-gray-200 text-sm rounded-lg py-1.5 px-3 focus:ring-emerald-500 focus:border-emerald-500 outline-none"
                    >
                        <option value="all">All</option>
                        <option value="valid">✅ Valid</option>
                        <option value="invalid">❌ Invalid (N/A)</option>
                        <option value="unverified">⏱️ Unverified</option>
                    </select>
                </div>

                <div className="flex items-center gap-2">
                    <label className="text-sm font-medium text-gray-600 dark:text-gray-400">Segment:</label>
                    <select
                        value={filterSegment}
                        onChange={(e) => { setFilterSegment(e.target.value); setCurrentPage(1); }}
                        className="bg-gray-50 dark:bg-zinc-800 border border-gray-200 dark:border-zinc-700 text-gray-800 dark:text-gray-200 text-sm rounded-lg py-1.5 px-3 focus:ring-emerald-500 focus:border-emerald-500 outline-none max-w-[200px]"
                    >
                        <option value="all">All Segments</option>
                        {uniqueSegments.map(seg => (
                            <option key={seg} value={seg}>{seg}</option>
                        ))}
                    </select>
                </div>

                <div className="ml-auto text-sm text-gray-500 dark:text-gray-400 font-medium">
                    {totalFiltered} Contacts Found
                </div>
            </div>

            <div className="bg-white dark:bg-zinc-900 border border-gray-100 dark:border-zinc-800 rounded-xl overflow-hidden shadow-sm">
                <div className="overflow-x-auto">
                    <table className="w-full text-left text-sm">
                        <thead className="bg-gray-50 dark:bg-zinc-800/50 text-gray-500 dark:text-gray-400 font-semibold text-xs tracking-wider uppercase select-none">
                            <tr>
                                <th className="p-4 border-b border-gray-100 dark:border-zinc-800 w-10">
                                    <input
                                        type="checkbox"
                                        className="rounded border-gray-300 text-blue-600 shadow-sm focus:border-blue-300 focus:ring focus:ring-blue-200 focus:ring-opacity-50 dark:border-zinc-600 dark:bg-zinc-700 dark:checked:bg-blue-500"
                                        checked={processedContacts.length > 0 && selectedContacts.length === processedContacts.length}
                                        onChange={handleSelectAll}
                                    />
                                </th>
                                <th
                                    className="px-6 py-4 border-b border-gray-100 dark:border-zinc-800 cursor-pointer hover:bg-gray-100 dark:hover:bg-zinc-700/50 transition-colors"
                                    onClick={() => handleSort('id')}
                                >
                                    <div className="flex items-center gap-1">ID {sortField === 'id' && (sortDirection === 'asc' ? '↑' : '↓')}</div>
                                </th>
                                <th
                                    className="px-6 py-4 border-b border-gray-100 dark:border-zinc-800 cursor-pointer hover:bg-gray-100 dark:hover:bg-zinc-700/50 transition-colors"
                                    onClick={() => handleSort('name')}
                                >
                                    <div className="flex items-center gap-1">Name {sortField === 'name' && (sortDirection === 'asc' ? '↑' : '↓')}</div>
                                </th>
                                <th className="px-6 py-4 border-b border-gray-100 dark:border-zinc-800">Phone</th>
                                <th className="px-6 py-4 border-b border-gray-100 dark:border-zinc-800">Segment</th>
                                <th className="px-6 py-4 border-b border-gray-100 dark:border-zinc-800 text-right min-w-[150px]">Action</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100 dark:divide-zinc-800 text-gray-800 dark:text-zinc-200">
                            {isLoading ? (
                                <tr>
                                    <td colSpan="6" className="px-6 py-12 text-center text-gray-500 dark:text-zinc-500">
                                        Loading contacts...
                                    </td>
                                </tr>
                            ) : contactsOnPage.length === 0 ? (
                                <tr>
                                    <td colSpan="6" className="px-6 py-12 text-center text-gray-500 dark:text-zinc-500">
                                        No contacts found.
                                    </td>
                                </tr>
                            ) : contactsOnPage.map((contact) => (
                                <tr key={contact.id} className="hover:bg-gray-50/50 dark:hover:bg-zinc-800/30 transition-colors">
                                    <td className="p-4">
                                        <input
                                            type="checkbox"
                                            className="rounded border-gray-300 text-blue-600 shadow-sm focus:border-blue-300 focus:ring focus:ring-blue-200 focus:ring-opacity-50 dark:border-zinc-600 dark:bg-zinc-700 dark:checked:bg-blue-500"
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
                                    <td className="px-6 py-4 text-gray-600 dark:text-gray-400 text-xs">{contact.segment_name || '-'}</td>
                                    <td className="px-6 py-4 text-right">
                                        <button
                                            onClick={() => handleOpenChat(contact.phone, contact.id)}
                                            disabled={openingChatFor === contact.id}
                                            className="text-emerald-600 hover:text-emerald-800 dark:text-emerald-400 dark:hover:text-emerald-300 font-medium text-xs bg-emerald-50 dark:bg-emerald-900/20 px-3 py-1.5 rounded-md transition-all flex items-center justify-center gap-1 ml-auto disabled:opacity-50"
                                            title="Contacter sur WhatsApp"
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
                                                className="text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300 font-medium text-xs bg-blue-50 dark:bg-blue-900/20 px-3 py-1.5 rounded-md transition-colors"
                                            >
                                                Edit
                                            </button>
                                            <button
                                                onClick={() => handleDelete(contact.id)}
                                                className="text-red-600 hover:text-red-800 dark:text-red-400 dark:hover:text-red-300 font-medium text-xs bg-red-50 dark:bg-red-900/20 px-3 py-1.5 rounded-md transition-colors"
                                            >
                                                Delete
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
                        <span>Showing {(currentPage - 1) * itemsPerPage + 1} to {Math.min(currentPage * itemsPerPage, totalFiltered)} of {totalFiltered} entries</span>
                        <div className="flex gap-2">
                            <button
                                onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                                disabled={currentPage === 1}
                                className="px-3 py-1 border border-gray-200 dark:border-zinc-700 rounded hover:bg-gray-50 dark:hover:bg-zinc-800 disabled:opacity-50 transition-colors"
                            >
                                Précédent
                            </button>
                            <button
                                onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                                disabled={currentPage === totalPages}
                                className="px-3 py-1 border border-gray-200 dark:border-zinc-700 rounded hover:bg-gray-50 dark:hover:bg-zinc-800 disabled:opacity-50 transition-colors"
                            >
                                Suivant
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
                            Analyse Contact
                        </button>
                    </div>
                )}
            </div>

            {/* Bulk Edit Modal */}
            {isBulkEditModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
                    <div className="bg-white dark:bg-zinc-900 rounded-2xl shadow-xl w-full max-w-md overflow-hidden animate-in fade-in zoom-in duration-200">
                        <div className="p-6">
                            <div className="flex justify-between items-start mb-4">
                                <div>
                                    <h3 className="text-xl font-bold text-gray-900 dark:text-white">Bulk Edit Segment</h3>
                                    <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Update the segment for {selectedContacts.length} selected contacts.</p>
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
                                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Select New Segment</label>
                                    <select
                                        className="w-full bg-gray-50 border border-gray-200 text-gray-900 text-sm rounded-lg focus:ring-blue-500 focus:border-blue-500 block p-2.5 dark:bg-zinc-800 dark:border-zinc-700 dark:placeholder-gray-400 dark:text-white transition-colors"
                                        value={bulkSegmentId}
                                        onChange={(e) => setBulkSegmentId(e.target.value)}
                                        required
                                    >
                                        <option value="">Choose a segment</option>
                                        {segments.map(s => (
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
                                        Cancel
                                    </button>
                                    <button
                                        type="submit"
                                        disabled={isSubmittingBulk}
                                        className="flex-1 text-white bg-blue-600 hover:bg-blue-700 focus:ring-4 focus:outline-none focus:ring-blue-300 font-medium rounded-lg text-sm px-5 py-2.5 text-center transition-colors disabled:opacity-50"
                                    >
                                        {isSubmittingBulk ? 'Updating...' : 'Update'}
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
