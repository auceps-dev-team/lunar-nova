import React, { useRef } from 'react';

export default function LogoPicker({ value, onChange, label, size = 56 }) {
    const ref = useRef(null);
    const handleFile = (e) => {
        const file = e.target.files?.[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = (ev) => onChange(ev.target.result);
        reader.readAsDataURL(file);
    };
    return (
        <div className="flex flex-col items-center gap-1 group cursor-pointer" onClick={() => ref.current?.click()}>
            <input ref={ref} type="file" accept="image/*" className="hidden" onChange={handleFile} />
            <div className="rounded-2xl border-2 border-dashed border-gray-200 dark:border-gray-700 hover:border-emerald-400 transition-all flex items-center justify-center overflow-hidden"
                style={{ width: size, height: size, background: value ? 'transparent' : '#f9fafb' }}>
                {value ? (
                    <img src={value} alt="logo" className="w-full h-full object-contain" />
                ) : (
                    <svg width="20" height="20" fill="none" stroke="#9ca3af" strokeWidth="1.5" viewBox="0 0 24 24">
                        <rect x="3" y="3" width="18" height="18" rx="4" /><circle cx="8.5" cy="8.5" r="1.5" /><path d="M21 15l-5-5L5 21" />
                    </svg>
                )}
            </div>
            <span className="text-[10px] font-medium text-gray-400 group-hover:text-emerald-500 transition-colors no-print">{label}</span>
        </div>
    );
}
