import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import useAppStore from '../store';

export default function UpdateManager() {
    const { t } = useTranslation();
    const [status, setStatus] = useState('IDLE'); // IDLE, CHECKING, AVAILABLE, DOWNLOADING, READY
    const [updateInfo, setUpdateInfo] = useState(null);
    const [progress, setProgress] = useState(0);
    const showAppNotification = useAppStore(state => state.showAppNotification);

    const checkUpdate = async () => {
        if (!window.updaterAPI) {
            showAppNotification(t('updaterNotAvailable'), "error");
            return;
        }

        setStatus('CHECKING');
        const result = await window.updaterAPI.checkForUpdates();
        
        if (result.hasUpdate) {
            setUpdateInfo(result);
            setStatus('AVAILABLE');
        } else {
            setStatus('IDLE');
            showAppNotification(t('updaterUpToDate'), "success");
        }
    };

    const startDownload = async () => {
        setStatus('DOWNLOADING');
        
        window.updaterAPI.onProgress((percent) => {
            setProgress(percent);
        });

        const downloadResult = await window.updaterAPI.startDownload(updateInfo.downloadUrl);
        
        if (downloadResult.success) {
            setUpdateInfo({ ...updateInfo, filePath: downloadResult.filePath });
            setStatus('READY');
        } else {
            setStatus('AVAILABLE');
            showAppNotification(t('updaterDownloadError') + downloadResult.error, "error");
        }
    };

    const install = () => {
        window.updaterAPI.installUpdate(updateInfo.filePath);
    };

    return (
        <div className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700">
            <div className="flex items-center justify-between">
                <div>
                    <h3 className="text-base font-semibold text-gray-900 dark:text-white">{t('updaterTitle')}</h3>
                    <p className="text-sm text-gray-500 mt-1">{t('updaterDesc')}</p>
                </div>

                {status === 'IDLE' && (
                    <button onClick={checkUpdate} className="px-4 py-2 bg-gray-100 hover:bg-gray-200 dark:bg-gray-700 dark:hover:bg-gray-600 text-gray-800 dark:text-white text-sm font-medium rounded-lg transition-colors">
                        {t('updaterCheckBtn')}
                    </button>
                )}
                {status === 'CHECKING' && <p className="text-sm font-medium text-gray-500 animate-pulse">{t('updaterChecking')}</p>}
            </div>

            {status === 'AVAILABLE' && (
                <div className="mt-4 p-4 bg-blue-50 dark:bg-blue-900/30 border border-blue-100 dark:border-blue-800 rounded-lg flex items-center justify-between">
                    <div>
                        <p className="text-blue-800 dark:text-blue-300 font-semibold mb-1">{t('updaterAvailable', { version: updateInfo.version })}</p>
                        <p className="text-xs text-blue-600 dark:text-blue-400">{t('updaterAvailableDesc')}</p>
                    </div>
                    <button onClick={startDownload} className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg shadow-sm">
                        {t('updaterDownloadBtn')}
                    </button>
                </div>
            )}

            {status === 'DOWNLOADING' && (
                <div className="mt-4 p-4 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
                    <div className="flex justify-between text-xs font-medium text-gray-600 dark:text-gray-300 mb-2">
                        <span>{t('updaterDownloading')}</span>
                        <span>{progress}%</span>
                    </div>
                    <div className="w-full bg-gray-200 dark:bg-gray-600 rounded-full h-2.5">
                        <div className="bg-blue-600 h-2.5 rounded-full transition-all duration-300 ease-out" style={{ width: `${progress}%` }}></div>
                    </div>
                </div>
            )}

            {status === 'READY' && (
                <div className="mt-4 p-4 bg-green-50 dark:bg-green-900/30 border border-green-100 dark:border-green-800 rounded-lg flex items-center justify-between">
                    <div>
                        <p className="text-green-800 dark:text-green-300 font-semibold mb-1">{t('updaterReady')}</p>
                        <p className="text-xs text-green-600 dark:text-green-400">{t('updaterReadyDesc')}</p>
                    </div>
                    <button onClick={install} className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white text-sm font-medium rounded-lg shadow-sm animate-pulse">
                        {t('updaterInstallBtn')}
                    </button>
                </div>
            )}
        </div>
    );
}
