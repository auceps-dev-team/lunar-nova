const { app, BrowserWindow, ipcMain, dialog, shell, safeStorage } = require('electron');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const { utilityProcess } = require('electron');
const setupUpdater = require('./updater.cjs');

let store;

/**
 * Token partagé avec le backend. Doit rester strictement aligné sur
 * backend/apiAuth.js : même emplacement de fichier, même création exclusive ('wx')
 * pour que le process qui démarre en second relise la valeur du premier au lieu
 * de l'écraser.
 */
function loadOrCreateApiToken(baseDir) {
    const tokenFilePath = path.join(baseDir, 'api-token');
    const token = crypto.randomBytes(32).toString('hex');
    try {
        fs.mkdirSync(baseDir, { recursive: true });
        fs.writeFileSync(tokenFilePath, token, { encoding: 'utf8', flag: 'wx', mode: 0o600 });
        return token;
    } catch (err) {
        if (err.code !== 'EEXIST') throw err;
        return fs.readFileSync(tokenFilePath, 'utf8').trim();
    }
}

let apiToken = null;

/**
 * Clé maître servant à chiffrer les secrets stockés en base (clés d'API, mots de
 * passe d'application WordPress).
 *
 * Elle est scellée par safeStorage, qui s'appuie sur le magasin de secrets du
 * système : DPAPI sous Windows, Trousseau sous macOS, libsecret sous Linux. La
 * clé est ainsi liée au compte utilisateur de la machine — copier
 * database.sqlite et master-key.enc ailleurs ne suffit pas à lire les secrets.
 *
 * Si le magasin système est indisponible (Linux sans keyring, par exemple), on
 * retombe sur un fichier en clair : le chiffrement protège alors les
 * sauvegardes et les dossiers synchronisés, mais plus un accès disque local.
 */
function loadOrCreateMasterKey(baseDir) {
    const sealedPath = path.join(baseDir, 'master-key.enc');
    const plainPath = path.join(baseDir, 'master-key');

    try {
        if (safeStorage.isEncryptionAvailable()) {
            if (fs.existsSync(sealedPath)) {
                return safeStorage.decryptString(fs.readFileSync(sealedPath));
            }
            // Une clé en clair issue d'une installation précédente est reprise
            // puis scellée, pour ne pas rendre illisibles les secrets existants.
            const key = fs.existsSync(plainPath)
                ? fs.readFileSync(plainPath, 'utf8').trim()
                : crypto.randomBytes(32).toString('hex');

            fs.mkdirSync(baseDir, { recursive: true });
            fs.writeFileSync(sealedPath, safeStorage.encryptString(key), { mode: 0o600 });
            if (fs.existsSync(plainPath)) fs.rmSync(plainPath);
            return key;
        }
    } catch (err) {
        console.error('[Main] safeStorage indisponible, repli sur un fichier en clair:', err.message);
    }

    if (fs.existsSync(plainPath)) {
        return fs.readFileSync(plainPath, 'utf8').trim();
    }
    const key = crypto.randomBytes(32).toString('hex');
    fs.mkdirSync(baseDir, { recursive: true });
    fs.writeFileSync(plainPath, key, { encoding: 'utf8', mode: 0o600 });
    return key;
}

const isDev = process.env.NODE_ENV === 'development';

// Mute CSP warning in development only
if (isDev) {
    process.env['ELECTRON_DISABLE_SECURITY_WARNINGS'] = 'true';
}

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

    mainWindow.webContents.on('console-message', (event, level, message, line, sourceId) => {
        fs.appendFileSync(path.join(app.getPath('userData'), 'app_error.log'), `[Renderer] ${message} (${sourceId}:${line})\n`);
        console.log(`[Renderer] ${message} (${sourceId}:${line})`);
    });

    // Optional: Intercept webview creation to enforce User-Agent
    mainWindow.webContents.on('will-attach-webview', (event, webPreferences, params) => {
        webPreferences.userAgent = USER_AGENT;
    });

    if (isDev) {
        mainWindow.loadURL('http://localhost:5173');
        mainWindow.webContents.openDevTools();
    } else {
        mainWindow.loadFile(path.join(__dirname, '../dist/index.html'));
    }
}

let backendProcess = null;

app.whenReady().then(async () => {
    // Initialisation de electron-store (ESM require)
    try {
        const Store = (await import('electron-store')).default;
        store = new Store();
    } catch (err) {
        console.error('[Main] Failed to load electron-store:', err);
    }

    // Token d'API : créé avant le fork du backend en production (le backend relira
    // le fichier), lu depuis la racine du projet en développement (le backend est
    // alors lancé séparément par `npm run start:backend`).
    try {
        apiToken = loadOrCreateApiToken(isDev ? path.join(__dirname, '..') : app.getPath('userData'));
    } catch (err) {
        console.error('[Main] Failed to initialise API token:', err);
    }

    // Lancement du backend en production
    if (!isDev) {
        const backendPath = path.join(__dirname, '../backend/server.js');
        const userDataPath = app.getPath('userData');

        // La clé maître n'est résolue qu'en production : en développement le
        // backend est lancé séparément et gère lui-même son fichier de clé.
        let masterKey = null;
        try {
            masterKey = loadOrCreateMasterKey(userDataPath);
        } catch (err) {
            console.error('[Main] Failed to initialise master key:', err);
        }

        const backendLogStream = fs.createWriteStream(path.join(userDataPath, 'backend_out.log'), { flags: 'a' });
        const logEvent = (msg) => {
            try {
                fs.appendFileSync(path.join(userDataPath, 'backend_error.log'), `${new Date().toISOString()} ${msg}\n`);
            } catch { /* le disque peut être plein ; ne pas masquer l'erreur d'origine */ }
        };

        /**
         * Démarre le backend et le relance s'il meurt.
         *
         * Auparavant, une sortie du backend était seulement journalisée : la
         * fenêtre restait ouverte devant une application inerte, chaque écran
         * affichant une erreur réseau sans que rien n'indique la cause. Le
         * backend meurt notamment quand le port 3000 est déjà pris ou quand
         * l'initialisation de la base échoue — deux cas où il sort en code 1.
         *
         * Les tentatives sont espacées et plafonnées : au-delà, l'échec est
         * structurel et réessayer indéfiniment ne ferait que masquer le problème.
         */
        const MAX_RESTARTS = 3;
        let restartCount = 0;
        let intentionalShutdown = false;

        const startBackend = () => {
            try {
                backendProcess = utilityProcess.fork(backendPath, [], {
                    env: {
                        ...process.env,
                        NODE_ENV: 'production',
                        USER_DATA_PATH: userDataPath,
                        ...(masterKey ? { WACOPILOTE_MASTER_KEY: masterKey } : {})
                    },
                    stdio: 'pipe'
                });

                if (backendProcess.stdout) {
                    backendProcess.stdout.on('data', (data) => backendLogStream.write(data));
                }
                if (backendProcess.stderr) {
                    backendProcess.stderr.on('data', (data) => backendLogStream.write(data));
                }

                backendProcess.on('spawn', () => logEvent('[Backend] Démarré.'));

                backendProcess.on('error', (err) => {
                    console.error('[Main] Failed to start backend process:', err);
                    logEvent(`[Backend] Erreur de démarrage : ${err}`);
                });

                backendProcess.on('exit', (code, signal) => {
                    logEvent(`[Backend] Sortie — code ${code}, signal ${signal}`);
                    if (intentionalShutdown) return;

                    if (restartCount < MAX_RESTARTS) {
                        restartCount++;
                        const delay = restartCount * 2000;
                        logEvent(`[Backend] Relance ${restartCount}/${MAX_RESTARTS} dans ${delay} ms.`);
                        setTimeout(startBackend, delay);
                    } else {
                        logEvent('[Backend] Abandon après échecs répétés.');
                        dialog.showErrorBox(
                            'WaCopilote — service interne arrêté',
                            "Le service local de WaCopilote s'est arrêté et n'a pas pu redémarrer.\n\n" +
                            'Causes fréquentes : le port 3000 est déjà utilisé par un autre programme, ' +
                            "ou une autre instance de WaCopilote est déjà en cours d'exécution.\n\n" +
                            `Le détail figure dans :\n${path.join(userDataPath, 'backend_error.log')}`
                        );
                    }
                });
            } catch (err) {
                console.error('[Main] Fork error:', err);
                logEvent(`[Main] Exception au fork : ${err.stack || err}`);
            }
        };

        startBackend();
        app.on('before-quit', () => { intentionalShutdown = true; });
    }

    // Auto Updater (Setup Manual GitHub Releases)
    setupUpdater(mainWindow);

    // Le renderer récupère le token ici pour authentifier ses appels au backend.
    ipcMain.handle('get-api-token', () => apiToken);

    // IPC pour electron-store
    ipcMain.handle('store-get', (event, key) => {
        return store ? store.get(key) : null;
    });
    ipcMain.handle('store-set', (event, key, value) => {
        if (store) store.set(key, value);
        if (backendProcess) {
            backendProcess.postMessage({ type: 'UPDATE_ENV', key, value });
        }
        return true;
    });

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

app.on('before-quit', () => {
    if (backendProcess) {
        backendProcess.kill();
    }
});

app.on('window-all-closed', function () {
    if (process.platform !== 'darwin') app.quit();
});
