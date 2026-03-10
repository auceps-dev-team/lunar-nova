import React, { useState, useEffect, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import useAppStore from '../../store';

export default function Contacts({ activeId }) {
    const [contacts, setContacts] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isAnalyzing, setIsAnalyzing] = useState(false);

    const navigate = useNavigate();
    const setAppNotification = useAppStore(state => state.setAppNotification);
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
            setAppNotification({ msg: 'Failed to load contacts', type: 'error' });
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
            setAppNotification({ msg: 'Contact deleted locally (Backend route pending)', type: 'success' });
        } catch (error) {
            setAppNotification({ msg: 'Failed to delete contact', type: 'error' });
        }
    };

    const handleAnalyze = async () => {
        if (!activeId) {
            setAppNotification({ msg: 'Please start a WhatsApp session first.', type: 'error' });
            return;
        }

        setIsAnalyzing(true);
        let validCount = 0;
        let invalidCount = 0;

        for (const contact of contacts) {
            try {
                // Strip spaces and the '+' for the WhatsApp link
                const rawPhone = contact.phone.replace(/[^0-9]/g, '');

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
                    if (data.is_valid) validCount++;
                    else invalidCount++;
                }
            } catch (err) {
                console.error("Error analyzing contact", contact.name, err);
            }
        }

        setIsAnalyzing(false);
        setAppNotification({
            msg: `Analysis Complete: ${validCount} valid WhatsApp numbers found, ${invalidCount} invalid/missing.`,
            type: 'success'
        });
    };

    const handleImportCSV = (e) => {
        const file = e.target.files?.[0];
        if (!file) return;
        // In a real app, parse the CSV and send to backend
        setAppNotification({ msg: `Selected file: ${file.name}. CSV Import logic pending.`, type: 'success' });
        e.target.value = ''; // reset
    };

    return (
        <div className="max-w-7xl mx-auto space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <Link to="/dashboard" className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 text-sm flex items-center gap-1 mb-2 transition-colors">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M15 18l-6-6 6-6" /></svg>
                        Back to dashboard
                    </Link>
                    <h1 className="text-3xl font-extrabold text-gray-900 dark:text-white tracking-tight">Contact</h1>
                </div>
                <div className="flex items-center gap-3">
                    <input
                        type="file"
                        accept=".csv"
                        ref={fileInputRef}
                        className="hidden"
                        onChange={handleImportCSV}
                    />
                    <button
                        onClick={() => fileInputRef.current?.click()}
                        className="bg-white hover:bg-gray-50 text-gray-700 dark:bg-zinc-800 dark:hover:bg-zinc-700 dark:text-gray-200 border border-gray-200 dark:border-zinc-700 px-4 py-2 rounded-lg font-medium text-sm transition-colors shadow-sm"
                    >
                        Import Contact
                    </button>
                    <button
                        onClick={() => navigate('/wa/contacts/add')}
                        className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg font-medium text-sm flex items-center gap-2 transition-colors shadow-sm"
                    >
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 5v14M5 12h14" /></svg>
                        Add New Contact
                    </button>
                </div>
            </div>

            <div className="bg-white dark:bg-zinc-900 border border-gray-100 dark:border-zinc-800 rounded-xl overflow-hidden shadow-sm">
                <div className="overflow-x-auto">
                    <table className="w-full text-left text-sm">
                        <thead className="bg-gray-50 dark:bg-zinc-800/50 text-gray-500 dark:text-gray-400 font-semibold text-xs tracking-wider uppercase">
                            <tr>
                                <th className="px-6 py-4 border-b border-gray-100 dark:border-zinc-800">ID</th>
                                <th className="px-6 py-4 border-b border-gray-100 dark:border-zinc-800">Name</th>
                                <th className="px-6 py-4 border-b border-gray-100 dark:border-zinc-800">Phone</th>
                                <th className="px-6 py-4 border-b border-gray-100 dark:border-zinc-800 text-right">Action</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100 dark:divide-zinc-800 text-gray-800 dark:text-zinc-200">
                            {isLoading ? (
                                <tr>
                                    <td colSpan="4" className="px-6 py-12 text-center text-gray-500 dark:text-zinc-500">
                                        Loading contacts...
                                    </td>
                                </tr>
                            ) : contacts.length === 0 ? (
                                <tr>
                                    <td colSpan="4" className="px-6 py-12 text-center text-gray-500 dark:text-zinc-500">
                                        No contacts found.
                                    </td>
                                </tr>
                            ) : contacts.map((contact) => (
                                <tr key={contact.id} className="hover:bg-gray-50/50 dark:hover:bg-zinc-800/30 transition-colors">
                                    <td className="px-6 py-4 text-gray-500 dark:text-zinc-400">#{contact.id}</td>
                                    <td className="px-6 py-4 font-medium">{contact.name}</td>
                                    <td className="px-6 py-4 font-mono text-gray-600 dark:text-gray-400">{contact.phone}</td>
                                    <td className="px-6 py-4 text-right space-x-2">
                                        <button
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
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>

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
        </div>
    );
}
