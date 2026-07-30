const { app, ipcMain } = require('electron');
const axios = require('axios');
const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');

const REPO_URL = 'https://api.github.com/repos/auceps-dev-team/wacopilote-releases/releases/latest';

/**
 * @param {() => Electron.BrowserWindow | undefined} getMainWindow
 *
 * Un accesseur, et non la fenêtre elle-même : setupUpdater est appelé avant
 * createWindow, donc recevoir `mainWindow` directement revenait à capturer
 * `undefined` pour toute la durée de vie de l'application. La garde
 * `if (mainWindow && ...)` n'était alors jamais vraie et aucun événement de
 * progression n'atteignait l'interface — la barre restait figée à 0 %.
 * L'accesseur résout la fenêtre au moment de l'envoi, et reste valide si elle
 * est recréée (réactivation sous macOS).
 */
module.exports = function setupUpdater(getMainWindow) {
    // 0. OBTENTION DE LA VERSION LOCALE
    ipcMain.handle('update:get-version', () => {
        return app.getVersion();
    });

    // 1. VÉRIFICATION DE LA VERSION
    ipcMain.handle('update:check', async () => {
        try {
            const res = await axios.get(REPO_URL);
            const latestVersion = res.data.tag_name.replace('v', '');
            const currentVersion = app.getVersion();
            
            // Simple semantic version comparator
            const compareVersions = (v1, v2) => {
                const p1 = String(v1).split('.').map(Number);
                const p2 = String(v2).split('.').map(Number);
                for (let i = 0; i < Math.max(p1.length, p2.length); i++) {
                    const n1 = p1[i] || 0;
                    const n2 = p2[i] || 0;
                    if (n1 > n2) return 1;
                    if (n1 < n2) return -1;
                }
                return 0;
            };

            if (compareVersions(latestVersion, currentVersion) > 0) {
                // Trouver l'asset Windows (.exe)
                const exeAsset = res.data.assets.find(a => a.name.endsWith('.exe'));
                return {
                    hasUpdate: true,
                    version: latestVersion,
                    notes: res.data.body,
                    downloadUrl: exeAsset ? exeAsset.browser_download_url : null,
                };
            }
            return { hasUpdate: false };
        } catch (e) {
            console.error("[Updater] Erreur check update", e);
            return { hasUpdate: false, error: e.message };
        }
    });

    // 2. TÉLÉCHARGEMENT FLUIDE
    ipcMain.handle('update:start-download', async (event, url) => {
        const tempPath = path.join(app.getPath('temp'), `WaCopilote-Update-${Date.now()}.exe`);
        
        try {
            const response = await axios({
                method: 'GET',
                url: url,
                responseType: 'stream' // stream response back for progress
            });

            const totalLength = parseInt(response.headers['content-length'], 10);
            let downloaded = 0;
            let lastPercent = 0;

            const writer = fs.createWriteStream(tempPath);
            response.data.pipe(writer);

            response.data.on('data', (chunk) => {
                downloaded += chunk.length;
                
                // Calcul sécurisé du pourcentage
                let percent = 0;
                if (totalLength && totalLength > 0) {
                    percent = Math.round((downloaded / totalLength) * 100);
                } else {
                    // Si pas de content-length, on simule une progression lente basée sur des moyennes (environ 40Mo)
                    // ou on laisse à 0 pour indiquer une activité indéterminée
                    percent = Math.min(99, Math.round((downloaded / (40 * 1024 * 1024)) * 100));
                }
                
                // Throttling: on n'envoie au front que si le pourcentage change
                if (percent > lastPercent) {
                    lastPercent = percent;
                    const win = getMainWindow();
                    if (win && !win.isDestroyed()) {
                        win.webContents.send('update:progress', percent);
                    }
                }
            });

            return new Promise((resolve, reject) => {
                writer.on('finish', () => resolve({ success: true, filePath: tempPath }));
                writer.on('error', reject);
            });

        } catch (error) {
            return { success: false, error: error.message };
        }
    });

    // 3. INSTALLATION DÉTACHÉE
    ipcMain.handle('update:install', async (event, filePath) => {
        // Lance NSIS en processus détaché pour forcer l'installation
        const subprocess = spawn(filePath, ['/S', '--force-run'], {
            detached: true,
            stdio: 'ignore'
        });
        subprocess.unref();
        
        // Quitte l'application pour libérer les fichiers et éviter l'erreur "Files in Use"
        app.quit();
    });
};
