import React, { useState } from 'react';

const ProfitMarginCalculator = () => {
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
                <h3 className="text-lg font-semibold text-gray-900">Profit Margin Calculator</h3>
            </div>

            <div className="space-y-4 mb-6 flex-1">
                <div>
                    <label className="block text-xs font-medium text-gray-500 mb-1">Cost / Expense ($)</label>
                    <input
                        type="number"
                        value={cost}
                        onChange={(e) => setCost(e.target.value)}
                        placeholder="e.g. 50"
                        className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary"
                    />
                </div>
                <div>
                    <label className="block text-xs font-medium text-gray-500 mb-1">Selling Price / Revenue ($)</label>
                    <input
                        type="number"
                        value={revenue}
                        onChange={(e) => setRevenue(e.target.value)}
                        placeholder="e.g. 120"
                        className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary"
                    />
                </div>
            </div>

            <div className="bg-gray-50 p-4 rounded-lg flex items-center justify-between border border-gray-100">
                <div>
                    <p className="text-xs text-gray-500">Net Profit</p>
                    <p className={`text-lg font-bold ${parseFloat(profit) >= 0 ? 'text-green-600' : 'text-red-500'}`}>${profit}</p>
                </div>
                <div className="text-right">
                    <p className="text-xs text-gray-500">Gross Margin</p>
                    <p className={`text-lg font-bold ${parseFloat(margin) >= 0 ? 'text-green-600' : 'text-red-500'}`}>{margin}%</p>
                </div>
            </div>
        </div>
    );
};

const WhatsAppTextFormatter = () => {
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
        navigator.clipboard.writeText(applyFormat());
        alert("Copied directly formatted text!");
    };

    return (
        <div className="bg-white p-6 rounded-xl border border-gray-100 shadow-sm flex flex-col h-full">
            <div className="flex items-center gap-3 mb-4 text-blue-500">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="4 7 4 4 20 4 20 7"></polyline><line x1="9" y1="20" x2="15" y2="20"></line><line x1="12" y1="4" x2="12" y2="20"></line></svg>
                <h3 className="text-lg font-semibold text-gray-900">WhatsApp Formatter</h3>
            </div>

            <p className="text-xs text-gray-500 mb-4">Quickly generate formatted text for WhatsApp broadcasts.</p>

            <div className="flex gap-2 mb-4">
                {['bold', 'italic', 'strikethrough', 'monospace'].map(opt => (
                    <button
                        key={opt}
                        onClick={() => setFormat(opt)}
                        className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${format === opt ? 'bg-blue-50 text-blue-600 border border-blue-200' : 'bg-white border border-gray-200 text-gray-600 hover:bg-gray-50'}`}
                    >
                        {opt.charAt(0).toUpperCase() + opt.slice(1)}
                    </button>
                ))}
            </div>

            <textarea
                value={text}
                onChange={(e) => setText(e.target.value)}
                placeholder="Enter text to format..."
                rows="3"
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 mb-4 flex-1 resize-none"
            ></textarea>

            <div className="flex gap-3">
                <div className="flex-1 bg-gray-50 p-2 text-sm rounded border border-gray-200 truncate select-all">
                    {applyFormat() || <span className="text-gray-400">Result will appear here...</span>}
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

const DiscountCalculator = () => {
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
                <h3 className="text-lg font-semibold text-gray-900">Discount & Promo Calculator</h3>
            </div>

            <div className="flex flex-col md:flex-row gap-6 mb-6">
                <div className="flex-1 space-y-4">
                    <div>
                        <label className="block text-xs font-medium text-gray-500 mb-1">Original Price ($)</label>
                        <input
                            type="number"
                            value={price}
                            onChange={(e) => setPrice(e.target.value)}
                            placeholder="e.g. 299.99"
                            className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-purple-500 focus:ring-1 focus:ring-purple-500"
                        />
                    </div>
                    <div>
                        <label className="block text-xs font-medium text-gray-500 mb-1">Discount (%)</label>
                        <input
                            type="number"
                            value={discount}
                            onChange={(e) => setDiscount(e.target.value)}
                            placeholder="e.g. 15"
                            className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-purple-500 focus:ring-1 focus:ring-purple-500"
                        />
                    </div>
                </div>

                <div className="flex-1 flex flex-col justify-center gap-4 bg-purple-50 p-6 rounded-xl border border-purple-100">
                    <div className="flex justify-between items-end border-b border-purple-200 pb-2">
                        <span className="text-sm font-medium text-purple-800">Final Price to Customer</span>
                        <span className="text-2xl font-bold text-purple-900">${final}</span>
                    </div>
                    <div className="flex justify-between items-end">
                        <span className="text-xs font-medium text-purple-600">Total Savings</span>
                        <span className="text-lg font-bold text-purple-600">-${saved}</span>
                    </div>
                </div>
            </div>

        </div>
    );
};

const ToolsBox = () => {
    return (
        <div className="max-w-6xl mx-auto py-8 px-4 sm:px-6 lg:px-8">
            <div className="mb-8">
                <h1 className="text-2xl font-bold text-gray-900">Utility Tools</h1>
                <p className="text-gray-500 text-sm mt-1">Quick calculators and formatters for your daily business operations.</p>
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
