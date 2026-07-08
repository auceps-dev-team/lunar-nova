import React, { useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { Search, Loader2, Users, Sparkles, LayoutGrid, ArrowRight, CheckCircle2, AlertTriangle } from 'lucide-react';
import useAppStore from '../store';
import { API_BASE_URL } from '../config';
import LeadsTable from '../components/pipeline/LeadsTable';
import KanbanBoard from '../components/pipeline/KanbanBoard';
import { isValidPhoneFormat } from '../utils/phoneFormat';

const STAGES = { PROSPECT: 1, CONTACTS: 2, MESSAGES: 3 };

export default function AgentPipeline({ activeId }) {
    const { t } = useTranslation();
    const showAppNotification = useAppStore(state => state.showAppNotification);

    const [activeView, setActiveView] = useState('wizard'); // 'wizard' | 'kanban'
    const [wizardStage, setWizardStage] = useState(STAGES.PROSPECT);

    // Stage 1 — Prospecting Agent
    const [brief, setBrief] = useState('');
    const [runId, setRunId] = useState(null);
    const [leads, setLeads] = useState([]);
    const [selectedLeadNames, setSelectedLeadNames] = useState(new Set());
    const [isSearching, setIsSearching] = useState(false);

    // Stage 2 — Contact Agent
    const [isSaving, setIsSaving] = useState(false);
    const [saveSummary, setSaveSummary] = useState(null);
    const [savedContacts, setSavedContacts] = useState([]);

    // Stage 3 — Antoine
    const [isGenerating, setIsGenerating] = useState(false);
    const [drafts, setDrafts] = useState([]);
    const [isOrganizing, setIsOrganizing] = useState(false);

    // Kanban tab
    const [cards, setCards] = useState([]);
    const [isLoadingCards, setIsLoadingCards] = useState(false);

    const fetchCards = useCallback(async () => {
        setIsLoadingCards(true);
        try {
            const res = await fetch(`${API_BASE_URL}/api/pipeline/cards`);
            const data = await res.json();
            if (data.success) setCards(data.cards);
        } catch (err) {
            console.error('[AgentPipeline] fetchCards error', err);
        } finally {
            setIsLoadingCards(false);
        }
    }, []);

    useEffect(() => {
        if (activeView === 'kanban') fetchCards();
    }, [activeView, fetchCards]);

    const resetWizard = () => {
        setWizardStage(STAGES.PROSPECT);
        setBrief('');
        setRunId(null);
        setLeads([]);
        setSelectedLeadNames(new Set());
        setSaveSummary(null);
        setSavedContacts([]);
        setDrafts([]);
    };

    const toggleSelectLead = (name) => {
        setSelectedLeadNames(prev => {
            const next = new Set(prev);
            if (next.has(name)) next.delete(name); else next.add(name);
            return next;
        });
    };

    const toggleSelectAllLeads = () => {
        setSelectedLeadNames(prev => (prev.size === leads.length ? new Set() : new Set(leads.map(l => l.name))));
    };

    // ---- Stage 1: launch search ----
    const handleLaunchSearch = async () => {
        if (!brief.trim() || isSearching) return;
        setIsSearching(true);
        try {
            const runRes = await fetch(`${API_BASE_URL}/api/pipeline/runs`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ brief })
            });
            const runData = await runRes.json();
            if (!runData.success) {
                showAppNotification(runData.error || t('pipelineErrorBrief'), 'error');
                return;
            }
            setRunId(runData.run.id);

            const prospectRes = await fetch(`${API_BASE_URL}/api/pipeline/runs/${runData.run.id}/prospect`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ brief })
            });
            const prospectData = await prospectRes.json();
            if (!prospectData.success) {
                showAppNotification(prospectData.error || t('pipelineErrorSearch'), 'error');
                return;
            }

            setLeads(prospectData.leads);
            setSelectedLeadNames(new Set(prospectData.leads.map(l => l.name)));
        } catch (err) {
            console.error('[AgentPipeline] search error', err);
            showAppNotification(t('pipelineErrorSearch'), 'error');
        } finally {
            setIsSearching(false);
        }
    };

    // ---- Stage 2: save contacts ----
    const handleSaveContacts = async () => {
        const selectedLeads = leads.filter(l => selectedLeadNames.has(l.name));
        if (selectedLeads.length === 0 || isSaving) return;
        setIsSaving(true);
        try {
            const res = await fetch(`${API_BASE_URL}/api/pipeline/runs/${runId}/save-contacts`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ leads: selectedLeads })
            });
            const data = await res.json();
            if (!data.success) {
                showAppNotification(data.error || t('pipelineErrorSaveContacts'), 'error');
                return;
            }
            setSaveSummary({ imported: data.imported, invalidCount: data.invalidCount, duplicateCount: data.duplicateCount });
            setSavedContacts(data.contacts);
            setWizardStage(STAGES.MESSAGES);
        } catch (err) {
            console.error('[AgentPipeline] save contacts error', err);
            showAppNotification(t('pipelineErrorSaveContacts'), 'error');
        } finally {
            setIsSaving(false);
        }
    };

    // ---- Stage 3: generate messages (Antoine) ----
    const handleGenerateMessages = async () => {
        if (savedContacts.length === 0 || isGenerating) return;
        setIsGenerating(true);
        try {
            const res = await fetch(`${API_BASE_URL}/api/pipeline/runs/${runId}/generate-messages`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ contactIds: savedContacts.map(c => c.id) })
            });
            const data = await res.json();
            if (!data.success) {
                showAppNotification(data.error || t('pipelineErrorGenerateMessages'), 'error');
                return;
            }
            setDrafts(data.drafts);
        } catch (err) {
            console.error('[AgentPipeline] generate messages error', err);
            showAppNotification(t('pipelineErrorGenerateMessages'), 'error');
        } finally {
            setIsGenerating(false);
        }
    };

    const updateDraftMessage = (contactId, newMessage) => {
        setDrafts(prev => prev.map(d => (d.contact_id === contactId ? { ...d, draft_message: newMessage } : d)));
    };

    // ---- Stage 3 -> Kanban: organize (Clarisse) ----
    const handleOrganize = async () => {
        if (drafts.length === 0 || isOrganizing) return;
        setIsOrganizing(true);
        try {
            const res = await fetch(`${API_BASE_URL}/api/pipeline/runs/${runId}/organize`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    cards: drafts.map(d => ({ contact_id: d.contact_id, draft_message: d.draft_message }))
                })
            });
            const data = await res.json();
            if (!data.success) {
                showAppNotification(data.error || t('pipelineErrorOrganize'), 'error');
                return;
            }
            showAppNotification(t('pipelineImportSummary', { count: data.cards.length }) || `${data.cards.length} cartes créées`, 'success');
            resetWizard();
            setActiveView('kanban');
        } catch (err) {
            console.error('[AgentPipeline] organize error', err);
            showAppNotification(t('pipelineErrorOrganize'), 'error');
        } finally {
            setIsOrganizing(false);
        }
    };

    // ---- Kanban interactions ----
    const handleMoveCard = async (cardId, newStage) => {
        const previousCards = cards;
        setCards(prev => prev.map(c => (c.id === cardId ? { ...c, stage: newStage } : c)));
        try {
            const res = await fetch(`${API_BASE_URL}/api/pipeline/cards/${cardId}/stage`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ stage: newStage })
            });
            const data = await res.json();
            if (!data.success) throw new Error(data.error);
        } catch (err) {
            console.error('[AgentPipeline] move card error', err);
            setCards(previousCards);
            showAppNotification(t('pipelineErrorDragDrop'), 'error');
        }
    };

    const handleSaveCardMessage = async (cardId, newMessage) => {
        setCards(prev => prev.map(c => (c.id === cardId ? { ...c, draft_message: newMessage } : c)));
        try {
            await fetch(`${API_BASE_URL}/api/pipeline/cards/${cardId}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ draft_message: newMessage })
            });
        } catch (err) {
            console.error('[AgentPipeline] save card message error', err);
            showAppNotification(t('pipelineErrorOrganize'), 'error');
        }
    };

    const handleOpenWhatsApp = async (card) => {
        if (!activeId) {
            showAppNotification(t('instanceNotFound'), 'error');
            return;
        }
        try {
            const res = await fetch(`${API_BASE_URL}/api/wa/open-chat`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    instance_id: activeId,
                    phone: card.contact_phone,
                    contact_id: card.contact_id,
                    text: card.draft_message || ''
                })
            });
            const data = await res.json();
            if (data.status !== 'success') {
                showAppNotification(data.error || t('errorNetworkWhatsapp'), 'error');
            }
        } catch (err) {
            console.error('[AgentPipeline] open whatsapp error', err);
            showAppNotification(t('errorNetworkWhatsapp'), 'error');
        }
    };

    const selectedCount = selectedLeadNames.size;

    return (
        <div className="flex flex-col h-full gap-4 animate-fadeIn">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-xl font-bold text-gray-900 dark:text-white">{t('agentPipeline')}</h1>
                    <p className="text-sm text-gray-500 dark:text-gray-400">{t('pipelineDraftDisclaimer')}</p>
                </div>
                <div className="flex bg-gray-100 dark:bg-zinc-800 p-1 rounded-lg">
                    <button
                        onClick={() => setActiveView('wizard')}
                        className={`px-4 py-1.5 text-sm font-medium rounded-md transition ${activeView === 'wizard' ? 'bg-white dark:bg-zinc-700 text-emerald-600 shadow-sm' : 'text-gray-500'}`}
                    >
                        {t('pipelineWizardTab')}
                    </button>
                    <button
                        onClick={() => setActiveView('kanban')}
                        className={`px-4 py-1.5 text-sm font-medium rounded-md transition flex items-center gap-1.5 ${activeView === 'kanban' ? 'bg-white dark:bg-zinc-700 text-emerald-600 shadow-sm' : 'text-gray-500'}`}
                    >
                        <LayoutGrid className="h-3.5 w-3.5" /> {t('pipelineKanbanTab')}
                    </button>
                </div>
            </div>

            {activeView === 'wizard' ? (
                <div className="flex-1 overflow-y-auto space-y-6 max-w-3xl">
                    {/* Stage 1 */}
                    <section className="bg-white dark:bg-zinc-900 border border-gray-200 dark:border-zinc-800 rounded-xl p-5 space-y-4">
                        <div className="flex items-center gap-2">
                            <Search className="h-4 w-4 text-emerald-600" />
                            <h2 className="font-semibold text-gray-900 dark:text-gray-100">{t('pipelineStage1Title')}</h2>
                        </div>
                        <p className="text-sm text-gray-500 dark:text-gray-400">{t('pipelineStage1Desc')}</p>
                        <textarea
                            value={brief}
                            onChange={e => setBrief(e.target.value)}
                            placeholder={t('pipelineBriefPlaceholder')}
                            rows={3}
                            disabled={wizardStage > STAGES.PROSPECT}
                            className="w-full border border-gray-300 dark:border-zinc-700 rounded-lg px-4 py-2.5 bg-gray-50 dark:bg-zinc-800 text-sm outline-none text-gray-900 dark:text-gray-100 disabled:opacity-60"
                        />
                        {wizardStage === STAGES.PROSPECT && (
                            <button
                                onClick={handleLaunchSearch}
                                disabled={!brief.trim() || isSearching}
                                className="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-sm font-medium flex items-center gap-2 disabled:opacity-50"
                            >
                                {isSearching ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
                                {t('pipelineLaunchSearch')}
                            </button>
                        )}

                        {leads.length > 0 && (
                            <div className="space-y-3 pt-2">
                                <LeadsTable
                                    leads={leads}
                                    selectedNames={selectedLeadNames}
                                    onToggle={toggleSelectLead}
                                    onToggleAll={toggleSelectAllLeads}
                                />
                                {wizardStage === STAGES.PROSPECT && (
                                    <button
                                        onClick={() => setWizardStage(STAGES.CONTACTS)}
                                        disabled={selectedCount === 0}
                                        className="flex items-center gap-2 text-sm font-medium text-emerald-700 hover:text-emerald-800 disabled:opacity-50"
                                    >
                                        {t('pipelineValidateLeads')} ({selectedCount}) <ArrowRight className="h-3.5 w-3.5" />
                                    </button>
                                )}
                            </div>
                        )}
                    </section>

                    {/* Stage 2 */}
                    {wizardStage >= STAGES.CONTACTS && (
                        <section className="bg-white dark:bg-zinc-900 border border-gray-200 dark:border-zinc-800 rounded-xl p-5 space-y-4">
                            <div className="flex items-center gap-2">
                                <Users className="h-4 w-4 text-emerald-600" />
                                <h2 className="font-semibold text-gray-900 dark:text-gray-100">{t('pipelineStage2Title')}</h2>
                            </div>
                            <p className="text-sm text-gray-500 dark:text-gray-400">{t('pipelineStage2Desc')}</p>

                            {!saveSummary && (
                                <div className="text-sm text-gray-600 dark:text-gray-300 space-y-1">
                                    {leads.filter(l => selectedLeadNames.has(l.name)).map((lead, idx) => {
                                        const valid = isValidPhoneFormat(lead.phone);
                                        return (
                                            <div key={idx} className="flex items-center gap-2">
                                                {valid ? <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500 shrink-0" /> : <AlertTriangle className="h-3.5 w-3.5 text-amber-500 shrink-0" />}
                                                <span className="truncate">{lead.name} — {lead.phone || t('pipelineNoPhone')}</span>
                                            </div>
                                        );
                                    })}
                                </div>
                            )}

                            {saveSummary && (
                                <div className="text-sm bg-emerald-50 dark:bg-emerald-900/20 text-emerald-800 dark:text-emerald-300 rounded-lg p-3">
                                    {t('pipelineImportSummaryDetail', {
                                        imported: saveSummary.imported,
                                        duplicates: saveSummary.duplicateCount,
                                        invalid: saveSummary.invalidCount
                                    }) || `${saveSummary.imported} importés, ${saveSummary.duplicateCount} doublons, ${saveSummary.invalidCount} invalides`}
                                </div>
                            )}

                            {wizardStage === STAGES.CONTACTS && !saveSummary && (
                                <button
                                    onClick={handleSaveContacts}
                                    disabled={isSaving}
                                    className="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-sm font-medium flex items-center gap-2 disabled:opacity-50"
                                >
                                    {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Users className="h-4 w-4" />}
                                    {t('pipelineSaveContacts')}
                                </button>
                            )}
                        </section>
                    )}

                    {/* Stage 3 */}
                    {wizardStage >= STAGES.MESSAGES && (
                        <section className="bg-white dark:bg-zinc-900 border border-gray-200 dark:border-zinc-800 rounded-xl p-5 space-y-4">
                            <div className="flex items-center gap-2">
                                <Sparkles className="h-4 w-4 text-emerald-600" />
                                <h2 className="font-semibold text-gray-900 dark:text-gray-100">{t('pipelineStage3Title')}</h2>
                            </div>
                            <p className="text-sm text-gray-500 dark:text-gray-400">{t('pipelineStage3Desc')}</p>
                            <p className="text-xs font-medium text-amber-600 bg-amber-50 dark:bg-amber-900/20 rounded-lg px-3 py-2">{t('pipelineDraftDisclaimer')}</p>

                            {drafts.length === 0 && (
                                <button
                                    onClick={handleGenerateMessages}
                                    disabled={isGenerating}
                                    className="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-sm font-medium flex items-center gap-2 disabled:opacity-50"
                                >
                                    {isGenerating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
                                    {t('pipelineGenerateMessages')}
                                </button>
                            )}

                            {drafts.length > 0 && (
                                <div className="space-y-3">
                                    {drafts.map(draft => (
                                        <div key={draft.contact_id} className="border border-gray-200 dark:border-zinc-800 rounded-lg p-3 space-y-1.5">
                                            <div className="text-sm font-medium text-gray-900 dark:text-gray-100">{draft.name} <span className="text-gray-400 font-normal">— {draft.phone}</span></div>
                                            <textarea
                                                value={draft.draft_message}
                                                onChange={e => updateDraftMessage(draft.contact_id, e.target.value)}
                                                rows={3}
                                                className="w-full text-sm border border-gray-200 dark:border-zinc-700 rounded-lg p-2.5 bg-gray-50 dark:bg-zinc-800 outline-none resize-none text-gray-800 dark:text-gray-200"
                                            />
                                        </div>
                                    ))}
                                    <button
                                        onClick={handleOrganize}
                                        disabled={isOrganizing}
                                        className="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-sm font-medium flex items-center gap-2 disabled:opacity-50"
                                    >
                                        {isOrganizing ? <Loader2 className="h-4 w-4 animate-spin" /> : <LayoutGrid className="h-4 w-4" />}
                                        {t('pipelineOrganizeKanban')}
                                    </button>
                                </div>
                            )}
                        </section>
                    )}
                </div>
            ) : (
                <div className="flex-1 overflow-hidden flex flex-col">
                    {isLoadingCards ? (
                        <div className="flex-1 flex items-center justify-center text-gray-400">
                            <Loader2 className="h-5 w-5 animate-spin" />
                        </div>
                    ) : cards.length === 0 ? (
                        <div className="flex-1 flex items-center justify-center text-gray-400 text-sm">{t('pipelineNoCardsYet')}</div>
                    ) : (
                        <KanbanBoard
                            cards={cards}
                            onMoveCard={handleMoveCard}
                            onSaveMessage={handleSaveCardMessage}
                            onOpenWhatsApp={handleOpenWhatsApp}
                        />
                    )}
                </div>
            )}
        </div>
    );
}
