const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
    // We will expose APIs here for managing WhatsApp views and communicating with the Orchestrator
    ping: () => ipcRenderer.invoke('ping'),
    createInstance: (id) => ipcRenderer.invoke('create-instance', id),
    removeInstance: (id) => ipcRenderer.invoke('remove-instance', id),
    // PDF Export (Phase 18)
    printToPDF: (htmlContent, defaultFileName) => ipcRenderer.invoke('print-to-pdf', htmlContent, defaultFileName),
    // PDF to temp (Phase 18.3 — for WhatsApp send)
    savePdfTemp: (htmlContent, fileName) => ipcRenderer.invoke('save-pdf-temp', htmlContent, fileName),
});
