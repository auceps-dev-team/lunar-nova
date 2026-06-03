import React, { useState, useEffect } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import useAppStore from '../../store';
import { useTranslation } from 'react-i18next';
import CustomSelect from '../../components/CustomSelect';
import { COUNTRIES } from '../../constants/countries';
import { API_BASE_URL } from '../../config';
import { CardSkeleton } from '../../components/ui/SkeletonLoader';


export default function ContactAdd() {
    const navigate = useNavigate();
    const { id } = useParams();
    const isEditMode = !!id;
    const showAppNotification = useAppStore(state => state.showAppNotification);
    const { t } = useTranslation();

    const [formData, setFormData] = useState({
        name: '',
        phone: '',
        email: '',
        address: '',
        listId: '',
        segmentId: ''
    });
    const [indicator, setIndicator] = useState('+225');

    const [lists, setLists] = useState([]);
    const [segments, setSegments] = useState([]);
    const [isSaving, setIsSaving] = useState(false);
    const [isLoading, setIsLoading] = useState(isEditMode);

    // Fetch real lists and segments from API
    useEffect(() => {
        fetch(API_BASE_URL + '/api/wa/contact-lists')
            .then(res => res.json())
            .then(data => { if (data.status === 'success') setLists(data.data || []); })
            .catch(err => console.error('Failed to fetch lists:', err));

        fetch(API_BASE_URL + '/api/wa/segments')
            .then(res => res.json())
            .then(data => { if (data.status === 'success') setSegments(data.data || []); })
            .catch(err => console.error('Failed to fetch segments:', err));
    }, []);

    // Load contact data in edit mode
    useEffect(() => {
        if (isEditMode) {
            fetch(`${API_BASE_URL}/api/wa/contacts/${id}`)
                .then(res => res.json())
                .then(data => {
                    if (data.status === 'success') {
                        const c = data.data;
                        let foundPhone = c.phone || '';
                        let foundIndicator = '+225';
                        
                        // Détecter l'indicateur existant
                        for (const country of COUNTRIES) {
                            if (foundPhone.startsWith(country.value)) {
                                foundIndicator = country.value;
                                foundPhone = foundPhone.replace(country.value, '').trim();
                                break;
                            }
                        }

                        setFormData({
                            name: c.name || '',
                            phone: foundPhone,
                            email: c.email || '',
                            address: c.address || '',
                            listId: c.list_id || '',
                            segmentId: c.segment_id || ''
                        });
                        setIndicator(foundIndicator);
                    }
                })
                .catch(err => {
                    console.error(err);
                    showAppNotification(t('failedToLoadContact'), 'error');
                })
                .finally(() => setIsLoading(false));
        }
    }, [id, showAppNotification, t]);

    const handleSubmit = async (e) => {
        e.preventDefault();
        setIsSaving(true);

        const method = isEditMode ? 'PUT' : 'POST';
        const url = isEditMode
            ? `${API_BASE_URL}/api/wa/contacts/${id}`
            : API_BASE_URL + '/api/wa/contacts';

        try {
            const res = await fetch(url, {
                method,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    name: formData.name,
                    phone: `${indicator}${formData.phone.replace(/\s+/g, '')}`,
                    email: formData.email || null,
                    address: formData.address || null,
                    list_id: formData.listId || null,
                    segment_id: formData.segmentId || null
                })
            });

            if (!res.ok) throw new Error('Failed to save contact');

            showAppNotification(isEditMode ? t('contactUpdatedSuccess') : t('contactAddedSuccess'), 'success');
            navigate('/wa/contacts');
        } catch (error) {
            console.error(error);
            showAppNotification((isEditMode ? t('contactUpdateFailed') : t('contactAddFailed')) + error.message, 'error');
        } finally {
            setIsSaving(false);
        }
    };

    const update = (field, value) => setFormData(prev => ({ ...prev, [field]: value }));

    const handlePhoneChange = (val) => {
        let cleanVal = val;
        // Détection auto de l'indicateur si l'utilisateur tape ou colle un '+'
        if (cleanVal.startsWith('+')) {
            for (const country of COUNTRIES) {
                if (cleanVal.startsWith(country.value)) {
                    setIndicator(country.value);
                    cleanVal = cleanVal.replace(country.value, '').trim();
                    break;
                }
            }
        }
        update('phone', cleanVal);
    };

    if (isLoading) {
        return (
            <div className="max-w-7xl mx-auto space-y-6">
                <div className="flex items-center justify-between mb-6">
                    <div className="h-8 bg-gray-200 dark:bg-zinc-700 rounded w-48 animate-pulse"></div>
                    <div className="h-10 bg-gray-200 dark:bg-zinc-700 rounded w-24 animate-pulse"></div>
                </div>
                <div className="max-w-2xl">
                    <CardSkeleton />
                </div>
            </div>
        );
    }

    return (
        <div className="max-w-7xl mx-auto space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <Link to="/wa/contacts" className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 text-sm flex items-center gap-1 mb-2 transition-colors">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M15 18l-6-6 6-6" /></svg>
                        {t('backToContacts')}
                    </Link>
                    <h1 className="text-3xl font-extrabold text-gray-900 dark:text-white tracking-tight">
                        {isEditMode ? t('editContact') : t('newContact')}
                    </h1>
                    <p className="text-gray-500 dark:text-gray-400 mt-1">
                        {isEditMode ? t('updateContactDesc') : t('addContactDesc')}
                    </p>
                </div>
                <button
                    onClick={() => navigate('/wa/contacts')}
                    className="bg-white hover:bg-gray-50 text-gray-700 dark:bg-zinc-800 dark:hover:bg-zinc-700 dark:text-gray-200 border border-gray-200 dark:border-zinc-700 px-4 py-2 rounded-lg font-medium text-sm transition-colors shadow-sm"
                >
                    {t('contacts')}
                </button>
            </div>

            <div className="bg-white dark:bg-zinc-900 border border-gray-100 dark:border-zinc-800 rounded-xl overflow-hidden shadow-sm p-8 max-w-2xl">
                <form onSubmit={handleSubmit} className="space-y-5">
                    {/* Name */}
                    <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{t('name')}</label>
                        <input
                            type="text" required
                            className="w-full bg-gray-50 border border-gray-200 text-gray-900 text-sm rounded-lg focus:ring-emerald-500 focus:border-emerald-500 block p-2.5 dark:bg-zinc-800 dark:border-zinc-700 dark:placeholder-gray-400 dark:text-white transition-colors"
                            placeholder={t('fullNameOrCompany')}
                            value={formData.name}
                            onChange={(e) => update('name', e.target.value)}
                        />
                    </div>

                    {/* Phone */}
                    <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{t('phone')}</label>
                        <div className="flex gap-2">
                            <CustomSelect
                                value={indicator}
                                onChange={setIndicator}
                                options={COUNTRIES}
                                width="w-44"
                                panelWidth="w-64"
                                searchable={true}
                            />
                            <input
                                type="tel" required
                                placeholder={t('placeholderPhone')}
                                className="flex-1 bg-gray-50 border border-gray-200 text-gray-900 text-sm rounded-lg focus:ring-emerald-500 focus:border-emerald-500 block p-2.5 dark:bg-zinc-800 dark:border-zinc-700 dark:placeholder-gray-400 dark:text-white transition-colors"
                                value={formData.phone}
                                onChange={(e) => handlePhoneChange(e.target.value)}
                            />
                        </div>
                    </div>

                    {/* Email */}
                    <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{t('email')}</label>
                        <input
                            type="email"
                            placeholder={t('placeholderEmail')}
                            className="w-full bg-gray-50 border border-gray-200 text-gray-900 text-sm rounded-lg focus:ring-emerald-500 focus:border-emerald-500 block p-2.5 dark:bg-zinc-800 dark:border-zinc-700 dark:placeholder-gray-400 dark:text-white transition-colors"
                            value={formData.email}
                            onChange={(e) => update('email', e.target.value)}
                        />
                    </div>

                    {/* Address */}
                    <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{t('address')}</label>
                        <textarea
                            rows={2}
                            placeholder={t('completePostalAddress')}
                            className="w-full bg-gray-50 border border-gray-200 text-gray-900 text-sm rounded-lg focus:ring-emerald-500 focus:border-emerald-500 block p-2.5 dark:bg-zinc-800 dark:border-zinc-700 dark:placeholder-gray-400 dark:text-white resize-none transition-colors"
                            value={formData.address}
                            onChange={(e) => update('address', e.target.value)}
                        />
                    </div>

                    {/* Two columns: List + Segment */}
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{t('contactList')}</label>
                            <select
                                className="w-full bg-gray-50 border border-gray-200 text-gray-900 text-sm rounded-lg focus:ring-emerald-500 focus:border-emerald-500 block p-2.5 dark:bg-zinc-800 dark:border-zinc-700 dark:placeholder-gray-400 dark:text-white transition-colors"
                                value={formData.listId}
                                onChange={(e) => update('listId', e.target.value)}
                            >
                                <option value="">{t('noList')}</option>
                                {lists.map(list => (
                                    <option key={list.id} value={list.id}>{list.name}</option>
                                ))}
                            </select>
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{t('segment')}</label>
                            <select
                                className="w-full bg-gray-50 border border-gray-200 text-gray-900 text-sm rounded-lg focus:ring-emerald-500 focus:border-emerald-500 block p-2.5 dark:bg-zinc-800 dark:border-zinc-700 dark:placeholder-gray-400 dark:text-white transition-colors"
                                value={formData.segmentId}
                                onChange={(e) => update('segmentId', e.target.value)}
                            >
                                <option value="">{t('noSegment')}</option>
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
                        {isSaving ? t('saving') : (isEditMode ? t('updateContactBtn') : t('addContactBtn'))}
                    </button>
                </form>
            </div>
        </div>
    );
}
