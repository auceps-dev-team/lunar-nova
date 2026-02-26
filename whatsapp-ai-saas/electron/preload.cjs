const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
    // We will expose APIs here for managing WhatsApp views and communicating with the Orchestrator
    ping: () => ipcRenderer.invoke('ping'),
    createInstance: (id) => ipcRenderer.invoke('create-instance', id),
    removeInstance: (id) => ipcRenderer.invoke('remove-instance', id),
});
