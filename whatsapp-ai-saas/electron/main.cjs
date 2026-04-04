const { app, BrowserWindow, ipcMain, dialog, shell } = require('electron');
const path = require('path');
const fs = require('fs');

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
        title: 'WaCopilote',
        icon: path.join(__dirname, '../public/assets/WaCopilot Logo.png'),
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

    ipcMain.handle('open-external-url', (event, url) => {
        console.log(`[Main] Opening external URL: ${url}`);
        shell.openExternal(url);
        return true;
    });

    // ── PDF Export: render HTML in hidden window → printToPDF → save dialog ──
    ipcMain.handle('print-to-pdf', async (event, htmlContent, defaultFileName) => {
        try {
            // Create a hidden BrowserWindow to render the invoice HTML
            const pdfWin = new BrowserWindow({
                width: 794,   // A4 at 96 DPI
                height: 1123,
                show: false,
                webPreferences: { nodeIntegration: false, contextIsolation: true }
            });

            // Load the HTML content as a data URI
            await pdfWin.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(htmlContent)}`);

            // Wait a moment for rendering (fonts, images)
            await new Promise(resolve => setTimeout(resolve, 600));

            // Generate the PDF buffer
            const pdfBuffer = await pdfWin.webContents.printToPDF({
                marginsType: 0,
                printBackground: true,
                pageSize: 'A4',
                landscape: false,
            });

            pdfWin.close();

            // Show save dialog
            const { filePath, canceled } = await dialog.showSaveDialog(mainWindow, {
                title: 'Exporter en PDF',
                defaultPath: defaultFileName || 'facture.pdf',
                filters: [{ name: 'PDF', extensions: ['pdf'] }],
            });

            if (canceled || !filePath) return { success: false, reason: 'cancelled' };

            // Write the PDF to disk
            fs.writeFileSync(filePath, pdfBuffer);
            console.log(`[Main] PDF saved to: ${filePath}`);
            return { success: true, path: filePath };

        } catch (err) {
            console.error('[Main] PDF export error:', err);
            return { success: false, reason: err.message };
        }
    });

    createWindow();

    app.on('activate', function () {
        if (BrowserWindow.getAllWindows().length === 0) createWindow();
    });
});

app.on('window-all-closed', function () {
    if (process.platform !== 'darwin') app.quit();
});
