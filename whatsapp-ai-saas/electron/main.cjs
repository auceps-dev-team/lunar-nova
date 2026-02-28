const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');

// Mute CSP warning in development
process.env['ELECTRON_DISABLE_SECURITY_WARNINGS'] = 'true';

// Enable Remote Debugging for Playwright Orchestrator (CDP)
app.commandLine.appendSwitch('remote-debugging-port', '8315');

let mainWindow;

function createWindow() {
    mainWindow = new BrowserWindow({
        width: 1200,
        height: 800,
        autoHideMenuBar: true,
        webPreferences: {
            preload: path.join(__dirname, 'preload.cjs'),
            nodeIntegration: false,
            contextIsolation: true,
            webviewTag: true // Allow <webview> tags for isolated WhatsApp instances
        }
    });

    // Fix: WhatsApp Web Unsupported Browser Error
    // We force a modern Chrome User-Agent for the entire app and all webviews
    const USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

    app.userAgentFallback = USER_AGENT;
    mainWindow.webContents.userAgent = USER_AGENT;

    // Optional: Intercept webview creation to enforce User-Agent
    mainWindow.webContents.on('will-attach-webview', (event, webPreferences, params) => {
        webPreferences.userAgent = USER_AGENT;
    });

    const isDev = process.env.NODE_ENV === 'development';
    if (isDev) {
        mainWindow.loadURL('http://localhost:5173');
        mainWindow.webContents.openDevTools();
    } else {
        mainWindow.loadFile(path.join(__dirname, '../dist/index.html'));
    }
}

app.whenReady().then(() => {
    ipcMain.handle('create-instance', (event, id) => {
        console.log(`[Main] Create instance requested: ${id}`);
        return true;
    });
    ipcMain.handle('remove-instance', (event, id) => {
        console.log(`[Main] Remove instance requested: ${id}`);
        return true;
    });

    createWindow();

    app.on('activate', function () {
        if (BrowserWindow.getAllWindows().length === 0) createWindow();
    });
});

app.on('window-all-closed', function () {
    if (process.platform !== 'darwin') app.quit();
});
