const { app, ipcMain } = require('electron');
const axios = require('axios');
const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');

const REPO_URL = 'https://api.github.com/repos/auceps-dev-team/lunar-nova/releases/latest';

module.exports = function setupUpdater(mainWindow) {
    // 1. VÉRIFICATION DE LA VERSION
    ipcMain.handle('update:check', async () => {
        try {
            const res = await axios.get(REPO_URL);
            const latestVersion = res.data.tag_name.replace('v', '');
            const currentVersion = app.getVersion();
            
            if (latestVersion !== currentVersion) {
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
                const percent = Math.round((downloaded / totalLength) * 100);
                
                // Throttling: on n'envoie au front que si le pourcentage change
                if (percent > lastPercent) {
                    lastPercent = percent;
                    if (mainWindow && !mainWindow.isDestroyed()) {
                        mainWindow.webContents.send('update:progress', percent);
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
