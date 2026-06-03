import React from 'react';

export default function KPI({ label, value, sub, icon, accent }) {
    return (
        <div className="bg-white dark:bg-[#1a1f25] rounded-2xl p-5 border border-gray-100 dark:border-gray-800 hover:shadow-lg transition-shadow duration-300">
            <div className="flex items-center gap-3 mb-3">
                <div className="w-10 h-10 rounded-xl flex items-center justify-center text-lg" style={{ background: accent + '18', color: accent }}>{icon}</div>
                <span className="text-[10px] font-bold uppercase tracking-[0.15em] text-gray-400">{label}</span>
            </div>
            <p className="text-[26px] font-extrabold text-gray-900 dark:text-white leading-none tracking-tight">{value}</p>
            {sub && <p className="text-xs text-gray-400 mt-1">{sub}</p>}
        </div>
    );
}
