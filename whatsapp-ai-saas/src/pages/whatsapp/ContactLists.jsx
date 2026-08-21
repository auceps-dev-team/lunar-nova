import React, { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import useAppStore from '../../store';
import { API_BASE_URL } from '../../config';

import { useTranslation } from 'react-i18next';
import { TableSkeleton } from '../../components/ui/SkeletonLoader';

export default function ContactLists() {
    const { t } = useTranslation();
    const showAppNotification = useAppStore(state => state.showAppNotification);
    const [lists, setLists] = useState([]);
    const [isLoading, setIsLoading] = useState(true);

    // Modal State (create)
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [newListName, setNewListName] = useState('');
    const [newListStatus, setNewListStatus] = useState(true);
    const [isSubmitting, setIsSubmitting] = useState(false);

    // Edit Modal State
    const [editingList, setEditingList] = useState(null);
    const [editName, setEditName] = useState('');
    const [isEditSubmitting, setIsEditSubmitting] = useState(false);


    const fetchLists = useCallback(async () => {
        try {
            const res = await fetch(API_BASE_URL + '/api/wa/contact-lists');
            const data = await res.json();
            if (data.status === 'success') {
                setLists(data.data);
            }
        } catch (error) {
            console.error(error);
            showAppNotification(t('errorFetchLists'), 'error');
        } finally {
            setIsLoading(false);
        }
    }, [showAppNotification, t]);

    useEffect(() => {
        fetchLists();
    }, [fetchLists]);

    const handleAddList = async (e) => {
        e.preventDefault();
        if (!newListName.trim()) return;

        setIsSubmitting(true);
        try {
            const res = await fetch(API_BASE_URL + '/api/wa/contact-lists', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name: newListName })
            });
            const data = await res.json();
            if (data.status === 'success') {
                showAppNotification(t('successAction'), 'success');
                setLists([data.data, ...lists]);
                setIsModalOpen(false);
                setNewListName('');
                setNewListStatus(true);
            } else {
                throw new Error(data.error);
            }
        } catch (error) {
            console.error(error);
            showAppNotification(t('errorAddList'), 'error');
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleEditList = async (e) => {
        e.preventDefault();
        if (!editName.trim() || !editingList) return;

        setIsEditSubmitting(true);
        try {
            const res = await fetch(`${API_BASE_URL}/api/wa/contact-lists/${editingList.id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name: editName })
            });
            const data = await res.json();
            if (data.status === 'success') {
                showAppNotification(t('successAction'), 'success');
                setLists(lists.map(l => l.id === editingList.id ? data.data : l));
                setEditingList(null);
                setEditName('');
            } else {
                throw new Error(data.error);
            }
        } catch (error) {
            console.error(error);
            showAppNotification(t('errorUpdateList'), 'error');
        } finally {
            setIsEditSubmitting(false);
        }
    };

    const handleDeleteList = async (list) => {
        if (!window.confirm(t('deleteListConfirm', { name: list.name }))) return;
        try {
            const res = await fetch(`${API_BASE_URL}/api/wa/contact-lists/${list.id}`, { method: 'DELETE' });
            const data = await res.json();
            if (data.status === 'success') {
                showAppNotification(t('successAction'), 'success');
                setLists(lists.filter(l => l.id !== list.id));
            } else {
                throw new Error(data.error);
            }
        } catch (error) {
            console.error(error);
            showAppNotification(t('errorDeleteList'), 'error');
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
                    <h1 className="text-3xl font-extrabold text-gray-900 dark:text-white tracking-tight">{t('contactLists')}</h1>
                </div>
                <button
                    onClick={() => setIsModalOpen(true)}
                    className="bg-[#0b9f84] hover:bg-[#088b73] text-white px-4 py-2 rounded-lg font-medium text-sm flex items-center gap-2 transition-colors shadow-sm"
                >
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 5v14M5 12h14" /></svg>
                    {t('addContactList')}
                </button>
            </div>

            {isLoading ? (
                <div className="mt-4"><TableSkeleton rows={5} columns={3} /></div>
            ) : (
            <div className="bg-white dark:bg-zinc-900 border border-gray-100 dark:border-zinc-800 rounded-xl overflow-hidden shadow-sm">
                <div className="overflow-x-auto">
                    <table className="w-full text-left text-sm">
                        <thead className="bg-gray-50 dark:bg-zinc-800/50 text-gray-500 dark:text-gray-400 font-semibold text-xs tracking-wider uppercase">
                            <tr>
                                <th className="px-6 py-4 border-b border-gray-100 dark:border-zinc-800">{t('id')}</th>
                                <th className="px-6 py-4 border-b border-gray-100 dark:border-zinc-800">{t('name')}</th>
                                <th className="px-6 py-4 border-b border-gray-100 dark:border-zinc-800 text-right">{t('action')}</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100 dark:divide-zinc-800 text-gray-800 dark:text-zinc-200">
                            {lists.length === 0 ? (
                                <tr><td colSpan="3" className="px-6 py-12 text-center text-gray-500 dark:text-zinc-500">{t('noContactListsFound')}</td></tr>
                            ) : lists.map((list) => (
                                <tr key={list.id} className="hover:bg-gray-50/50 dark:hover:bg-zinc-800/30 transition-colors">
                                    <td className="px-6 py-4 text-gray-500 dark:text-zinc-400">#{list.id}</td>
                                    <td className="px-6 py-4 font-medium">{list.name}</td>
                                    <td className="px-6 py-4 text-right space-x-2">
                                        <button
                                            onClick={() => { setEditingList(list); setEditName(list.name); }}
                                            className="text-emerald-600 hover:text-emerald-800 dark:text-emerald-400 dark:hover:text-emerald-300 font-medium text-xs bg-emerald-50 dark:bg-emerald-900/20 px-3 py-1.5 rounded-md transition-colors"
                                        >{t('edit')}</button>
                                        <button
                                            onClick={() => handleDeleteList(list)}
                                            className="text-red-600 hover:text-red-800 dark:text-red-400 dark:hover:text-red-300 font-medium text-xs bg-red-50 dark:bg-red-900/20 px-3 py-1.5 rounded-md transition-colors"
                                        >{t('delete')}</button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
            )}

            {/* Create Contact List Modal */}
            {isModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
                    <div className="bg-white dark:bg-zinc-900 rounded-2xl shadow-xl w-full max-w-md overflow-hidden">
                        <div className="p-6">
                            <div className="flex justify-between items-start mb-4">
                                <div>
                                    <h3 className="text-xl font-bold text-gray-900 dark:text-white">{t('createContactList')}</h3>
                                    <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">{t('createContactListDesc')}</p>
                                </div>
                                <button onClick={() => setIsModalOpen(false)} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors">
                                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
                                </button>
                            </div>
                            <form onSubmit={handleAddList} className="space-y-4">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{t('contactListName')}</label>
                                    <input type="text" required autoFocus className="w-full bg-gray-50 border border-emerald-400 text-gray-900 text-sm rounded-lg focus:ring-emerald-500 focus:border-emerald-500 block p-2.5 dark:bg-zinc-800 dark:text-white outline-none transition-colors" value={newListName} onChange={(e) => setNewListName(e.target.value)} />
                                </div>
                                <div className="flex items-center gap-3 py-2">
                                    <button type="button" onClick={() => setNewListStatus(!newListStatus)} className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer items-center justify-center rounded-full transition-colors duration-200 ease-in-out ${newListStatus ? 'bg-emerald-500' : 'bg-gray-200 dark:bg-zinc-700'}`}>
                                        <span aria-hidden="true" className={`pointer-events-none absolute left-0 inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${newListStatus ? 'translate-x-4' : 'translate-x-0'}`}></span>
                                    </button>
                                    <span className="text-sm font-medium text-gray-600 dark:text-gray-400">{t('status')}</span>
                                </div>
                                <div className="pt-2">
                                    <button type="submit" disabled={isSubmitting} className="w-full text-white bg-emerald-500 hover:bg-emerald-600 font-medium rounded-lg text-sm px-5 py-2.5 text-center flex items-center justify-center gap-2 transition-colors disabled:opacity-50">
                                        {isSubmitting ? t('adding') : t('add')}
                                    </button>
                                </div>
                            </form>
                        </div>
                    </div>
                </div>
            )}

            {/* Edit Modal */}
            {editingList && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
                    <div className="bg-white dark:bg-zinc-900 rounded-2xl shadow-xl w-full max-w-md overflow-hidden">
                        <div className="p-6">
                            <div className="flex justify-between items-start mb-4">
                                <h3 className="text-xl font-bold text-gray-900 dark:text-white">{t('editList')}</h3>
                                <button onClick={() => setEditingList(null)} className="text-gray-400 hover:text-gray-600 transition-colors">
                                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
                                </button>
                            </div>
                            <form onSubmit={handleEditList} className="space-y-4">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{t('listName')}</label>
                                    <input type="text" required autoFocus className="w-full bg-gray-50 border border-emerald-400 text-gray-900 text-sm rounded-lg focus:ring-emerald-500 focus:border-emerald-500 block p-2.5 dark:bg-zinc-800 dark:text-white outline-none transition-colors" value={editName} onChange={(e) => setEditName(e.target.value)} />
                                </div>
                                <div className="pt-2 flex gap-3">
                                    <button type="button" onClick={() => setEditingList(null)} className="flex-1 text-gray-700 bg-gray-100 hover:bg-gray-200 dark:text-gray-300 dark:bg-zinc-800 dark:hover:bg-zinc-700 font-medium rounded-lg text-sm px-5 py-2.5 text-center transition-colors">{t('cancel')}</button>
                                    <button type="submit" disabled={isEditSubmitting} className="flex-1 text-white bg-[#0b9f84] hover:bg-[#088b73] font-medium rounded-lg text-sm px-5 py-2.5 text-center transition-colors disabled:opacity-50">{isEditSubmitting ? t('saving') : t('save')}</button>
                                </div>
                            </form>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
