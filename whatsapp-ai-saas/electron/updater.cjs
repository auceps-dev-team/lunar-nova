const { app, ipcMain, shell } = require('electron');
const axios = require('axios');
const path = require('path');
const { spawn } = require('child_process');
const { compareVersions, parseReleaseTag, pickAssetForPlatform, parseSha256Digest, downloadVerified } = require('./updateLogic.cjs');

const REPO_URL = 'https://api.github.com/repos/auceps-dev-team/wacopilote-releases/releases/latest';

// Timeouts réseau : l'API GitHub peut être lente ou saturée ; un handler IPC
// ne doit jamais rester bloqué indéfiniment. Le téléchargement (fichier de
// ~150 Mo) reçoit une marge plus généreuse.
const CHECK_TIMEOUT_MS = 10000;
const DOWNLOAD_TIMEOUT_MS = 5 * 60 * 1000;

/**
 * Ce que la dernière vérification a proposé, et ce qui a été téléchargé.
 *
 * Le renderer renvoie l'URL à télécharger puis le chemin à installer. Jusqu'au
 * 26/11/2026, le processus principal acceptait toute URL en github.com et tout
 * fichier du dossier temporaire : un renderer compromis pouvait lui faire
 * télécharger puis EXÉCUTER n'importe quel .exe hébergé sur GitHub. Désormais
 * seul l'installeur proposé par la dernière vérification (dépôt des releases
 * WaCopilote) se télécharge, et seul le fichier téléchargé et vérifié ici
 * s'installe.
 */
let lastOffer = null;        // { url, size, sha256, version }
let lastDownloadPath = null; // chemin du dernier installeur vérifié

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
                // Asset adapté à la plateforme (installeur NSIS sur Windows,
                // dmg/zip sur macOS, AppImage/deb sur Linux). Aucun asset pour
                // cette plateforme → mise à jour signalée sans URL (hasUpdate
                // reste vrai pour afficher la note de version, mais le bouton
                // de téléchargement ne sera pas proposé).
                const { asset, platform } = pickAssetForPlatform(res.data.assets);
                lastOffer = asset ? {
                    url: asset.browser_download_url,
                    size: Number(asset.size) || null,
                    sha256: parseSha256Digest(asset.digest),
                    version: latestVersion,
                } : null;
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

            lastOffer = null;
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

    // 2. TÉLÉCHARGEMENT VÉRIFIÉ
    ipcMain.handle('update:start-download', async (event, url) => {
        if (!lastOffer || url !== lastOffer.url) {
            return { success: false, error: "Ce téléchargement n'a pas été proposé par la dernière vérification des mises à jour. Relancez la vérification." };
        }

        // L'extension du fichier temporaire suit l'asset réel (pas toujours
        // .exe depuis que macOS/Linux sont couverts).
        let ext = '.exe';
        try { ext = path.extname(new URL(url).pathname) || '.exe'; } catch { /* URL invalide */ }
        const tempPath = path.join(app.getPath('temp'), `WaCopilote-Update-${Date.now()}${ext}`);
        lastDownloadPath = null;

        try {
            const response = await axios({
                method: 'GET',
                url,
                responseType: 'stream',
                timeout: DOWNLOAD_TIMEOUT_MS,
                // Les assets GitHub redirigent vers le CDN ; axios suit les
                // redirections par défaut. User-Agent explicite.
                headers: { 'User-Agent': `WaCopilote/${app.getVersion()}` },
            });

            if (!lastOffer.sha256) {
                console.warn('[Updater] Aucune empreinte SHA-256 publiée pour cet asset : seule la taille est vérifiée.');
            }

            await downloadVerified(response, {
                dest: tempPath,
                expectedSize: lastOffer.size,
                expectedSha256: lastOffer.sha256,
                onProgress: (percent) => {
                    const win = getMainWindow();
                    if (win && !win.isDestroyed()) win.webContents.send('update:progress', percent);
                },
            });

            lastDownloadPath = path.resolve(tempPath);
            return { success: true, filePath: tempPath };
        } catch (error) {
            // downloadVerified a déjà supprimé un fichier partiel ou douteux.
            return { success: false, error: error.message };
        }
    });

    // 3. INSTALLATION / OUVERTURE DE L'ARTEFACT
    ipcMain.handle('update:install', async (event, filePath) => {
        // Seul le fichier téléchargé et vérifié ci-dessus s'installe.
        if (!lastDownloadPath || path.resolve(String(filePath || '')) !== lastDownloadPath) {
            return { success: false, error: "Fichier d'installation inconnu : relancez le téléchargement." };
        }

        // Windows : installeur NSIS lancé en processus détaché, en mode
        // silencieux (/S), puis fermeture de l'application pour libérer les
        // fichiers en cours d'utilisation (« Files in Use »).
        if (process.platform === 'win32') {
            const subprocess = spawn(lastDownloadPath, ['/S', '--force-run'], {
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
            if (process.platform === 'linux' && lastDownloadPath.toLowerCase().endsWith('.appimage')) {
                require('fs').chmodSync(lastDownloadPath, 0o755);
            }
            const err = await shell.openPath(lastDownloadPath);
            return err
                ? { success: false, error: err }
                : { success: true, note: 'open' };
        } catch (e) {
            return { success: false, error: e.message };
        }
    });
};
