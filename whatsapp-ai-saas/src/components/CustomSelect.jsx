import React, { useState, useRef, useEffect, useCallback } from 'react';

/**
 * CustomSelect — Dropdown stylisé réutilisable
 *
 * Props:
 *  - value        : valeur actuellement sélectionnée (string)
 *  - onChange     : (value) => void
 *  - options      : Array<{ value: string, label: string, description?: string }>
 *  - placeholder  : string (affiché si aucune valeur)
 *  - searchable   : boolean — affiche un champ de recherche dans le panneau
 *  - className    : string — classes supplémentaires sur le trigger
 *  - panelWidth   : string — largeur du panneau (ex: 'w-64', 'w-80') default 'w-56'
 *  - disabled     : boolean
 */

export default function CustomSelect({
    value,
    onChange,
    options = [],
    placeholder = '—',
    searchable = false,
    className = '',
    panelWidth = 'w-56',
    width = 'w-full',
    disabled = false,
    icon = null,
}) {
    const [open, setOpen] = useState(false);
    const [search, setSearch] = useState('');
    const ref = useRef(null);

    // Fermeture au clic extérieur
    useEffect(() => {
        const handler = (e) => {
            if (ref.current && !ref.current.contains(e.target)) {
                setOpen(false);
                setSearch('');
            }
        };
        document.addEventListener('mousedown', handler);
        return () => document.removeEventListener('mousedown', handler);
    }, []);

    const selected = options.find(o => o.value === value);

    const filtered = searchable && search.trim()
        ? options.filter(o =>
            o.label.toLowerCase().includes(search.toLowerCase()) ||
            (o.description || '').toLowerCase().includes(search.toLowerCase())
        )
        : options;

    const handleSelect = useCallback((opt) => {
        onChange(opt.value);
        setOpen(false);
        setSearch('');
    }, [onChange]);

    return (
        <div ref={ref} className={`relative ${width} ${disabled ? 'opacity-60 pointer-events-none' : ''}`}>

            {/* ── Trigger ── */}
            <button
                type="button"
                onClick={() => setOpen(v => !v)}
                className={[
                    'flex items-center gap-2 py-2 rounded-lg',
                    icon ? 'pl-3 pr-3' : 'px-3',
                    'bg-gray-50 dark:bg-zinc-800',
                    'border border-gray-200 dark:border-zinc-700',
                    'text-sm text-gray-800 dark:text-gray-200',
                    'hover:border-emerald-400 dark:hover:border-emerald-500',
                    'focus:outline-none focus:ring-2 focus:ring-emerald-500/30',
                    'transition-all duration-150',
                    'w-full',
                    open ? 'border-emerald-500 ring-2 ring-emerald-500/20' : '',
                    className,
                ].join(' ')}
            >
                {icon && <span className="flex-shrink-0 text-gray-400">{icon}</span>}
                <span className="flex-1 text-left truncate">
                    {selected?.label ?? placeholder}
                </span>

                {/* Chevron */}
                <svg
                    className={`w-4 h-4 text-gray-400 flex-shrink-0 transition-transform duration-200 ${open ? 'rotate-180' : ''}`}
                    viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
                >
                    <polyline points="6 9 12 15 18 9" />
                </svg>
            </button>

            {/* ── Panneau ── */}
            {open && (
                <div className={[
                    'absolute z-50 top-[calc(100%+6px)] left-0',
                    panelWidth,
                    'bg-white dark:bg-zinc-900',
                    'border border-gray-100 dark:border-zinc-700',
                    'rounded-xl shadow-xl overflow-hidden',
                    'animate-in fade-in slide-in-from-top-2 duration-150',
                ].join(' ')}>

                    {/* Champ de recherche */}
                    {searchable && (
                        <div className="p-2 border-b border-gray-100 dark:border-zinc-800">
                            <div className="relative">
                                <svg
                                    className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400"
                                    width="13" height="13" viewBox="0 0 24 24" fill="none"
                                    stroke="currentColor" strokeWidth="2"
                                >
                                    <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
                                </svg>
                                <input
                                    autoFocus
                                    value={search}
                                    onChange={e => setSearch(e.target.value)}
                                    placeholder="Rechercher..."
                                    className="w-full pl-8 pr-3 py-1.5 text-sm rounded-lg border border-gray-200 dark:border-zinc-700 bg-gray-50 dark:bg-zinc-800 dark:text-gray-200 outline-none focus:border-emerald-500 transition"
                                />
                            </div>
                        </div>
                    )}

                    {/* Liste des options */}
                    <div className="max-h-64 overflow-y-auto py-1">
                        {filtered.length === 0 && (
                            <p className="text-xs text-gray-400 text-center py-4">Aucun résultat</p>
                        )}
                        {filtered.map(opt => {
                            const isActive = opt.value === value;
                            return (
                                <button
                                    key={opt.value}
                                    type="button"
                                    onClick={() => handleSelect(opt)}
                                    className={[
                                        'w-full flex items-center gap-3 px-3 py-2.5 text-left',
                                        'transition-colors duration-100',
                                        isActive
                                            ? 'bg-emerald-50 dark:bg-emerald-900/30'
                                            : 'hover:bg-gray-50 dark:hover:bg-zinc-800',
                                    ].join(' ')}
                                >
                                    {/* Textes */}
                                    <div className="flex-1 min-w-0">
                                        <p className={`text-sm font-medium truncate ${isActive ? 'text-emerald-700 dark:text-emerald-400' : 'text-gray-800 dark:text-gray-200'}`}>
                                            {opt.label}
                                        </p>
                                        {opt.description && (
                                            <p className="text-xs text-gray-400 truncate mt-0.5">{opt.description}</p>
                                        )}
                                    </div>

                                    {/* Checkmark pour l'élément actif */}
                                    {isActive && (
                                        <svg className="flex-shrink-0 text-emerald-500" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                                            <polyline points="20 6 9 17 4 12" />
                                        </svg>
                                    )}
                                </button>
                            );
                        })}
                    </div>
                </div>
            )}
        </div>
    );
}
