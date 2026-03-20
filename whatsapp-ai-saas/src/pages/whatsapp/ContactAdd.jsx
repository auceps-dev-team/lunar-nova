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
        email: '',
        address: '',
        listId: '',
        segmentId: ''
    });

    const [lists, setLists] = useState([]);
    const [segments, setSegments] = useState([]);
    const [isSaving, setIsSaving] = useState(false);
    const [isLoading, setIsLoading] = useState(isEditMode);

    // Fetch real lists and segments from API
    useEffect(() => {
        fetch('http://localhost:3000/api/wa/contact-lists')
            .then(res => res.json())
            .then(data => { if (data.status === 'success') setLists(data.data || []); })
            .catch(err => console.error('Failed to fetch lists:', err));

        fetch('http://localhost:3000/api/wa/segments')
            .then(res => res.json())
            .then(data => { if (data.status === 'success') setSegments(data.data || []); })
            .catch(err => console.error('Failed to fetch segments:', err));
    }, []);

    // Load contact data in edit mode
    useEffect(() => {
        if (isEditMode) {
            fetch(`http://localhost:3000/api/wa/contacts/${id}`)
                .then(res => res.json())
                .then(data => {
                    if (data.status === 'success') {
                        const c = data.data;
                        setFormData({
                            name: c.name || '',
                            phone: c.phone || '',
                            email: c.email || '',
                            address: c.address || '',
                            listId: c.list_id || '',
                            segmentId: c.segment_id || ''
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
                    phone: formData.phone,
                    email: formData.email || null,
                    address: formData.address || null,
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

    const update = (field, value) => setFormData(prev => ({ ...prev, [field]: value }));

    if (isLoading) {
        return <div className="p-8 text-center text-gray-500">Loading contact data...</div>;
    }

    return (
        <div className="max-w-7xl mx-auto space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <Link to="/wa/contacts" className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 text-sm flex items-center gap-1 mb-2 transition-colors">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M15 18l-6-6 6-6" /></svg>
                        Retour aux contacts
                    </Link>
                    <h1 className="text-3xl font-extrabold text-gray-900 dark:text-white tracking-tight">
                        {isEditMode ? 'Modifier le contact' : 'Nouveau contact'}
                    </h1>
                    <p className="text-gray-500 dark:text-gray-400 mt-1">
                        {isEditMode ? 'Mettez à jour les informations de ce contact.' : 'Ajoutez un nouveau contact à votre carnet WhatsApp.'}
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
                <form onSubmit={handleSubmit} className="space-y-5">
                    {/* Name */}
                    <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Nom</label>
                        <input
                            type="text" required
                            className="w-full bg-gray-50 border border-gray-200 text-gray-900 text-sm rounded-lg focus:ring-emerald-500 focus:border-emerald-500 block p-2.5 dark:bg-zinc-800 dark:border-zinc-700 dark:placeholder-gray-400 dark:text-white transition-colors"
                            placeholder="Nom complet ou société"
                            value={formData.name}
                            onChange={(e) => update('name', e.target.value)}
                        />
                    </div>

                    {/* Phone */}
                    <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Téléphone</label>
                        <input
                            type="tel" required
                            placeholder="ex: +225 07 07 07 07 07"
                            className="w-full bg-gray-50 border border-gray-200 text-gray-900 text-sm rounded-lg focus:ring-emerald-500 focus:border-emerald-500 block p-2.5 dark:bg-zinc-800 dark:border-zinc-700 dark:placeholder-gray-400 dark:text-white transition-colors"
                            value={formData.phone}
                            onChange={(e) => update('phone', e.target.value)}
                        />
                    </div>

                    {/* Email */}
                    <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Email</label>
                        <input
                            type="email"
                            placeholder="contact@exemple.com"
                            className="w-full bg-gray-50 border border-gray-200 text-gray-900 text-sm rounded-lg focus:ring-emerald-500 focus:border-emerald-500 block p-2.5 dark:bg-zinc-800 dark:border-zinc-700 dark:placeholder-gray-400 dark:text-white transition-colors"
                            value={formData.email}
                            onChange={(e) => update('email', e.target.value)}
                        />
                    </div>

                    {/* Address */}
                    <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Adresse</label>
                        <textarea
                            rows={2}
                            placeholder="Adresse postale complète"
                            className="w-full bg-gray-50 border border-gray-200 text-gray-900 text-sm rounded-lg focus:ring-emerald-500 focus:border-emerald-500 block p-2.5 dark:bg-zinc-800 dark:border-zinc-700 dark:placeholder-gray-400 dark:text-white resize-none transition-colors"
                            value={formData.address}
                            onChange={(e) => update('address', e.target.value)}
                        />
                    </div>

                    {/* Two columns: List + Segment */}
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Liste de contacts</label>
                            <select
                                className="w-full bg-gray-50 border border-gray-200 text-gray-900 text-sm rounded-lg focus:ring-emerald-500 focus:border-emerald-500 block p-2.5 dark:bg-zinc-800 dark:border-zinc-700 dark:placeholder-gray-400 dark:text-white transition-colors"
                                value={formData.listId}
                                onChange={(e) => update('listId', e.target.value)}
                            >
                                <option value="">Aucune liste</option>
                                {lists.map(list => (
                                    <option key={list.id} value={list.id}>{list.name}</option>
                                ))}
                            </select>
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Segment</label>
                            <select
                                className="w-full bg-gray-50 border border-gray-200 text-gray-900 text-sm rounded-lg focus:ring-emerald-500 focus:border-emerald-500 block p-2.5 dark:bg-zinc-800 dark:border-zinc-700 dark:placeholder-gray-400 dark:text-white transition-colors"
                                value={formData.segmentId}
                                onChange={(e) => update('segmentId', e.target.value)}
                            >
                                <option value="">Aucun segment</option>
                                {segments.map(segment => (
                                    <option key={segment.id} value={segment.id}>{segment.name}</option>
                                ))}
                            </select>
                        </div>
                    </div>

                    <button
                        type="submit"
                        disabled={isSaving}
                        className="w-full text-white font-medium rounded-lg text-sm px-5 py-2.5 text-center transition-all disabled:opacity-50 active:scale-[.99]"
                        style={{ background: 'linear-gradient(135deg,#059669,#047857)' }}
                    >
                        {isSaving ? 'Enregistrement...' : (isEditMode ? 'Mettre à jour' : 'Ajouter le contact')}
                    </button>
                </form>
            </div>
        </div>
    );
}
