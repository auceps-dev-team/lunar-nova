import React from 'react';

export function TableSkeleton({ rows = 5, columns = 4 }) {
    return (
        <div className="w-full bg-white dark:bg-zinc-900 border border-gray-200 dark:border-zinc-800 rounded-xl overflow-hidden shadow-sm animate-pulse">
            <div className="p-4 border-b border-gray-200 dark:border-zinc-800 flex justify-between">
                <div className="h-6 bg-gray-200 dark:bg-zinc-700 rounded w-1/4"></div>
                <div className="h-8 bg-gray-200 dark:bg-zinc-700 rounded w-32"></div>
            </div>
            <div className="overflow-x-auto">
                <table className="w-full text-left">
                    <thead className="bg-gray-50 dark:bg-zinc-800/50">
                        <tr>
                            {Array.from({ length: columns }).map((_, i) => (
                                <th key={i} className="px-6 py-4">
                                    <div className="h-4 bg-gray-200 dark:bg-zinc-700 rounded w-3/4"></div>
                                </th>
                            ))}
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100 dark:divide-zinc-800">
                        {Array.from({ length: rows }).map((_, rowIndex) => (
                            <tr key={rowIndex}>
                                {Array.from({ length: columns }).map((_, colIndex) => (
                                    <td key={colIndex} className="px-6 py-4">
                                        <div className={`h-4 bg-gray-200 dark:bg-zinc-700 rounded ${colIndex === 0 ? 'w-1/2' : 'w-full'}`}></div>
                                    </td>
                                ))}
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
}

export function Skeleton({ h = 16, w = '100%', r = 'rounded-md' }) {
    return (
        <div
            className={`bg-gray-200 dark:bg-zinc-700 animate-pulse ${r}`}
            style={{ height: h, width: w }}
        />
    );
}

export function CardSkeleton() {
    return (
        <div className="bg-white dark:bg-zinc-900 border border-gray-200 dark:border-zinc-800 rounded-xl p-6 shadow-sm animate-pulse">
            <div className="flex items-center gap-4 mb-4">
                <div className="w-12 h-12 bg-gray-200 dark:bg-zinc-700 rounded-full"></div>
                <div className="flex-1">
                    <div className="h-5 bg-gray-200 dark:bg-zinc-700 rounded w-1/2 mb-2"></div>
                    <div className="h-4 bg-gray-200 dark:bg-zinc-700 rounded w-1/4"></div>
                </div>
            </div>
            <div className="space-y-3">
                <div className="h-4 bg-gray-200 dark:bg-zinc-700 rounded w-full"></div>
                <div className="h-4 bg-gray-200 dark:bg-zinc-700 rounded w-5/6"></div>
                <div className="h-4 bg-gray-200 dark:bg-zinc-700 rounded w-2/3"></div>
            </div>
        </div>
    );
}
