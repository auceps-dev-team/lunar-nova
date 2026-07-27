const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
    // We will expose APIs here for managing WhatsApp views and communicating with the Orchestrator
    ping: () => ipcRenderer.invoke('ping'),
    createInstance: (id) => ipcRenderer.invoke('create-instance', id),
    removeInstance: (id) => ipcRenderer.invoke('remove-instance', id),
    // PDF Export (Phase 18)
    printToPDF: (htmlContent, defaultFileName) => ipcRenderer.invoke('print-to-pdf', htmlContent, defaultFileName),
    // Auth (Phase 21b)
    openExternalUrl: (url) => ipcRenderer.invoke('open-external-url', url),
    // Config Store
    storeGet: (key) => ipcRenderer.invoke('store-get', key),
    storeSet: (key, value) => ipcRenderer.invoke('store-set', key, value),
    // Token d'authentification pour les appels au backend local
    getApiToken: () => ipcRenderer.invoke('get-api-token'),
});

// NOUVEAU : Exposer le pont Updater
contextBridge.exposeInMainWorld('updaterAPI', {
    getVersion: () => ipcRenderer.invoke('update:get-version'),
    checkForUpdates: () => ipcRenderer.invoke('update:check'),
    startDownload: (url) => ipcRenderer.invoke('update:start-download', url),
    installUpdate: (filePath) => ipcRenderer.invoke('update:install', filePath),
    onProgress: (callback) => {
        ipcRenderer.removeAllListeners('update:progress');
        ipcRenderer.on('update:progress', (event, percent) => callback(percent));
    }
});
