import React, { useState } from 'react';
import useAppStore from '../store';
import { useTranslation } from 'react-i18next';

const Support = () => {
    const { t } = useTranslation();
    const language = useAppStore(state => state.appSettings?.language) || 'en';
    const userProfile = useAppStore(state => state.userProfile) || {};
    const [ticketSent, setTicketSent] = useState(false);
    const [form, setForm] = useState({
        email: userProfile.email || '',
        subject: '',
        category: 'bug',
        message: ''
    });

    const categories = [
        { id: 'bug', label: t('bugReport') },
        { id: 'feature', label: t('featureReq') },
        { id: 'billing', label: t('billing') },
        { id: 'other', label: t('other') }
    ];

    const changelog = [
        { version: 'v1.28.8', date: 'Aujourd\'hui', changes: ['Amélioration mineur de la mise à jour (UX)', 'Vérification silencieuse', 'Bannière et notes de patch automatisées'] },
        { version: 'v1.1.0', date: '2026-04-03', changes: ['AI Photo Studio optimization', 'Custom icons integration', 'Auto-update engine'] },
        { version: 'v1.0.5', date: '2026-03-25', changes: ['WhatsApp Hub performance fix', 'Advanced Analytics dashboard', 'State management refactor'] },
        { version: 'v1.0.0', date: '2026-03-01', changes: ['Initial Beta Release', 'Multi-instance support', 'Gemini AI integration'] }
    ];

    const handleSubmit = (e) => {
        e.preventDefault();
        console.log('Submitting ticket:', form);
        setTicketSent(true);
        setTimeout(() => setTicketSent(false), 5000);

        // Potential deep link to mail client
        const mailBody = encodeURIComponent(`Category: ${form.category}\n\n${form.message}`);
        const mailTo = `mailto:support@auceps-digital.agency?subject=${encodeURIComponent(form.subject)}&body=${mailBody}`;
        window.location.href = mailTo;
    };

    return (
        <div className="max-w-6xl mx-auto space-y-8 animate-in fade-in duration-500">
            {/* Header Section */}
            <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-emerald-600 to-teal-900 p-12 text-white shadow-2xl">
                <div className="relative z-10">
                    <h1 className="text-4xl md:text-5xl font-display font-bold mb-4">{t('supportTitle')}</h1>
                    <p className="text-emerald-50 opacity-90 text-lg max-w-2xl">
                        {t('promoHelpAuceps')}
                    </p>
                </div>
                {/* Abstract background shapes */}
                <div className="absolute top-0 right-0 -translate-y-1/2 translate-x-1/4 w-96 h-96 bg-white/10 rounded-full blur-3xl opacity-30"></div>
                <div className="absolute bottom-0 left-0 translate-y-1/2 -translate-x-1/4 w-64 h-64 bg-emerald-400/20 rounded-full blur-2xl opacity-20"></div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                {/* Left: Contact Info */}
                <div className="lg:col-span-1 space-y-6">
                    <div className="bg-surface dark:bg-gray-900 p-6 rounded-2xl border border-gray-100 dark:border-gray-800 shadow-soft">
                        <div className="flex items-center gap-3 mb-6">
                            <div className="size-10 bg-emerald-500/10 rounded-xl flex items-center justify-center text-emerald-600">
                                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"></path></svg>
                            </div>
                            <h2 className="text-xl font-display font-bold dark:text-white">{t('brandAucepsDigital')}</h2>
                        </div>

                        <div className="space-y-4">
                            <a href="https://auceps-digital.agency" target="_blank" rel="noopener noreferrer" className="flex items-center gap-3 text-sm text-gray-600 dark:text-gray-400 hover:text-emerald-600 dark:hover:text-emerald-400 transition-colors">
                                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"></circle><line x1="2" y1="12" x2="22" y2="12"></line><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"></path></svg>
                                {t('brandAucepsDigitalAgency')}
                            </a>
                            <div className="flex items-start gap-3 text-sm text-gray-600 dark:text-gray-400 transition-colors">
                                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"></path><polyline points="22,6 12,13 2,6"></polyline></svg>
                                <div>
                                    <p className="font-medium">{t('emailSupportAuceps')}</p>
                                    <p className="opacity-70">{t('emailInfoAuceps')}</p>
                                </div>
                            </div>
                            <div className="flex items-start gap-3 text-sm text-gray-600 dark:text-gray-400">
                                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"></path></svg>
                                <div>
                                    <p>+225 07 18 35 04 82</p>
                                    <p>+225 07 69 63 09 87</p>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Version History */}
                    <div className="bg-surface dark:bg-gray-900 p-6 rounded-2xl border border-gray-100 dark:border-gray-800 shadow-soft">
                        <h2 className="text-xl font-display font-bold mb-6 dark:text-white">{t('changelog')}</h2>
                        <div className="space-y-6">
                            {changelog.map((entry, idx) => (
                                <div key={entry.version} className="relative pl-6 border-l-2 border-emerald-500/20 last:border-0 pb-6 last:pb-0">
                                    <div className="absolute top-0 left-[-9px] size-4 rounded-full bg-emerald-500 border-4 border-surface dark:border-gray-900"></div>
                                    <div className="flex items-center justify-between mb-1">
                                        <span className="text-sm font-bold text-emerald-600">{entry.version}</span>
                                        <span className="text-[10px] text-gray-400">{entry.date}</span>
                                    </div>
                                    <ul className="text-xs text-gray-600 dark:text-gray-400 space-y-1">
                                        {entry.changes.map((item, i) => <li key={i}>• {item}</li>)}
                                    </ul>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>

                {/* Right: Ticket Form */}
                <div className="lg:col-span-2">
                    <div className="bg-surface dark:bg-gray-900 p-8 rounded-2xl border border-gray-100 dark:border-gray-800 shadow-soft h-full">
                        <h2 className="text-2xl font-display font-bold mb-6 dark:text-white">{t('submitTicket')}</h2>

                        {ticketSent ? (
                            <div className="h-64 flex flex-col items-center justify-center space-y-4 text-center">
                                <div className="size-16 bg-emerald-500 text-white rounded-full flex items-center justify-center animate-bounce">
                                    <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><polyline points="20 6 9 17 4 12"></polyline></svg>
                                </div>
                                <h3 className="text-xl font-bold dark:text-white">{t('ticketSuccess')}</h3>
                                <p className="text-gray-500">{t('emailClientOpened')}</p>
                            </div>
                        ) : (
                            <form onSubmit={handleSubmit} className="space-y-6">
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                    <div className="space-y-2">
                                        <label className="text-sm font-medium text-gray-700 dark:text-gray-300">{t('email')}</label>
                                        <input
                                            type="email"
                                            required
                                            value={form.email}
                                            onChange={e => setForm({ ...form, email: e.target.value })}
                                            disabled={!!userProfile.email}
                                            className="w-full px-4 py-3 rounded-xl border border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-950 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500/50 transition-all disabled:opacity-60"
                                            placeholder={t('placeholderEmail')}
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <label className="text-sm font-medium text-gray-700 dark:text-gray-300">{t('category')}</label>
                                        <select
                                            value={form.category}
                                            onChange={e => setForm({ ...form, category: e.target.value })}
                                            className="w-full px-4 py-3 rounded-xl border border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-950 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500/50 transition-all"
                                        >
                                            {categories.map(c => <option key={c.id} value={c.id}>{c.label}</option>)}
                                        </select>
                                    </div>
                                </div>

                                <div className="space-y-2">
                                    <label className="text-sm font-medium text-gray-700 dark:text-gray-300">{t('subject')}</label>
                                    <input
                                        type="text"
                                        required
                                        value={form.subject}
                                        onChange={e => setForm({ ...form, subject: e.target.value })}
                                        className="w-full px-4 py-3 rounded-xl border border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-950 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500/50 transition-all"
                                        placeholder={t('subjectPlaceholder')}
                                    />
                                </div>

                                <div className="space-y-2">
                                    <label className="text-sm font-medium text-gray-700 dark:text-gray-300">{t('message')}</label>
                                    <textarea
                                        rows="6"
                                        required
                                        value={form.message}
                                        onChange={e => setForm({ ...form, message: e.target.value })}
                                        className="w-full px-4 py-3 rounded-xl border border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-950 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500/50 transition-all resize-none"
                                        placeholder={t('describeRequestInDetail')}
                                    ></textarea>
                                </div>

                                <button
                                    type="submit"
                                    className="w-full py-4 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl shadow-lg shadow-emerald-600/20 transition-all hover:scale-[1.02] active:scale-[0.98] flex items-center justify-center gap-2"
                                >
                                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="22" y1="2" x2="11" y2="13"></line><polygon points="22 2 15 22 11 13 2 9 22 2"></polygon></svg>
                                    {t('sendTicket')}
                                </button>
                            </form>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default Support;
