import React, { useState } from 'react';
import useAppStore from '../store';
import { useTranslation } from 'react-i18next';

/**
 * Calculateur de marge bénéficiaire
 */
const ProfitMarginCalculator = () => {
    const { t } = useTranslation();
    const [cost, setCost] = useState('');
    const [revenue, setRevenue] = useState('');

    const calculateMargin = () => {
        const c = parseFloat(cost);
        const r = parseFloat(revenue);
        if (isNaN(c) || isNaN(r) || r === 0) return { profit: 0, margin: 0 };
        const profit = r - c;
        const margin = (profit / r) * 100;
        return { profit: profit.toFixed(2), margin: margin.toFixed(2) };
    };

    const { profit, margin } = calculateMargin();

    return (
        <div className="bg-white p-6 rounded-xl border border-gray-100 shadow-sm flex flex-col h-full">
            <div className="flex items-center gap-3 mb-4 text-primary">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="1" x2="12" y2="23"></line><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"></path></svg>
                <h3 className="text-lg font-semibold text-gray-900">{t('profitCalculator')}</h3>
            </div>

            <div className="space-y-4 mb-6 flex-1">
                <div>
                    <label className="block text-xs font-medium text-gray-500 mb-1">{t('costExpense')}</label>
                    <input
                        type="number"
                        value={cost}
                        onChange={(e) => setCost(e.target.value)}
                        placeholder={t('placeholderEg50')}
                        className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary"
                    />
                </div>
                <div>
                    <label className="block text-xs font-medium text-gray-500 mb-1">{t('sellingPrice')}</label>
                    <input
                        type="number"
                        value={revenue}
                        onChange={(e) => setRevenue(e.target.value)}
                        placeholder={t('placeholderEg120')}
                        className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary"
                    />
                </div>
            </div>

            <div className="bg-gray-50 p-4 rounded-lg flex items-center justify-between border border-gray-100">
                <div>
                    <p className="text-xs text-gray-500">{t('netProfit')}</p>
                    <p className={`text-lg font-bold ${parseFloat(profit) >= 0 ? 'text-green-600' : 'text-red-500'}`}>${profit}</p>
                </div>
                <div className="text-right">
                    <p className="text-xs text-gray-500">{t('grossMargin')}</p>
                    <p className={`text-lg font-bold ${parseFloat(margin) >= 0 ? 'text-green-600' : 'text-red-500'}`}>{margin}%</p>
                </div>
            </div>
        </div>
    );
};

/**
 * Formateur de texte pour WhatsApp
 */
const WhatsAppTextFormatter = () => {
    const { t } = useTranslation();
    const showAppNotification = useAppStore(state => state.showAppNotification);
    const [text, setText] = useState('');
    const [format, setFormat] = useState('bold');


    const applyFormat = () => {
        if (!text) return '';
        switch (format) {
            case 'bold': return `*${text}*`;
            case 'italic': return `_${text}_`;
            case 'strikethrough': return `~${text}~`;
            case 'monospace': return "```" + text + "```";
            default: return text;
        }
    };

    const handleCopy = () => {
        const formatted = applyFormat();
        // Utilisation de document.execCommand pour assurer la compatibilité dans l'iframe de l'application
        const textArea = document.createElement("textarea");
        textArea.value = formatted;
        document.body.appendChild(textArea);
        textArea.select();
        try {
            document.execCommand('copy');
            if (showAppNotification) {
                showAppNotification(t('successCopiedFormatted'), 'success');
            }
        } catch (err) {
            console.error('Erreur lors de la copie', err);
        }
        document.body.removeChild(textArea);
    };

    const formatOptions = [
        { id: 'bold', label: t('bold') },
        { id: 'italic', label: t('italic') },
        { id: 'strikethrough', label: t('strikethrough') },
        { id: 'monospace', label: t('monospace') }
    ];

    return (
        <div className="bg-white p-6 rounded-xl border border-gray-100 shadow-sm flex flex-col h-full">
            <div className="flex items-center gap-3 mb-4 text-blue-500">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="4 7 4 4 20 4 20 7"></polyline><line x1="9" y1="20" x2="15" y2="20"></line><line x1="12" y1="4" x2="12" y2="20"></line></svg>
                <h3 className="text-lg font-semibold text-gray-900">{t('waFormatter')}</h3>
            </div>

            <p className="text-xs text-gray-500 mb-4">{t('waFormatterDesc')}</p>

            <div className="flex flex-wrap gap-2 mb-4">
                {formatOptions.map(opt => (
                    <button
                        key={opt.id}
                        onClick={() => setFormat(opt.id)}
                        className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${format === opt.id ? 'bg-blue-50 text-blue-600 border border-blue-200' : 'bg-white border border-gray-200 text-gray-600 hover:bg-gray-50'}`}
                    >
                        {opt.label}
                    </button>
                ))}
            </div>

            <textarea
                value={text}
                onChange={(e) => setText(e.target.value)}
                placeholder={t('enterText')}
                rows="3"
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 mb-4 flex-1 resize-none"
            ></textarea>

            <div className="flex gap-3">
                <div className="flex-1 bg-gray-50 p-2 text-sm rounded border border-gray-200 truncate select-all">
                    {applyFormat() || <span className="text-gray-400">{t('resultHere')}</span>}
                </div>
                <button
                    onClick={handleCopy}
                    disabled={!text}
                    className="shrink-0 bg-blue-500 text-white p-2 rounded hover:bg-blue-600 disabled:opacity-50 transition-colors"
                >
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg>
                </button>
            </div>
        </div>
    );
};

/**
 * Calculateur de remise et promotion
 */
const DiscountCalculator = () => {
    const { t } = useTranslation();
    const [price, setPrice] = useState('');
    const [discount, setDiscount] = useState('');


    const calculate = () => {
        const p = parseFloat(price);
        const d = parseFloat(discount);
        if (isNaN(p) || isNaN(d)) return { final: 0, saved: 0 };

        const saved = p * (d / 100);
        const final = p - saved;
        return { final: final.toFixed(2), saved: saved.toFixed(2) };
    };

    const { final, saved } = calculate();

    return (
        <div className="bg-white p-6 rounded-xl border border-gray-100 shadow-sm flex flex-col h-full lg:col-span-2">
            <div className="flex items-center gap-3 mb-4 text-purple-500">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="19" y1="5" x2="5" y2="19"></line><circle cx="6.5" cy="6.5" r="2.5"></circle><circle cx="17.5" cy="17.5" r="2.5"></circle></svg>
                <h3 className="text-lg font-semibold text-gray-900">{t('discountPromo')}</h3>
            </div>

            <div className="flex flex-col md:flex-row gap-6 mb-6">
                <div className="flex-1 space-y-4">
                    <div>
                        <label className="block text-xs font-medium text-gray-500 mb-1">{t('originalPrice')}</label>
                        <input
                            type="number"
                            value={price}
                            onChange={(e) => setPrice(e.target.value)}
                            placeholder={t('placeholderEg299')}
                            className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-purple-500 focus:ring-1 focus:ring-purple-500"
                        />
                    </div>
                    <div>
                        <label className="block text-xs font-medium text-gray-500 mb-1">{t('discountPercent')}</label>
                        <input
                            type="number"
                            value={discount}
                            onChange={(e) => setDiscount(e.target.value)}
                            placeholder={t('placeholderEg15')}
                            className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-purple-500 focus:ring-1 focus:ring-purple-500"
                        />
                    </div>
                </div>

                <div className="flex-1 flex flex-col justify-center gap-4 bg-purple-50 p-6 rounded-xl border border-purple-100">
                    <div className="flex justify-between items-end border-b border-purple-200 pb-2">
                        <span className="text-sm font-medium text-purple-800">{t('finalPrice')}</span>
                        <span className="text-2xl font-bold text-purple-900">${final}</span>
                    </div>
                    <div className="flex justify-between items-end">
                        <span className="text-xs font-medium text-purple-600">{t('totalSavings')}</span>
                        <span className="text-lg font-bold text-purple-600">-${saved}</span>
                    </div>
                </div>
            </div>

        </div>
    );
};

/**
 * Composant principal de la boîte à outils
 */
const ToolsBox = () => {
    const { t } = useTranslation();

    return (
        <div className="max-w-6xl mx-auto py-8 px-4 sm:px-6 lg:px-8">
            <div className="mb-8">
                <h1 className="text-2xl font-bold text-gray-900">{t('utilityTools')}</h1>
                <h2 className="text-gray-500 text-sm mt-1">{t('utilityToolsDesc')}</h2>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <ProfitMarginCalculator />
                <WhatsAppTextFormatter />
                <DiscountCalculator />
            </div>
        </div>
    );
};

export default ToolsBox;
