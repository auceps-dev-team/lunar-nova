import React, { useState, useEffect } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import useAppStore from '../../store';

export default function ContactAdd() {
    const navigate = useNavigate();
    const { id } = useParams();
    const isEditMode = !!id;
    const showAppNotification = useAppStore(state => state.showAppNotification);

    const [formData, setFormData] = useState({
        name: '',
        phone: '',
        countryCode: '+1',
        listId: '',
        segmentId: ''
    });

    const [lists, setLists] = useState([{ id: '1', name: 'Clients VIP' }]); // Mock
    const [segments, setSegments] = useState([{ id: '1', name: 'Active Users' }]); // Mock
    const [isSaving, setIsSaving] = useState(false);
    const [isLoading, setIsLoading] = useState(isEditMode);

    useEffect(() => {
        if (isEditMode) {
            fetch(`http://localhost:3000/api/wa/contacts/${id}`)
                .then(res => res.json())
                .then(data => {
                    if (data.status === 'success') {
                        const contact = data.data;
                        // Naive split of country code + phone for edit mode
                        const parts = contact.phone ? contact.phone.split(' ') : [];
                        const countryCode = parts.length > 1 ? parts[0] : '+1';
                        const phone = parts.length > 1 ? parts.slice(1).join(' ') : (contact.phone || '');

                        setFormData({
                            name: contact.name || '',
                            phone: phone,
                            countryCode: countryCode,
                            listId: contact.list_id || '',
                            segmentId: contact.segment_id || ''
                        });
                    }
                })
                .catch(err => {
                    console.error(err);
                    showAppNotification('Failed to load contact data', 'error');
                })
                .finally(() => setIsLoading(false));
        }
    }, [id, showAppNotification]);

    const handleSubmit = async (e) => {
        e.preventDefault();
        setIsSaving(true);

        const method = isEditMode ? 'PUT' : 'POST';
        const url = isEditMode
            ? `http://localhost:3000/api/wa/contacts/${id}`
            : 'http://localhost:3000/api/wa/contacts';

        try {
            const res = await fetch(url, {
                method,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    name: formData.name,
                    phone: `${formData.countryCode} ${formData.phone}`,
                    list_id: formData.listId || null,
                    segment_id: formData.segmentId || null
                })
            });

            if (!res.ok) throw new Error('Failed to save contact');

            showAppNotification(`Contact successfully ${isEditMode ? 'updated' : 'added'}!`, 'success');
            navigate('/wa/contacts');
        } catch (error) {
            console.error(error);
            showAppNotification(`Failed to ${isEditMode ? 'update' : 'add'} contact: ` + error.message, 'error');
        } finally {
            setIsSaving(false);
        }
    };

    if (isLoading) {
        return <div className="p-8 text-center text-gray-500">Loading contact variables...</div>;
    }

    return (
        <div className="max-w-7xl mx-auto space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <Link to="/wa/contacts" className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 text-sm flex items-center gap-1 mb-2 transition-colors">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M15 18l-6-6 6-6" /></svg>
                        Back to dashboard
                    </Link>
                    <h1 className="text-3xl font-extrabold text-gray-900 dark:text-white tracking-tight">
                        {isEditMode ? 'Edit Contact' : 'Contact Add'}
                    </h1>
                    <p className="text-gray-500 dark:text-gray-400 mt-1">
                        {isEditMode ? 'Update this contacts data for your whatsapp.' : 'Contact edit page for your whatsapp.'}
                    </p>
                </div>
                <button
                    onClick={() => navigate('/wa/contacts')}
                    className="bg-white hover:bg-gray-50 text-gray-700 dark:bg-zinc-800 dark:hover:bg-zinc-700 dark:text-gray-200 border border-gray-200 dark:border-zinc-700 px-4 py-2 rounded-lg font-medium text-sm transition-colors shadow-sm"
                >
                    Contacts
                </button>
            </div>

            <div className="bg-white dark:bg-zinc-900 border border-gray-100 dark:border-zinc-800 rounded-xl overflow-hidden shadow-sm p-8 max-w-2xl">
                <form onSubmit={handleSubmit} className="space-y-6">
                    <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Name</label>
                        <input
                            type="text"
                            required
                            className="w-full bg-gray-50 border border-gray-200 text-gray-900 text-sm rounded-lg focus:ring-blue-500 focus:border-blue-500 block p-2.5 dark:bg-zinc-800 dark:border-zinc-700 dark:placeholder-gray-400 dark:text-white"
                            value={formData.name}
                            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                        />
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Phone Number (including Country Code)</label>
                        <input
                            type="tel"
                            required
                            className="w-full bg-gray-50 border border-gray-200 text-gray-900 text-sm rounded-lg focus:ring-blue-500 focus:border-blue-500 block p-2.5 dark:bg-zinc-800 dark:border-zinc-700 dark:placeholder-gray-400 dark:text-white"
                            value={formData.phone}
                            onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                        />
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Country code</label>
                        <select
                            className="w-full bg-gray-50 border border-gray-200 text-gray-900 text-sm rounded-lg focus:ring-blue-500 focus:border-blue-500 block p-2.5 dark:bg-zinc-800 dark:border-zinc-700 dark:placeholder-gray-400 dark:text-white"
                            value={formData.countryCode}
                            onChange={(e) => setFormData({ ...formData, countryCode: e.target.value })}
                        >
                            <option value="+93">Afghanistan (+93)</option>
                            <option value="+33">France (+33)</option>
                            <option value="+1">United States (+1)</option>
                            <option value="+229">Benin (+229)</option>
                            {/* Shortened for brevity */}
                        </select>
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Select Contact List</label>
                        <select
                            className="w-full bg-gray-50 border border-gray-200 text-gray-900 text-sm rounded-lg focus:ring-blue-500 focus:border-blue-500 block p-2.5 dark:bg-zinc-800 dark:border-zinc-700 dark:placeholder-gray-400 dark:text-white"
                            value={formData.listId}
                            onChange={(e) => setFormData({ ...formData, listId: e.target.value })}
                        >
                            <option value="">Select a list</option>
                            {lists.map(list => (
                                <option key={list.id} value={list.id}>{list.name}</option>
                            ))}
                        </select>
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Select Segments</label>
                        <select
                            className="w-full bg-gray-50 border border-gray-200 text-gray-900 text-sm rounded-lg focus:ring-blue-500 focus:border-blue-500 block p-2.5 dark:bg-zinc-800 dark:border-zinc-700 dark:placeholder-gray-400 dark:text-white"
                            value={formData.segmentId}
                            onChange={(e) => setFormData({ ...formData, segmentId: e.target.value })}
                        >
                            <option value="">Select a segment</option>
                            {segments.map(segment => (
                                <option key={segment.id} value={segment.id}>{segment.name}</option>
                            ))}
                        </select>
                    </div>

                    <button
                        type="submit"
                        disabled={isSaving}
                        className="w-full text-white bg-blue-600 hover:bg-blue-700 focus:ring-4 focus:outline-none focus:ring-blue-300 font-medium rounded-lg text-sm px-5 py-2.5 text-center dark:bg-blue-600 dark:hover:bg-blue-700 dark:focus:ring-blue-800 transition-colors disabled:opacity-50"
                    >
                        {isSaving ? 'Saving...' : (isEditMode ? 'Update Contact' : 'Add Contact')}
                    </button>
                </form>
            </div>
        </div>
    );
}
