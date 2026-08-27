const { app, ipcMain, shell } = require('electron');
const axios = require('axios');
const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');
const { compareVersions, parseReleaseTag, pickAssetForPlatform } = require('./updateLogic.cjs');

const REPO_URL = 'https://api.github.com/repos/auceps-dev-team/wacopilote-releases/releases/latest';

// Timeouts réseau : l'API GitHub peut être lente ou saturée ; un handler IPC
// ne doit jamais rester bloqué indéfiniment. Le téléchargement (fichier de
// ~160 Mo) reçoit une marge plus généreuse.
const CHECK_TIMEOUT_MS = 10000;
const DOWNLOAD_TIMEOUT_MS = 5 * 60 * 1000;

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
            // User-Agent explicite : l'API GitHub le requiert (il était envoyé
            // par défaut par axios, mais le rendre explicite évite les refus
            // et aide au diagnostic côté GitHub).
            const res = await axios.get(REPO_URL, {
                timeout: CHECK_TIMEOUT_MS,
                headers: {
                    'User-Agent': `WaCopilote/${app.getVersion()}`,
                    Accept: 'application/vnd.github+json',
                },
            });

            const latestVersion = parseReleaseTag(res.data.tag_name);
            const currentVersion = app.getVersion();
            const cmp = compareVersions(latestVersion, currentVersion);

            if (cmp > 0) {
                // Asset adapté à la plateforme (exe sur Windows, dmg/zip sur
                // macOS, AppImage/deb sur Linux). Aucun asset pour cette
                // plateforme → mise à jour signalée sans URL (hasUpdate reste
                // vrai pour afficher la note de version, mais le bouton de
                // téléchargement ne sera pas proposé).
                const { asset, platform } = pickAssetForPlatform(res.data.assets);
                return {
                    hasUpdate: true,
                    version: latestVersion,
                    currentVersion,
                    notes: res.data.body,
                    platform,
                    assetName: asset ? asset.name : null,
                    downloadUrl: asset ? asset.browser_download_url : null,
                };
            }

            const result = { hasUpdate: false, latestVersion, currentVersion };

            // Cas « release derrière la version installée » : la comparaison
            // ne peut jamais signaler de mise à jour. Ce n'est pas une erreur
            // réseau, c'est un état de configuration des releases — on le
            // remonte pour que l'interface puisse l'expliquer clairement au
            // lieu d'afficher un « à jour » trompeur.
            if (cmp < 0) {
                result.info = 'release_behind_current';
            }
            return result;
        } catch (e) {
            console.error('[Updater] Erreur check update:', e.message);
            const isRateLimit = e.response && e.response.status === 403;
            const isNotFound = e.response && e.response.status === 404;
            return {
                hasUpdate: false,
                error: e.message,
                errorCode: isRateLimit ? 'RATE_LIMIT' : isNotFound ? 'REPO_NOT_FOUND' : 'NETWORK',
            };
        }
    });

    // 2. TÉLÉCHARGEMENT FLUIDE
    ipcMain.handle('update:start-download', async (event, url) => {
        try {
            const parsedUrl = new URL(url);
            if (parsedUrl.protocol !== 'https:' || !(parsedUrl.hostname === 'github.com' || parsedUrl.hostname.endsWith('.githubusercontent.com'))) {
                return { success: false, error: 'Origine de mise à jour non autorisée (doit être https://github.com/...).' };
            }
        } catch (e) {
            return { success: false, error: `URL de mise à jour invalide : ${e.message}` };
        }

        // L'extension du fichier temporaire suit l'asset réel (pas toujours
        // .exe depuis que macOS/Linux sont couverts) — elle est déduite de
        // l'URL de téléchargement.
        let ext = '.exe';
        try { ext = path.extname(new URL(url).pathname) || '.exe'; } catch { /* URL invalide */ }
        const tempPath = path.join(app.getPath('temp'), `WaCopilote-Update-${Date.now()}${ext}`);

        try {
            const response = await axios({
                method: 'GET',
                url: url,
                responseType: 'stream',
                timeout: DOWNLOAD_TIMEOUT_MS,
                // Les assets GitHub redirigent vers le CDN (objects.githubusercontent) ;
                // axios suit les redirections par défaut. User-Agent explicite.
                headers: { 'User-Agent': `WaCopilote/${app.getVersion()}` },
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
                writer.on('finish', () => {
                    // Vérification d'intégrité : un téléchargement interrompu
                    // (connexion coupée sans erreur) produirait un installeur
                    // tronqué que NSIS exécuterait sans prévenir.
                    if (totalLength && downloaded !== totalLength) {
                        return reject(new Error(`Téléchargement incomplet (${downloaded}/${totalLength} octets).`));
                    }
                    resolve({ success: true, filePath: tempPath });
                });
                writer.on('error', reject);
                response.data.on('error', reject);
            });

        } catch (error) {
            // Nettoyage du fichier partiel en cas d'échec
            try { if (fs.existsSync(tempPath)) fs.unlinkSync(tempPath); } catch { /* ignore */ }
            return { success: false, error: error.message };
        }
    });

    // 3. INSTALLATION / OUVERTURE DE L'ARTEFACT
    ipcMain.handle('update:install', async (event, filePath) => {
        // Confinement du chemin : doit résider dans le répertoire temporaire de l'application
        const tempDir = path.resolve(app.getPath('temp'));
        const resolvedPath = path.resolve(filePath);
        if (!resolvedPath.startsWith(tempDir)) {
            return { success: false, error: 'Chemin de fichier d\'installation non sécurisé.' };
        }

        // Windows : installeur NSIS lancé en processus détaché, puis
        // fermeture de l'application pour libérer les fichiers en cours
        // d'utilisation (« Files in Use »).
        if (process.platform === 'win32') {
            const subprocess = spawn(filePath, ['/S', '--force-run'], {
                detached: true,
                stdio: 'ignore'
            });
            subprocess.unref();
            app.quit();
            return { success: true };
        }

        // macOS / Linux : pas d'installation silencieuse fiable — on ouvre
        // l'artefact téléchargé (.dmg → Finder, .AppImage → exécutable, .deb
        // → installateur système) et on laisse l'utilisateur guider
        // l'installation. L'application ne se ferme pas.
        try {
            if (process.platform === 'linux' && filePath.toLowerCase().endsWith('.appimage')) {
                fs.chmodSync(filePath, 0o755);
            }
            const err = await shell.openPath(filePath);
            return err
                ? { success: false, error: err }
                : { success: true, note: 'open' };
        } catch (e) {
            return { success: false, error: e.message };
        }
    });
};
