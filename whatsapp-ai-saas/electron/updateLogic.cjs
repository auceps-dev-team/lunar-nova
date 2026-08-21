/**
 * Logique pure de mise à jour — extraite de electron/updater.cjs pour être
 * testable unitairement (sans dépendance à Electron).
 */

/**
 * Compare deux versions sémantiques « x.y.z ». Retire un préfixe 'v' éventuel
 * et n'extrait que la partie numérique pure (les suffixes de pré-release
 * « 1.42.11-beta.1 » sont ignorés → comparés comme « 1.42.11 »).
 * @returns {number} 1 si v1 > v2, -1 si v1 < v2, 0 si égales.
 */
function compareVersions(v1, v2) {
    const extract = (v) => {
        const cleaned = String(v).replace(/^v/i, '').match(/\d+(?:\.\d+)*/);
        return (cleaned ? cleaned[0] : '0').split('.').map(n => parseInt(n, 10) || 0);
    };
    const p1 = extract(v1);
    const p2 = extract(v2);
    for (let i = 0; i < Math.max(p1.length, p2.length); i++) {
        const n1 = p1[i] || 0;
        const n2 = p2[i] || 0;
        if (n1 > n2) return 1;
        if (n1 < n2) return -1;
    }
    return 0;
}

/**
 * Normalise le tag d'une release GitHub (« v1.2.3 » → « 1.2.3 »).
 * Ne retire que le préfixe 'v' — l'ancien replace('v','') retirait tous les 'v'.
 */
function parseReleaseTag(tag) {
    return String(tag || '').replace(/^v/i, '');
}

/**
 * Sélectionne l'asset de mise à jour correspondant à la plateforme courante.
 * Le canal Windows (installeur NSIS .exe) reste le seul avec installation
 * silencieuse ; macOS et Linux reçoivent l'artefact adapté (.dmg/.zip et
 * .AppImage/.deb) et l'ouvrent pour installation manuelle guidée.
 */
function pickAssetForPlatform(assets, platform = process.platform) {
    const patterns = {
        win32: ['.exe'],
        darwin: ['.dmg', '.zip'],
        linux: ['.AppImage', '.appimage', '.deb'],
    };
    const wanted = patterns[platform] || [];
    for (const ext of wanted) {
        const found = (assets || []).find(a => a.name && a.name.toLowerCase().endsWith(ext.toLowerCase()));
        if (found) return { asset: found, platform };
    }
    return { asset: null, platform };
}

module.exports = { compareVersions, parseReleaseTag, pickAssetForPlatform };
