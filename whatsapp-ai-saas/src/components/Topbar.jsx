import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import useAppStore from '../store';
import { useTranslation } from 'react-i18next';

import '../styles/global.css';

const Topbar = ({ activeInstance, currentTitle }) => {
    const { t } = useTranslation();
    const language = useAppStore(state => state.appSettings?.language) || 'en';
    const tasks = useAppStore(state => state.tasks) || [];
    const [showNotifications, setShowNotifications] = useState(false);

    // Calculate pending/due tasks
    const activeTasks = tasks.filter(task => task.status !== 'completed');
    const todayStr = new Date().toISOString().split('T')[0];

    const dueTasks = activeTasks.filter(task => {
        return task.date <= todayStr;
    });

    const getFormattedTitle = () => {
        if (!currentTitle || currentTitle === '/') return t('whatsappHub');
        if (currentTitle === '/whatsapp-hub') return activeInstance ? activeInstance.name : t('whatsappHub');
        if (currentTitle === '/dashboard') return t('dashboard');
        if (currentTitle === '/agents') return t('productPhotoTitle');
        if (currentTitle === '/agent-pipeline') return t('agentPipeline');
        if (currentTitle === '/tasks') return t('tasks');
        if (currentTitle === '/invoice-builder') return t('invoiceBuilder');
        if (currentTitle === '/tools') return t('tools');
        if (currentTitle === '/profile') return t('accountStrategy');
        if (currentTitle === '/settings') return t('appSettings');
        if (currentTitle === '/fashion/photoshoot') return t('photoShootTitle');
        return t('workspace');
    };

    return (
        <header className="relative h-[72px] px-6 flex items-center justify-between border-b border-gray-100 dark:border-gray-800 bg-white dark:bg-gray-900 z-20 shrink-0">
            <div className="flex items-center gap-4">
                {activeInstance && (currentTitle === '/whatsapp-hub' || currentTitle === '/') && (
                    <div className="relative">
                        <div className="size-11 rounded-full bg-cover bg-center ring-2 ring-gray-50 bg-primary/20 flex items-center justify-center text-primary font-bold">
                            {activeInstance.name.substring(0, 2).toUpperCase()}
                        </div>
                        <span className="absolute bottom-0 right-0 size-3 bg-green-500 border-2 border-white rounded-full"></span>
                    </div>
                )}
                <div>
                    <h2 className="font-display font-bold text-text-main dark:text-white text-lg leading-tight">
                        {getFormattedTitle()}
                    </h2>
                    {activeInstance && (currentTitle === '/whatsapp-hub' || currentTitle === '/') && (
                        <div className="flex items-center gap-2 mt-0.5">
                            <span className="text-xs text-text-muted dark:text-gray-400">{t('personalWhatsapp')}</span>
                            <span className="size-1 bg-gray-300 dark:bg-gray-600 rounded-full"></span>
                            <span className="text-xs text-green-600 dark:text-green-400 font-medium bg-green-50 dark:bg-green-900/40 px-1.5 rounded">{t('connectedStatus')}</span>
                        </div>
                    )}
                </div>
            </div>

            <div className="flex items-center gap-3">
                <div className="relative">
                    <button
                        onClick={() => setShowNotifications(!showNotifications)}
                        className="p-2 relative text-gray-400 hover:text-gray-600 dark:text-gray-500 dark:hover:text-gray-300 transition-colors bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-sm"
                    >
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"></path><path d="M13.73 21a2 2 0 0 1-3.46 0"></path></svg>
                        {dueTasks.length > 0 && (
                            <span className="absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-red-500 text-[10px] font-bold text-white border border-white dark:border-gray-900">
                                {dueTasks.length}
                            </span>
                        )}
                    </button>

                    {showNotifications && (
                        <div className="absolute right-0 mt-2 w-72 bg-white dark:bg-gray-800 rounded-xl shadow-lg border border-gray-100 dark:border-gray-700 z-50 overflow-hidden">
                            <div className="p-3 border-b border-gray-100 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50">
                                <h3 className="text-sm font-semibold text-gray-800 dark:text-gray-200">{t('pendingTasksDue')} ({dueTasks.length})</h3>
                            </div>
                            <div className="max-h-64 overflow-y-auto custom-scrollbar">
                                {dueTasks.length > 0 ? (
                                    dueTasks.map(task => (
                                        <div key={task.id} className="p-3 border-b border-gray-50 dark:border-gray-700/50 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors">
                                            <div className="text-sm font-medium text-gray-800 dark:text-gray-200 truncate" title={task.title}>{task.title}</div>
                                            <div className="text-xs text-red-500 font-medium mt-1 inline-block px-1.5 py-0.5 rounded bg-red-50 dark:bg-red-900/30 border border-red-100 dark:border-red-800/50">Due: {task.date}</div>
                                        </div>
                                    ))
                                ) : (
                                    <div className="p-4 text-center text-sm text-gray-500 dark:text-gray-400">
                                        {t('noPendingTasksDue')}
                                    </div>
                                )}
                            </div>
                            <Link to="/tasks" onClick={() => setShowNotifications(false)} className="block p-3 text-center text-sm font-medium text-primary hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors border-t border-gray-100 dark:border-gray-700">
                                {t('viewAllTasks')}
                            </Link>
                        </div>
                    )}
                </div>

                <Link to="/settings" className="flex items-center gap-2 px-3 py-1.5 rounded-lg border border-gray-200 dark:border-gray-700 text-sm font-semibold text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors shadow-sm bg-white dark:bg-gray-800">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="3"></circle><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"></path></svg>
                    {t('settings')}
                </Link>
            </div>
        </header>
    );
};

export default Topbar;
