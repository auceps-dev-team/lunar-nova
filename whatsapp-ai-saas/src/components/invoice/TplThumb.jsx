import React from 'react';

export default function TplThumb({ tpl, active, onClick, t }) {
    return (
        <button onClick={onClick} className={`w-full text-left transition-all duration-200 ${active ? 'scale-[1.02]' : 'hover:scale-[1.01]'}`}>
            <div className={`aspect-[3/4] rounded-xl overflow-hidden border-2 transition-all duration-200 ${active ? 'border-emerald-500 shadow-lg shadow-emerald-500/10' : 'border-gray-100 dark:border-gray-700 hover:border-gray-300'}`}>
                <div style={{ background: tpl.colors[0] }} className="h-[28%]"></div>
                <div style={{ background: tpl.colors[2] }} className="flex-1 p-2 space-y-1.5">
                    <div className="h-1.5 w-1/2 rounded-full" style={{ background: tpl.colors[0] + '30' }}></div>
                    <div className="h-1 w-full rounded-full bg-gray-100"></div>
                    <div className="h-1 w-3/4 rounded-full bg-gray-100"></div>
                    <div className="h-6 w-full mt-2 rounded bg-gray-50 border border-gray-100"></div>
                    <div className="h-1 w-full rounded-full bg-gray-100"></div>
                </div>
            </div>
            <div className="flex items-center justify-between mt-2">
                <span className="text-xs font-semibold text-gray-700 dark:text-gray-300">{t(tpl.labelKey)}</span>
                {active && <div className="w-4 h-4 rounded-full bg-emerald-500 flex items-center justify-center"><svg width="10" height="10" fill="none" stroke="#fff" strokeWidth="3" viewBox="0 0 24 24"><path d="M20 6L9 17l-5-5" /></svg></div>}
            </div>
        </button>
    );
}
