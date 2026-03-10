import React, { useState } from 'react';
import { Link } from 'react-router-dom';

export default function ContactLists() {
    const [lists, setLists] = useState([
        // Mock data for preview
        { id: '1', name: 'Clients VIP' }
    ]);

    return (
        <div className="max-w-7xl mx-auto space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <Link to="/dashboard" className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 text-sm flex items-center gap-1 mb-2 transition-colors">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M15 18l-6-6 6-6" /></svg>
                        Back to dashboard
                    </Link>
                    <h1 className="text-3xl font-extrabold text-gray-900 dark:text-white tracking-tight">Contact Lists</h1>
                </div>
                <button className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg font-medium text-sm flex items-center gap-2 transition-colors shadow-sm">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 5v14M5 12h14" /></svg>
                    Add Contact List
                </button>
            </div>

            <div className="bg-white dark:bg-zinc-900 border border-gray-100 dark:border-zinc-800 rounded-xl overflow-hidden shadow-sm">
                <div className="overflow-x-auto">
                    <table className="w-full text-left text-sm">
                        <thead className="bg-gray-50 dark:bg-zinc-800/50 text-gray-500 dark:text-gray-400 font-semibold text-xs tracking-wider uppercase">
                            <tr>
                                <th className="px-6 py-4 border-b border-gray-100 dark:border-zinc-800">ID</th>
                                <th className="px-6 py-4 border-b border-gray-100 dark:border-zinc-800">Name</th>
                                <th className="px-6 py-4 border-b border-gray-100 dark:border-zinc-800 text-right">Action</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100 dark:divide-zinc-800 text-gray-800 dark:text-zinc-200">
                            {lists.length === 0 ? (
                                <tr>
                                    <td colSpan="3" className="px-6 py-12 text-center text-gray-500 dark:text-zinc-500">
                                        No contact lists found.
                                    </td>
                                </tr>
                            ) : lists.map((list) => (
                                <tr key={list.id} className="hover:bg-gray-50/50 dark:hover:bg-zinc-800/30 transition-colors">
                                    <td className="px-6 py-4 text-gray-500 dark:text-zinc-400">#{list.id}</td>
                                    <td className="px-6 py-4 font-medium">{list.name}</td>
                                    <td className="px-6 py-4 text-right space-x-2">
                                        <button className="text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300 font-medium text-xs bg-blue-50 dark:bg-blue-900/20 px-3 py-1.5 rounded-md transition-colors">
                                            Edit
                                        </button>
                                        <button className="text-red-600 hover:text-red-800 dark:text-red-400 dark:hover:text-red-300 font-medium text-xs bg-red-50 dark:bg-red-900/20 px-3 py-1.5 rounded-md transition-colors">
                                            Delete
                                        </button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
}
