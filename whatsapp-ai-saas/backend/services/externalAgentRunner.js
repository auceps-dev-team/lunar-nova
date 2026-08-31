const { spawn } = require('child_process');
const crossSpawn = require('cross-spawn');
const path = require('path');
const db = require('../db');

/**
 * Liste blanche par défaut des commandes CLI agentiques et utilitaires autorisées.
 * Empêche l'exécution de binaires système dangereux (format, rm, etc.).
 */
const fs = require('fs');

/**
 * Liste blanche par défaut des commandes CLI agentiques et utilitaires autorisées.
 * Empêche l'exécution de binaires système dangereux (format, rm, etc.).
 */
const DEFAULT_ALLOWED_COMMANDS = [
    'gemini',
    'gemini-cli',
    'gcloud',
    'google-genai',
    'claude',
    'aider',
    'ollama',
    'node',
    'python',
    'python3',
    'git',
    'gh',
    'npx',
    'curl'
];

/**
 * Nettoie et valide un nom de commande CLI.
 * Rejette les chemins relatifs ou absolus suspects contenant des séparateurs système
 * pour éviter l'évasion de binaire.
 *
 * @param {string} command Nom de la commande (ex: 'gemini', 'claude')
 * @returns {string} Nom de commande assaini
 */
function sanitizeCommandName(command) {
    if (!command || typeof command !== 'string') {
        throw new Error('Nom de commande CLI invalide.');
    }
    const trimmed = command.trim();
    // Normaliser les séparateurs Windows (« \ ») en « / » AVANT l'extraction :
    // sous POSIX, path.basename ignore les anti-slashes et renverrait le chemin
    // complet (« c:\program files\nodejs\node »), ce qui faisait échouer la
    // liste blanche — et le test de portabilité — sur un chemin Windows.
    const baseName = path.basename(trimmed.replace(/\\/g, '/')).replace(/\.(exe|cmd|bat|sh)$/i, '');
    return baseName.toLowerCase();
}

/**
 * Récupère la liste complète des commandes autorisées (défaut + réglages en base).
 *
 * @returns {Promise<Set<string>>}
 */
async function getAllowedCommands() {
    const allowed = new Set(DEFAULT_ALLOWED_COMMANDS.map(c => c.toLowerCase()));
    try {
        const customSetting = await db.getSetting('allowed_cli_commands', '');
        if (customSetting) {
            const list = customSetting.split(',').map(s => s.trim().toLowerCase()).filter(Boolean);
            for (const item of list) {
                allowed.add(sanitizeCommandName(item));
            }
        }
    } catch {
        // En cas d'erreur DB, on conserve la liste par défaut sécurisée
    }
    return allowed;
}

/**
 * Vérifie si une commande est autorisée à être exécutée.
 *
 * @param {string} command 
 * @returns {Promise<boolean>}
 */
async function isCommandAllowed(command) {
    try {
        const cleanName = sanitizeCommandName(command);
        const allowed = await getAllowedCommands();
        return allowed.has(cleanName);
    } catch {
        return false;
    }
}

/**
 * Résout les chemins système standards pour Windows lorsque la variable PATH n'est pas héritée.
 *
 * @param {string} cmd
 * @returns {string|null} Chemin résolu ou null
 */
function resolveWindowsFallbackPath(cmd) {
    if (process.platform !== 'win32') return null;
    const userProfile = process.env.USERPROFILE || '';
    const appData = process.env.APPDATA || '';
    const localAppData = process.env.LOCALAPPDATA || '';
    const programFiles = process.env['ProgramFiles'] || 'C:\\Program Files';
    const programFilesX86 = process.env['ProgramFiles(x86)'] || 'C:\\Program Files (x86)';

    const candidates = [
        path.join(appData, 'npm', `${cmd}.cmd`),
        path.join(appData, 'npm', `${cmd}.ps1`),
        path.join(userProfile, '.local', 'bin', `${cmd}.exe`),
        path.join(localAppData, 'Google', 'Cloud SDK', 'google-cloud-sdk', 'bin', `${cmd}.cmd`),
        path.join(programFiles, 'Google', 'Cloud SDK', 'google-cloud-sdk', 'bin', `${cmd}.cmd`),
        path.join(programFilesX86, 'Google', 'Cloud SDK', 'google-cloud-sdk', 'bin', `${cmd}.cmd`),
        path.join(localAppData, 'Programs', cmd, `${cmd}.exe`),
        path.join(localAppData, 'Programs', 'Ollama', `${cmd}.exe`)
    ];

    for (const c of candidates) {
        if (c && fs.existsSync(c)) {
            return c;
        }
    }
    return null;
}

/**
 * Vérifie rapidement la présence d'un binaire dans le PATH système.
 * Évite le spawn de binaires inexistants et élimine les lenteurs lors des tests concurrents.
 *
 * @param {string} cmd
 * @returns {Promise<boolean>}
 */
function isBinaryInPath(cmd) {
    if (cmd === 'node') return Promise.resolve(true);
    return new Promise((resolve) => {
        const isWin = process.platform === 'win32';
        const checkCmd = isWin ? 'where' : 'which';
        // 'where'/'which' sont des exécutables natifs (pas des scripts .cmd/.bat) :
        // aucun shell n'est requis pour les lancer, même sous Windows.
        const p = spawn(checkCmd, [cmd], { stdio: 'ignore' });
        const timer = setTimeout(() => {
            try { p.kill(); } catch { /* Ignore */ }
            if (isWin && resolveWindowsFallbackPath(cmd)) {
                resolve(true);
            } else {
                resolve(false);
            }
        }, 2500);

        p.on('close', (code) => {
            clearTimeout(timer);
            if (code === 0) {
                resolve(true);
            } else if (isWin && resolveWindowsFallbackPath(cmd)) {
                resolve(true);
            } else {
                resolve(false);
            }
        });
        p.on('error', () => {
            clearTimeout(timer);
            if (isWin && resolveWindowsFallbackPath(cmd)) {
                resolve(true);
            } else {
                resolve(false);
            }
        });
    });
}

let cachedClis = null;
let lastClisCheckTime = 0;
const CLIS_CACHE_TTL = 30000; // 30 secondes de cache en mémoire

/**
 * Détecte les outils et CLI agentiques disponibles sur le système d'exploitation.
 * Teste la présence de chaque commande en tentant d'exécuter `--version`.
 *
 * @param {boolean} [forceRefresh=false]
 * @returns {Promise<Array<{ command: string, installed: boolean, version: string|null }>>}
 */
async function detectInstalledClis(forceRefresh = false) {
    const now = Date.now();
    if (!forceRefresh && cachedClis && (now - lastClisCheckTime < CLIS_CACHE_TTL)) {
        return cachedClis;
    }

    const commandsToCheck = [
        { name: 'gemini', flag: '--version' },
        { name: 'gemini-cli', flag: '--version' },
        { name: 'gcloud', flag: '--version' },
        { name: 'claude', flag: '--version' },
        { name: 'aider', flag: '--version' },
        { name: 'ollama', flag: '--version' },
        { name: 'python', flag: '--version' },
        { name: 'node', flag: '--version' },
        { name: 'git', flag: '--version' },
        { name: 'gh', flag: '--version' }
    ];

    const results = await Promise.all(commandsToCheck.map(async (item) => {
        try {
            const inPath = await isBinaryInPath(item.name);
            if (!inPath) {
                return {
                    command: item.name,
                    installed: false,
                    version: null
                };
            }

            const check = await executeExternalCli({
                command: item.name,
                args: [item.flag],
                timeout: 8000,
                skipAllowanceCheck: true
            });

            if (check.success) {
                const versionOutput = (check.stdout || check.stderr || '').trim().split('\n')[0];
                const entry = {
                    command: item.name,
                    installed: true,
                    version: versionOutput || 'Installé'
                };
                // C6 : pour la famille gemini, `--version` réussit sans aucune
                // authentification — le badge « installé » ne garantissait pas
                // que le canal répondrait en headless (verrous auth + trust du
                // diagnostic 2026-08-31). Pré-vol informationnel : n'influence
                // ni la cascade de repli ni les canaux signalés disponibles.
                if (item.name === 'gemini' || item.name === 'gemini-cli') {
                    entry.readiness = await probeGeminiReadiness({ forceRefresh });
                }
                return entry;
            }
            return {
                command: item.name,
                installed: false,
                version: null
            };
        } catch {
            return {
                command: item.name,
                installed: false,
                version: null
            };
        }
    }));

    cachedClis = results;
    lastClisCheckTime = now;
    return results;
}

// ── Pré-vol d'authentification Gemini CLI (C6) ──────────────────────────────
// `gemini --version` ne nécessite AUCUNE authentification : un binaire détecté
// ne prouvait pas que le canal répondrait en headless (`-p`), qui bute sur deux
// verrous indépendants — authentification absente (ni clé d'env ni OAuth en
// cache) et dossier de travail non déclaré de confiance (depuis le durcissement
// GHSA-wpqr-6v78-jr5g). Le pré-vol exécute exactement l'invocation du routeur
// (`-p ping -o text`, trust accordé par env) et classe le résultat pour les
// badges des Réglages. Strictement informationnel : la cascade de repli tente
// toujours le canal (une tentative est peu coûteuse et l'état peut changer).
const GEMINI_PROBE_TTL_MS = 5 * 60 * 1000; // cache propre : la détection est appelée à chaque ouverture de Réglages
let geminiProbeCache = null; // { ready, detail, checkedAt }

/**
 * Classe le résultat d'un pré-vol Gemini en état affichable. Pure — testée
 * unitairement sans aucun spawn.
 *
 * @param {{success?: boolean, exitCode?: number|null, stdout?: string, stderr?: string, error?: string}} result
 * @returns {{ready: boolean, detail: string|null}}
 */
function classifyGeminiProbeResult(result) {
    if (!result) return { ready: false, detail: 'Pré-vol non exécuté.' };
    if (result.success && (result.stdout || '').trim()) return { ready: true, detail: null };

    const raw = `${result.error || ''}\n${result.stderr || ''}`.trim();
    const lastLine = raw.split('\n').map((l) => l.trim()).filter(Boolean).pop()
        || `échec (code de sortie ${result.exitCode ?? '?'})`;
    const lower = raw.toLowerCase();

    // Classement par famille de cause (l'ordre compte : trust avant auth,
    // car le message d'auth peut apparaître dans l'aide au trust).
    if (lower.includes('trusted directory') || lower.includes('untrusted workspace')) {
        return { ready: false, detail: 'dossier de travail non déclaré de confiance' };
    }
    if (lower.includes('délai') || lower.includes('timeout')) {
        return { ready: false, detail: `délai dépassé au pré-vol (${lastLine.slice(0, 120)})` };
    }
    if (lower.includes('api key') || lower.includes('unauthenticated') || lower.includes('authentication') || lower.includes('quota')) {
        return { ready: false, detail: 'authentification absente ou refusée' };
    }
    return { ready: false, detail: lastLine.slice(0, 200) };
}

/**
 * Exécute le pré-vol Gemini (auth + trust) avec son propre cache de 5 min.
 *
 * @param {object} [options]
 * @param {boolean} [options.forceRefresh=false] Force un nouveau pré-vol (bouton « Réinspecter »)
 * @param {Function} [options.executor] Injecteur de test (défaut : executeExternalCli)
 * @param {Function} [options.getKey] Injecteur de test (défaut : db.getSetting('gemini_api_key'))
 * @returns {Promise<{ready: boolean, detail: string|null, checkedAt: number}>}
 */
async function probeGeminiReadiness({
    forceRefresh = false,
    executor = executeExternalCli,
    getKey = () => db.getSetting('gemini_api_key', '')
} = {}) {
    const now = Date.now();
    if (!forceRefresh && geminiProbeCache && now - geminiProbeCache.checkedAt < GEMINI_PROBE_TTL_MS) {
        return geminiProbeCache;
    }

    let key = '';
    try {
        key = (await getKey()) || '';
    } catch {
        key = '';
    }

    let result;
    try {
        // Même invocation que le routeur (agentFallbackRouter, canal gemini) :
        // le pré-vol doit voir ce que verrait un vrai appel — dont le trust
        // accordé par env (C3), sinon il échouerait pour la mauvaise raison.
        result = await executor({
            command: 'gemini',
            args: ['-p', 'ping', '-o', 'text'],
            input: '',
            env: {
                ...process.env,
                ...(key ? { GEMINI_API_KEY: key } : {}),
                GEMINI_CLI_TRUST_WORKSPACE: 'true'
            },
            timeout: 15000
        });
    } catch (err) {
        result = { success: false, exitCode: null, stdout: '', stderr: '', error: String(err?.message || err) };
    }

    geminiProbeCache = { ...classifyGeminiProbeResult(result), checkedAt: now };
    return geminiProbeCache;
}

/**
 * Exécute un outil ou agent CLI externe de manière sécurisée et isolée.
 *
 * @param {object} options
 * @param {string} options.command Nom du binaire CLI (ex: 'gemini', 'claude')
 * @param {string[]} [options.args=[]] Arguments passés au binaire
 * @param {string} [options.input=''] Flux d'entrée stdin à injecter
 * @param {string} [options.cwd] Répertoire de travail
 * @param {number} [options.timeout=60000] Délai d'expiration en millisecondes
 * @param {object} [options.env={}] Variables d'environnement additionnelles
 * @param {boolean} [options.skipAllowanceCheck=false] Usage interne pour diagnostic de version
 * @returns {Promise<{ success: boolean, exitCode: number|null, stdout: string, stderr: string, executionTimeMs: number, error?: string }>}
 */
async function executeExternalCli({
    command,
    args = [],
    input = '',
    cwd = process.cwd(),
    timeout = 60000,
    env = {},
    skipAllowanceCheck = false
}) {
    const startTime = Date.now();

    if (!skipAllowanceCheck) {
        const allowed = await isCommandAllowed(command);
        if (!allowed) {
            return {
                success: false,
                exitCode: null,
                stdout: '',
                stderr: '',
                executionTimeMs: Date.now() - startTime,
                error: `La commande CLI '${command}' n'est pas autorisée par la politique de sécurité WaCopilote.`
            };
        }
    }

    const cleanCmd = sanitizeCommandName(command);
    // Exécuter le nom assaini (résolu via le PATH), jamais le chemin brut saisi :
    // « C:\outils\gemini.exe » devait sinon franchir la liste blanche sous
    // Windows (basename = « gemini ») puis être exécuté depuis son chemin
    // d'origine — une évasion de binaire. Le nom simple, lui, est résolu par
    // le système parmi les binaires réellement installés.
    const executable = (cleanCmd === 'node') ? process.execPath : cleanCmd;

    return new Promise((resolve) => {
        let stdoutData = '';
        let stderrData = '';
        let isTimedOut = false;
        const maxBufferSize = 10 * 1024 * 1024; // 10 Mo max

        // Fusion d'environnement sans fuite de secrets non requis
        const executionEnv = {
            ...process.env,
            ...env
        };

        // cross-spawn résout nativement les .cmd/.bat (npx, npm...) sous Windows
        // sans jamais concaténer les arguments dans une chaîne interprétée par
        // cmd.exe : chaque argument reste une valeur littérale, ce qui élimine
        // le risque d'injection de métacaractères shell (&, |, &&, ...).
        const proc = crossSpawn(executable, args, {
            cwd,
            env: executionEnv,
            stdio: ['pipe', 'pipe', 'pipe']
        });

        const timer = setTimeout(() => {
            isTimedOut = true;
            try {
                proc.kill('SIGKILL');
            } catch {
                // Ignore kill errors
            }
        }, Math.max(100, timeout));

        if (input && proc.stdin) {
            try {
                proc.stdin.write(input);
                proc.stdin.end();
            } catch (e) {
                console.warn('[ExternalAgentRunner] Erreur écriture stdin:', e.message);
            }
        } else if (proc.stdin) {
            try {
                proc.stdin.end();
            } catch {}
        }

        proc.stdout.on('data', (chunk) => {
            if (stdoutData.length < maxBufferSize) {
                stdoutData += chunk.toString();
            }
        });

        proc.stderr.on('data', (chunk) => {
            if (stderrData.length < maxBufferSize) {
                stderrData += chunk.toString();
            }
        });

        proc.on('error', (err) => {
            clearTimeout(timer);
            resolve({
                success: false,
                exitCode: null,
                stdout: stdoutData,
                stderr: stderrData,
                executionTimeMs: Date.now() - startTime,
                error: isTimedOut
                    ? `Délai d'exécution dépassé (${timeout}ms).`
                    : `Échec de lancement de '${command}': ${err.message}`
            });
        });

        proc.on('close', (code) => {
            clearTimeout(timer);
            if (isTimedOut) {
                resolve({
                    success: false,
                    exitCode: code,
                    stdout: stdoutData,
                    stderr: stderrData,
                    executionTimeMs: Date.now() - startTime,
                    error: `Délai d'exécution dépassé (${timeout}ms). Le processus a été interrompu.`
                });
            } else {
                resolve({
                    success: code === 0,
                    exitCode: code,
                    stdout: stdoutData,
                    stderr: stderrData,
                    executionTimeMs: Date.now() - startTime
                });
            }
        });
    });
}

module.exports = {
    DEFAULT_ALLOWED_COMMANDS,
    sanitizeCommandName,
    getAllowedCommands,
    isCommandAllowed,
    detectInstalledClis,
    classifyGeminiProbeResult,
    probeGeminiReadiness,
    executeExternalCli
};
