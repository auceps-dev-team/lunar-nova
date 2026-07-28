import React, { useState, useEffect, useRef } from 'react';
import { Link, useLocation } from 'react-router-dom';
import useAppStore from '../store';
import { Sparkles, Download, Undo, Redo, Copy, Edit3, AlignLeft, AlignCenter, AlignRight, Bold, Italic, Underline, List } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import CustomSelect from '../components/CustomSelect';
import { API_BASE_URL } from '../config';



const SYSTEM_AGENTS = [
    { id: 'copywriter', name: 'Jarvis - SDR Senior', isSystem: true },
    { id: 'legal', name: 'Legal & Admin', isSystem: true },
    { id: 'creative', name: 'Creative Visual', isSystem: true },
    { id: 'ella', name: 'Ella - Life Architect', isSystem: true },
    { id: 'copilot', name: 'WhatCopilote', isSystem: true },
    { id: 'brand_guardian', name: 'Brand Guardian', isSystem: true },
    { id: 'account_strategist', name: 'Account Strategist', isSystem: true },
    { id: 'legal_compliance', name: 'Legal Compliance', isSystem: true },
    { id: 'support_responder', name: 'Support Responder', isSystem: true },
    { id: 'podcast_strategist', name: 'Podcast Strategist', isSystem: true },
    { id: 'seo_specialist', name: 'SEO Specialist', isSystem: true },
    { id: 'social_media_strategist', name: 'Social Media Strategist', isSystem: true },
    { id: 'instagram_curator', name: 'Instagram Curator', isSystem: true },
    { id: 'tiktok_strategist', name: 'TikTok Strategist', isSystem: true },
    { id: 'twitter_engager', name: 'Twitter Engager', isSystem: true },
    { id: 'content_creator', name: 'Content Creator', isSystem: true },
    { id: 'growth_hacker', name: 'Growth Hacker', isSystem: true },
    { id: 'sales_coach', name: 'Sales Coach', isSystem: true },
    { id: 'sales_engineer', name: 'Sales Engineer', isSystem: true },
    { id: 'outbound_strategist', name: 'Outbound Strategist', isSystem: true },
    { id: 'ad_creative_strategist', name: 'Ad Creative Strategist', isSystem: true },
    { id: 'paid_social_strategist', name: 'Paid Social Strategist', isSystem: true }
];

export default function AiWriter() {
    const { t } = useTranslation();
    const showAppNotification = useAppStore(state => state.showAppNotification);
    const appSettings = useAppStore(state => state.appSettings) || {};
    const uiLanguage = appSettings.language || 'en';
    const [allAgents, setAllAgents] = useState([]);

    // Form state
    const [selectedAgent, setSelectedAgent] = useState('content_creator');
    const [documentTitle, setDocumentTitle] = useState('');
    const [shortDescription, setShortDescription] = useState('');
    const [language, setLanguage] = useState('English (USA)');
    const [maxLength, setMaxLength] = useState('200');
    const [creativity, setCreativity] = useState('Good');
    const [toneOfVoice, setToneOfVoice] = useState('Professional');

    const [isGenerating, setIsGenerating] = useState(false);
    const [editorContent, setEditorContent] = useState(t('untitledDoc'));
    const [showDownloadMenu, setShowDownloadMenu] = useState(false);
    const [documentId, setDocumentId] = useState(null);

    const editorRef = useRef(null);
    const location = useLocation();

    useEffect(() => {
        // Parse docId from URL
        const params = new URLSearchParams(location.search);
        const docId = params.get('docId');

        if (docId) {
            setDocumentId(docId);
            fetchDocument(docId);
        }

        const fetchCustomAgents = async () => {
            try {
                const res = await fetch(API_BASE_URL + '/api/agents');
                const data = await res.json();
                const custom = (data.data || []).map(a => ({ ...a, isSystem: false }));
                setAllAgents([...SYSTEM_AGENTS, ...custom]);
            } catch {
                setAllAgents(SYSTEM_AGENTS);
            }
        };
        fetchCustomAgents();
    }, [location]);

    const fetchDocument = async (id) => {
        try {
            const res = await fetch(`${API_BASE_URL}/api/documents/${id}`);
            const data = await res.json();
            if (data.status === 'success') {
                setDocumentTitle(data.data.title);
                setEditorContent(data.data.content || '');
                if (editorRef.current) {
                    editorRef.current.innerHTML = data.data.content || '';
                }
            }
        } catch (err) {
            console.error("Erreur chargement document", err);
        }
    };

    const handleFormat = (command, value = null) => {
        document.execCommand(command, false, value);
        if (editorRef.current) {
            editorRef.current.focus();
        }
    };

    const handleGenerate = async () => {
        if (!documentTitle.trim() && !shortDescription.trim()) {
            showAppNotification(t('errorProvideNameOrDesc'), "error");
            return;
        }

        setIsGenerating(true);
        try {
            // Construct the prompt
            let prompt = `Tâche : Écrire un contenu selon ces paramètres :
- Sujet/Titre : ${documentTitle || t('untitledDoc')}
- Description : ${shortDescription}
- Langue : ${language}
- Longueur cible : environ ${maxLength} mots
- Ton : ${toneOfVoice}
- Créativité/Style : ${creativity}`;

            prompt += "\n\nRenvoie uniquement le texte généré, sans introduction ni conclusion de politesse. Utilise du formatage HTML de base (<b>, <i>, <ul>, <li>, <br/>, <p>, <h1>, <h2>) pour bien structurer le rendu final.";

            const res = await fetch(API_BASE_URL + '/api/ai/agent', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    persona: selectedAgent,
                    message: prompt,
                    promptFormat: 'text'
                })
            });

            const data = await res.json();

            if (data.response) {
                // If it wrapped in json, parse it
                let text = data.response;
                try {
                    const parsed = JSON.parse(text);
                    text = parsed.text || parsed.proposed_replies?.join('<br/>') || text;
                } catch { }

                // Clean markdown if mixed with HTML
                text = text.replace(/```html/g, '').replace(/```/g, '');

                setEditorContent(text);
                if (editorRef.current) {
                    editorRef.current.innerHTML = text;
                }
                showAppNotification(t('successContentGenerated'), "success");
            } else {
                showAppNotification(t('errorGeneration'), "error");
            }

        } catch (err) {
            console.error(err);
            showAppNotification(t('errorServerConnection'), "error");
        } finally {
            setIsGenerating(false);
        }
    };

    // html2pdf.js pèse près de 1 Mo (html2canvas + jsPDF). Importé statiquement,
    // il était embarqué dans le chunk de cette page et téléchargé à chaque visite,
    // alors qu'il ne sert qu'au clic sur « Exporter en PDF ». L'import dynamique le
    // déplace dans un chunk chargé à la demande.
    const downloadPDF = async () => {
        if (!editorRef.current) return;
        const element = editorRef.current;
        const opt = {
            margin: 1,
            filename: `${documentTitle || 'document'}.pdf`,
            image: { type: 'jpeg', quality: 0.98 },
            html2canvas: { scale: 2 },
            jsPDF: { unit: 'in', format: 'letter', orientation: 'portrait' }
        };
        try {
            const { default: html2pdf } = await import('html2pdf.js');
            await html2pdf().set(opt).from(element).save();
        } catch (err) {
            console.error('[AiWriter] Export PDF échoué:', err);
            showAppNotification(t('errorServerConnection'), 'error');
        } finally {
            setShowDownloadMenu(false);
        }
    };

    const handleSave = async () => {
        if (!editorRef.current) return;

        const content = editorRef.current.innerHTML;
        const title = documentTitle || t('untitledDoc');

        try {
            const method = documentId ? 'PUT' : 'POST';
            const url = documentId ? `${API_BASE_URL}/api/documents/${documentId}` : API_BASE_URL + '/api/documents';

            const res = await fetch(url, {
                method: method,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ title, content })
            });

            const data = await res.json();
            if (data.status === 'success') {
                if (!documentId) {
                    setDocumentId(data.data.id);
                }
                showAppNotification(t('successDocSaved'), "success");
            } else {
                showAppNotification(t('errorSave'), "error");
            }
        } catch (err) {
            console.error(err);
            showAppNotification(t('errorNetworkSave'), "error");
        }
    };

    const handleRewrite = async () => {
        const selection = window.getSelection();
        const selectedText = selection.toString();

        if (!selectedText || selectedText.trim() === '') {
            showAppNotification(t('errorSelectTextFirst'), "error");
            return;
        }

        setIsGenerating(true);
        showAppNotification(t('rewritingInProgress'), "success");

        try {
            const prompt = `Réécris le texte suivant pour l'améliorer, le rendre plus professionnel et percutant. Renvoie UNIQUEMENT le texte réécrit, sans aucune introduction, sans guillemets et sans formatage markdown additionnel:\n\n"${selectedText}"`;

            const res = await fetch(API_BASE_URL + '/api/ai/agent', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    persona: selectedAgent,
                    message: prompt,
                    promptFormat: 'text'
                })
            });

            const data = await res.json();

            if (data.response) {
                let newText = data.response.replace(/```html/g, '').replace(/```/g, '').trim();
                document.execCommand('insertText', false, newText);
                showAppNotification(t('successTextRewritten'), "success");
            } else {
                showAppNotification(t('errorRewriting'), "error");
            }
        } catch (err) {
            console.error(err);
            showAppNotification(t('errorServerConnection'), "error");
        } finally {
            setIsGenerating(false);
        }
    };

    const downloadWord = () => {
        if (!editorRef.current) return;
        const htmlContent = `
            <html xmlns:o='urn:schemas-microsoft-com:office:office' xmlns:w='urn:schemas-microsoft-com:office:word' xmlns='http://www.w3.org/TR/REC-html40'>
            <head><meta charset='utf-8'><title>Export HTML To Doc</title></head><body>
            ${editorRef.current.innerHTML}
            </body></html>`;

        const blob = new Blob(['\ufeff', htmlContent], { type: 'application/msword' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${documentTitle || 'document'}.doc`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);

        setShowDownloadMenu(false);
    };

    const copyToClipboard = () => {
        if (editorRef.current) {
            const text = editorRef.current.innerText;
            navigator.clipboard.writeText(text);
            showAppNotification(t('copyToClipboard'), "success");
        }
    };

    return (
        <div className="flex h-full w-full gap-6 p-4 md:p-6 bg-[#f8fafc] dark:bg-gray-900 overflow-hidden">
            {/* Left Column - Configuration */}
            <div className="w-[380px] shrink-0 flex flex-col gap-5 overflow-y-auto pr-2 scrollbar-hide">
                <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-5">
                    <h3 className="font-semibold text-gray-800 dark:text-gray-100 mb-4">{t('agentConfig')}</h3>
                    <div className="mb-4">
                        <label className="text-xs font-medium text-gray-500 mb-1.5 block">{t('selectAgent')}</label>
                        <CustomSelect
                            value={selectedAgent}
                            onChange={setSelectedAgent}
                            searchable
                            panelWidth="w-72"
                            options={allAgents.map(a => ({
                                value: a.id,
                                label: a.name,
                                description: a.isSystem ? t('system') : t('customBadge'),
                            }))}
                        />
                    </div>

                </div>

                <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-5 flex-1 flex flex-col">
                    <h3 className="font-semibold text-gray-800 dark:text-gray-100 mb-4">{t('needDesc')}</h3>

                    <div className="mb-5 flex-1 flex flex-col">
                        <label className="text-xs font-medium text-gray-500 mb-1.5 block">{t('describeCreation')}</label>
                        <textarea
                            value={shortDescription}
                            onChange={e => setShortDescription(e.target.value)}
                            placeholder={t('exLinkedin')}
                            className="w-full flex-1 min-h-[180px] bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-[#0b9f84] focus:ring-1 focus:ring-[#0b9f84] resize-none dark:bg-gray-700 dark:border-gray-600 dark:text-gray-200 transition-shadow"
                        ></textarea>
                    </div>

                    <div className="grid grid-cols-2 gap-4 mb-5">
                        <div>
                            <label className="text-xs font-medium text-gray-500 mb-1.5 block">{t('interfaceLang')}</label>
                            <CustomSelect
                                value={language}
                                onChange={setLanguage}
                                options={[
                                    { value: 'English (USA)', label: 'English (USA)' },
                                    { value: 'Français (France)', label: 'Français (France)' },
                                    { value: 'Español', label: 'Español' },
                                ]}
                            />
                        </div>
                        <div>
                            <label className="text-xs font-medium text-gray-500 mb-1.5 block">{t('maxLen')}</label>
                            <input
                                type="number"
                                value={maxLength}
                                onChange={e => setMaxLength(e.target.value)}
                                className="w-full bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none dark:bg-gray-700 dark:border-gray-600 dark:text-gray-200"
                            />
                        </div>
                        <div>
                            <label className="text-xs font-medium text-gray-500 mb-1.5 block">{t('creativity')}</label>
                            <CustomSelect
                                value={creativity}
                                onChange={setCreativity}
                                options={[
                                    { value: 'Optimal', label: t('optimal') },
                                    { value: 'Good', label: t('good') },
                                    { value: 'High', label: t('high') },
                                    { value: 'Max', label: t('max') },
                                ]}
                            />
                        </div>
                        <div>
                            <label className="text-xs font-medium text-gray-500 mb-1.5 block">{t('toneOfVoice')}</label>
                            <CustomSelect
                                value={toneOfVoice}
                                onChange={setToneOfVoice}
                                options={[
                                    { value: 'Professional', label: t('professional') },
                                    { value: 'Engaging', label: t('engaging') },
                                    { value: 'Funny', label: t('funny') },
                                    { value: 'Authoritative', label: t('authoritative') },
                                ]}
                            />
                        </div>
                    </div>

                    <button
                        onClick={handleGenerate}
                        disabled={isGenerating}
                        className="w-full py-3 bg-[#0b9f84] hover:bg-[#0a8c73] text-white rounded-lg font-semibold shadow-md transition-colors flex items-center justify-center gap-2"
                    >
                        {isGenerating ? (
                            <>
                                <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
                                {t('generating')}
                            </>
                        ) : t('generateBtn').replace(' (Imagen 4)', '')}
                    </button>
                </div>
            </div>

            {/* Right Column - Editor */}
            <div className="flex-1 bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 flex flex-col overflow-hidden">

                {/* --- CUSTOM HTML TOP TOOLBAR (from user design) --- */}
                <div className="relative py-4 px-6 border-b border-gray-100 dark:border-gray-700 flex flex-col gap-4">

                    {/* Header line with My Documents button */}
                    <div className="flex justify-between items-center w-full">
                        <Link to="/my-documents" className="text-sm font-medium text-gray-500 hover:text-[#0b9f84] transition-colors flex items-center gap-1.5">
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 19l-7-7m0 0l7-7m-7 7h18"></path></svg>
                            {t('myDocuments')}
                        </Link>
                    </div>

                    <div className="flex w-full flex-wrap items-center gap-3">
                        <div className="flex grow">
                            <div className="flex w-full flex-wrap items-center gap-2">
                                <button onClick={() => handleFormat('undo')} className="inline-flex h-8 w-8 items-center justify-center rounded-md transition-colors hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-600 dark:text-gray-300" title={t('undo')}>
                                    <svg className="h-5 w-5" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor" fill="none" strokeLinecap="round" strokeLinejoin="round">
                                        <path d="M9 14l-4 -4l4 -4"></path>
                                        <path d="M5 10h11a4 4 0 1 1 0 8h-1"></path>
                                    </svg>
                                </button>
                                <button onClick={() => handleFormat('redo')} className="inline-flex h-8 w-8 items-center justify-center rounded-md transition-colors hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-600 dark:text-gray-300" title={t('redo')}>
                                    <svg className="h-5 w-5" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor" fill="none" strokeLinecap="round" strokeLinejoin="round">
                                        <path d="M15 14l4 -4l-4 -4"></path>
                                        <path d="M19 10h-11a4 4 0 1 0 0 8h1"></path>
                                    </svg>
                                </button>
                                <button onClick={copyToClipboard} className="inline-flex h-8 w-8 items-center justify-center rounded-md transition-colors hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-600 dark:text-gray-300" title={t('copyToClipboard')}>
                                    <svg className="h-5 w-5" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor" fill="none" strokeLinecap="round" strokeLinejoin="round">
                                        <path d="M7 7m0 2.667a2.667 2.667 0 0 1 2.667 -2.667h8.666a2.667 2.667 0 0 1 2.667 2.667v8.666a2.667 2.667 0 0 1 -2.667 2.667h-8.666a2.667 2.667 0 0 1 -2.667 -2.667z"></path>
                                        <path d="M4.012 16.737a2.005 2.005 0 0 1 -1.012 -1.737v-10c0 -1.1 .9 -2 2 -2h10c.75 0 1.158 .385 1.5 1"></path>
                                    </svg>
                                </button>

                                {/* Download Dropdown */}
                                <div className="relative">
                                    <button
                                        onClick={() => setShowDownloadMenu(!showDownloadMenu)}
                                        className="inline-flex h-8 w-8 items-center justify-center rounded-md transition-colors hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-600 dark:text-gray-300"
                                        title={t('download')}
                                    >
                                        <svg className="h-5 w-5" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor" fill="none" strokeLinecap="round" strokeLinejoin="round">
                                            <path d="M4 17v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2 -2v-2"></path>
                                            <path d="M7 11l5 5l5 -5"></path>
                                            <path d="M12 4l0 12"></path>
                                        </svg>
                                    </button>

                                    {showDownloadMenu && (
                                        <div className="absolute top-full left-0 mt-1 w-44 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 shadow-lg rounded-lg py-1 z-50">
                                            <button onClick={downloadWord} className="w-full text-left px-4 py-2 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700 flex items-center gap-2">
                                                <svg strokeWidth="1.5" className="h-5 w-5" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" stroke="currentColor" fill="none" strokeLinecap="round" strokeLinejoin="round">
                                                    <path d="M4 18h9v-12l-5 2v5l-4 2v-8l9 -4l7 2v13l-7 3z"></path>
                                                </svg>
                                                {t('msWord')}
                                            </button>
                                            <button onClick={downloadPDF} className="w-full text-left px-4 py-2 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700 flex items-center gap-2">
                                                <svg strokeWidth="1.5" className="h-5 w-5" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" stroke="currentColor" fill="none" strokeLinecap="round" strokeLinejoin="round">
                                                    <path d="M20 4l-2 14.5l-6 2l-6 -2l-2 -14.5z"></path>
                                                    <path d="M15.5 8h-7l.5 4h6l-.5 3.5l-2.5 .75l-2.5 -.75l-.1 -.5"></path>
                                                </svg>
                                                {t('pdfDocument')}
                                            </button>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>

                        <div className="flex justify-end">
                            <button onClick={handleSave} className="group inline-flex items-center justify-center gap-1.5 text-xs font-medium rounded-md transition-all hover:-translate-y-0.5 hover:shadow-xl hover:shadow-black/5 bg-white text-gray-700 shadow-sm border border-gray-200 hover:bg-[#0b9f84] hover:text-white hover:border-[#0b9f84] py-1.5 px-3">
                                <svg strokeWidth="1.5" className="h-4 w-4" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" stroke="currentColor" fill="none" strokeLinecap="round" strokeLinejoin="round">
                                    <path d="M20 11a8.1 8.1 0 0 0 -15.5 -2m-.5 -4v4h4"></path>
                                    <path d="M4 13a8.1 8.1 0 0 0 15.5 2m.5 4v-4h-4"></path>
                                </svg>
                                {t('save')}
                            </button>
                        </div>
                    </div>

                    {/* Document Title Input */}
                    <div className="relative w-full">
                        <input
                            type="text"
                            value={documentTitle}
                            onChange={e => setDocumentTitle(e.target.value)}
                            placeholder={t('untitledDoc')}
                            className="block w-full py-2 bg-transparent text-gray-900 dark:text-gray-100 transition-colors focus:border-[#0b9f84] focus:outline-none focus:ring focus:ring-[#0b9f84]/20 h-12 border-transparent px-2 font-serif text-2xl placeholder-gray-400 dark:placeholder-gray-500 rounded-md"
                        />
                    </div>
                </div>

                {/* Main Toolbar (Text Formatting) */}
                <div className="flex items-center gap-1 p-2 border-b border-gray-100 dark:border-gray-700 bg-gray-50/50 dark:bg-gray-800/50 flex-wrap">
                    <select onChange={(e) => handleFormat('formatBlock', e.target.value)} className="bg-transparent border border-gray-200 rounded px-2 py-1.5 text-sm outline-none ml-2 mr-3 focus:border-[#0b9f84] focus:ring-1 focus:ring-[#0b9f84] transition-shadow">
                        <option value="p">{t('normalP')}</option>
                        <option value="h1">{t('heading1')}</option>
                        <option value="h2">{t('heading2')}</option>
                        <option value="h3">{t('heading3')}</option>
                    </select>

                    <button onClick={handleRewrite} disabled={isGenerating} className="px-3 py-1.5 flex items-center gap-1.5 text-sm font-medium text-[#0b9f84] hover:bg-[#0b9f84]/10 rounded-md border border-transparent transition mr-2 disabled:opacity-50 disabled:cursor-not-allowed">
                        <Sparkles size={16} /> {isGenerating ? '...' : t('rewriteBtn')}
                    </button>

                    <div className="w-px h-5 bg-gray-200 mx-1"></div>

                    <button onClick={() => handleFormat('bold')} className="p-1.5 text-gray-600 hover:bg-gray-200 rounded transition font-bold"><Bold size={16} /></button>
                    <button onClick={() => handleFormat('italic')} className="p-1.5 text-gray-600 hover:bg-gray-200 rounded transition italic"><Italic size={16} /></button>
                    <button onClick={() => handleFormat('underline')} className="p-1.5 text-gray-600 hover:bg-gray-200 rounded transition underline"><Underline size={16} /></button>

                    <div className="w-px h-5 bg-gray-200 mx-1"></div>

                    <button onClick={() => handleFormat('justifyLeft')} className="p-1.5 text-gray-600 hover:bg-gray-200 rounded transition"><AlignLeft size={16} /></button>
                    <button onClick={() => handleFormat('justifyCenter')} className="p-1.5 text-gray-600 hover:bg-gray-200 rounded transition"><AlignCenter size={16} /></button>
                    <button onClick={() => handleFormat('justifyRight')} className="p-1.5 text-gray-600 hover:bg-gray-200 rounded transition"><AlignRight size={16} /></button>

                    <div className="w-px h-5 bg-gray-200 mx-1"></div>

                    <button onClick={() => handleFormat('insertUnorderedList')} className="p-1.5 text-gray-600 hover:bg-gray-200 rounded transition"><List size={16} /></button>
                </div>

                {/* Editor Area */}
                <div
                    className="flex-1 p-8 outline-none overflow-y-auto font-body text-gray-800 dark:text-gray-100 prose dark:prose-invert max-w-none focus:ring-inset focus:ring-1 focus:ring-gray-100"
                    contentEditable
                    suppressContentEditableWarning
                    ref={editorRef}
                    onInput={(e) => setEditorContent(e.currentTarget.innerHTML)}
                >
                    <p><br /></p>
                </div>

            </div>
        </div>
    );
}
