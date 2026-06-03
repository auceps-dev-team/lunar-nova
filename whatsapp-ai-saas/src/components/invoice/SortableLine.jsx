import React from 'react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { fmt } from './helpers';

export default function SortableLine({ item, onUpdate, onRemove, currency, t }) {
    const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: item.id });
    const rowStyle = { transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? .45 : 1 };
    const total = (item.qty || 0) * (item.price || 0);

    return (
        <tr ref={setNodeRef} style={rowStyle} className={`group ${isDragging ? 'bg-emerald-50/50 dark:bg-emerald-900/10' : ''}`}>
            <td className="py-3 pr-2 w-6 no-print">
                <span {...attributes} {...listeners} className="cursor-grab text-gray-300 hover:text-gray-500 transition-colors">
                    <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><line x1="4" y1="9" x2="20" y2="9" /><line x1="4" y1="15" x2="20" y2="15" /></svg>
                </span>
            </td>
            <td className="py-3">
                <input className="w-full bg-transparent text-sm font-medium text-gray-800 dark:text-gray-200 outline-none placeholder:text-gray-300"
                    value={item.description} placeholder={t('serviceProductDescription')}
                    onChange={e => onUpdate(item.id, 'description', e.target.value)} />
            </td>
            <td className="py-3 w-20">
                <input type="number" min="1" className="w-full text-center text-sm bg-gray-50 dark:bg-gray-800 rounded-lg py-1 outline-none focus:ring-1 ring-emerald-400 text-gray-800 dark:text-gray-200"
                    value={item.qty} onChange={e => onUpdate(item.id, 'qty', parseFloat(e.target.value) || 1)} />
            </td>
            <td className="py-3 w-28">
                <input type="number" min="0" step="0.01" className="w-full text-right text-sm bg-gray-50 dark:bg-gray-800 rounded-lg py-1 px-2 outline-none focus:ring-1 ring-emerald-400 text-gray-800 dark:text-gray-200"
                    value={item.price} onChange={e => onUpdate(item.id, 'price', parseFloat(e.target.value) || 0)} />
            </td>
            <td className="py-3 w-28 text-right text-sm font-semibold text-gray-800 dark:text-gray-200">{fmt(total, currency)}</td>
            <td className="py-3 w-8 text-right no-print">
                <button onClick={() => onRemove(item.id)} className="p-1 rounded-lg opacity-0 group-hover:opacity-100 text-gray-300 hover:text-red-500 transition-all">
                    <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
                </button>
            </td>
        </tr>
    );
}
