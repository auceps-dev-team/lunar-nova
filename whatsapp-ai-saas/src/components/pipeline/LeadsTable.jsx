import React from 'react';
import { Phone, MapPin, Globe } from 'lucide-react';

/**
 * Read-only-selection leads table, mirroring the results table in
 * src/pages/whatsapp/Prospection.jsx so the pipeline wizard's stage 1 review
 * looks and behaves like the existing manual prospecting page.
 *
 * Selection state is owned by the parent (controlled component) so it can be
 * shared across the wizard's stage transitions without duplicating logic here.
 */
export default function LeadsTable({ leads, selectedNames, onToggle, onToggleAll }) {
    if (!leads || leads.length === 0) return null;

    const allSelected = leads.length > 0 && selectedNames.size === leads.length;

    return (
        <div className="overflow-x-auto border border-gray-200 dark:border-zinc-800 rounded-xl">
            <table className="w-full text-left text-sm">
                <thead className="bg-gray-50 dark:bg-zinc-800/50 text-gray-500 dark:text-gray-400 font-semibold text-xs tracking-wider uppercase select-none">
                    <tr>
                        <th className="px-4 py-3 border-b border-gray-100 dark:border-zinc-800 w-12 text-center">
                            <input
                                type="checkbox"
                                className="rounded border-gray-300 text-emerald-600 focus:ring-emerald-500 cursor-pointer"
                                checked={allSelected}
                                onChange={onToggleAll}
                            />
                        </th>
                        <th className="px-6 py-3 border-b border-gray-100 dark:border-zinc-800">Nom</th>
                        <th className="px-6 py-3 border-b border-gray-100 dark:border-zinc-800">Téléphone</th>
                        <th className="px-6 py-3 border-b border-gray-100 dark:border-zinc-800">Adresse & Web</th>
                    </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-zinc-800 text-gray-800 dark:text-zinc-200">
                    {leads.map((lead, idx) => (
                        <tr
                            key={idx}
                            className={`hover:bg-gray-50/50 dark:hover:bg-zinc-800/30 transition-colors ${selectedNames.has(lead.name) ? 'bg-emerald-50/50 dark:bg-emerald-900/10' : ''}`}
                        >
                            <td className="px-4 py-3 text-center">
                                <input
                                    type="checkbox"
                                    className="rounded border-gray-300 text-emerald-600 focus:ring-emerald-500 cursor-pointer"
                                    checked={selectedNames.has(lead.name)}
                                    onChange={() => onToggle(lead.name)}
                                />
                            </td>
                            <td className="px-6 py-3 font-medium">{lead.name}</td>
                            <td className="px-6 py-3 font-mono text-gray-600 dark:text-gray-400 whitespace-nowrap">
                                <span className="inline-flex items-center gap-1">
                                    <Phone className="h-3 w-3" />
                                    {lead.phone || '-'}
                                </span>
                            </td>
                            <td className="px-6 py-3 text-gray-500 dark:text-gray-400">
                                <div className="space-y-1">
                                    {lead.address && (
                                        <div className="flex items-start gap-2 text-gray-600 dark:text-gray-300 text-sm">
                                            <MapPin className="h-4 w-4 mt-0.5 shrink-0" />
                                            <span>{lead.address}</span>
                                        </div>
                                    )}
                                    {lead.website && (
                                        <a href={lead.website} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 text-emerald-600 hover:underline text-xs">
                                            <Globe className="h-3 w-3 flex-shrink-0" />
                                            <span className="truncate">{lead.website.replace('https://', '').replace('http://', '')}</span>
                                        </a>
                                    )}
                                    {!lead.address && !lead.website && '-'}
                                </div>
                            </td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );
}
