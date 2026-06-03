import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import useAppStore from '../store';
import { FileText, Trash2, Edit, Plus, Clock } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { API_BASE_URL } from '../config';
import { TableSkeleton } from '../components/ui/SkeletonLoader';


export default function MyDocuments() {
    const { t } = useTranslation();
    const showAppNotification = useAppStore(state => state.showAppNotification);
    const navigate = useNavigate();
    const [documents, setDocuments] = useState([]);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        fetchDocuments();
    }, []);

    const fetchDocuments = async () => {
        setIsLoading(true);
        try {
            const res = await fetch(API_BASE_URL + '/api/documents');
            const data = await res.json();
            if (data.status === 'success') {
                setDocuments(data.data || []);
            } else {
                showAppNotification(t('errorLoadDocuments'), 'error');
            }
        } catch (err) {
            console.error(err);
            showAppNotification(t('errorServerConnection'), 'error');
        } finally {
            setIsLoading(false);
        }
    };

    const handleDelete = async (id) => {
        if (!window.confirm(t('confirmDeleteDocument'))) return;

        try {
            const res = await fetch(`${API_BASE_URL}/api/documents/${id}`, {
                method: 'DELETE'
            });
            const data = await res.json();
            if (data.status === 'success') {
                showAppNotification(t('documentDeletedSuccess'), 'success');
                fetchDocuments();
            } else {
                showAppNotification(t('errorDelete'), 'error');
            }
        } catch (err) {
            console.error(err);
            showAppNotification(t('errorConnection'), 'error');
        }
    };

    const handleEdit = (id) => {
        // Rediriger vers AiWriter avec l'id du document pour édition
        navigate(`/ai-writer?docId=${id}`);
    };

    const formatDate = (dateString) => {
        const date = new Date(dateString);
        return date.toLocaleDateString('fr-FR', {
            day: 'numeric',
            month: 'short',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
    };

    return (
        <div className="flex flex-col h-full p-6">
            <div className="flex justify-between items-center mb-8">
                <div>
                    <h1 className="text-2xl font-bold text-gray-800 dark:text-gray-100 flex items-center gap-2">
                        <FileText className="text-[#0b9f84]" size={28} />
                        {t('myDocuments')}
                    </h1>
                    <p className="text-gray-500 dark:text-gray-400 mt-1">{t('manageAiContentDesc')}</p>
                </div>

                <Link to="/ai-writer" className="flex items-center gap-2 bg-[#0b9f84] hover:bg-[#0a8c73] text-white px-4 py-2.5 rounded-lg transition-colors font-medium shadow-sm">
                    <Plus size={18} />
                    {t('newDocument')}
                </Link>
            </div>

            <div className="flex-1 flex flex-col">
                {isLoading ? (
                    <div className="mt-4"><TableSkeleton rows={5} columns={3} /></div>
                ) : (
                <div className="flex-1 bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden flex flex-col">
                    <div className="overflow-x-auto">
                        <table className="w-full text-left border-collapse">
                        <thead>
                            <tr className="bg-gray-50 dark:bg-gray-700/50 border-b border-gray-200 dark:border-gray-700 text-gray-500 dark:text-gray-400 text-sm">
                                <th className="py-3 px-6 font-medium">{t('documentTitle')}</th>
                                <th className="py-3 px-6 font-medium w-[200px]">{t('lastModified')}</th>
                                <th className="py-3 px-6 font-medium w-[150px] text-right">{t('actions')}</th>
                            </tr>
                        </thead>
                        <tbody>
                            {documents.length === 0 ? (
                                <tr>
                                    <td colSpan="3" className="py-12 text-center">
                                        <div className="flex flex-col items-center justify-center text-gray-500">
                                            <FileText size={48} className="mb-4 text-gray-300 dark:text-gray-600" />
                                            <p>{t('noDocumentsYet')}</p>
                                            <Link to="/ai-writer" className="text-[#0b9f84] hover:underline mt-2">{t('createMyFirstDocument')}</Link>
                                        </div>
                                    </td>
                                </tr>
                            ) : (
                                documents.map(doc => (
                                    <tr key={doc.id} className="border-b border-gray-100 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors">
                                        <td className="py-4 px-6">
                                            <div className="font-medium text-gray-800 dark:text-gray-200 flex items-center gap-3">
                                                <div className="p-2 bg-emerald-50 dark:bg-emerald-900/20 rounded-lg text-[#0b9f84]">
                                                    <FileText size={18} />
                                                </div>
                                                {doc.title || t('untitledDoc')}
                                            </div>
                                        </td>
                                        <td className="py-4 px-6 text-sm text-gray-500 dark:text-gray-400 flex items-center gap-1.5 mt-2">
                                            <Clock size={14} />
                                            {formatDate(doc.updated_at || doc.created_at)}
                                        </td>
                                        <td className="py-4 px-6 text-right">
                                            <div className="flex items-center justify-end gap-2">
                                                <button
                                                    onClick={() => handleEdit(doc.id)}
                                                    className="p-1.5 text-gray-400 hover:text-[#0b9f84] hover:bg-emerald-50 dark:hover:bg-emerald-900/20 rounded-md transition-colors"
                                                    title={t('editAction')}
                                                >
                                                    <Edit size={18} />
                                                </button>
                                                <button
                                                    onClick={() => handleDelete(doc.id)}
                                                    className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-md transition-colors"
                                                    title={t('delete')}
                                                >
                                                    <Trash2 size={18} />
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                        </table>
                    </div>
                </div>
                )}
            </div>
        </div>
    );
}
