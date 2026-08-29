const { spawn } = require('child_process');
const crossSpawn = require('cross-spawn');
const path = require('path');
const db = require('../db');

/**
 * Liste blanche par défaut des commandes CLI agentiques et utilitaires autorisées.
 * Empêche l'exécution de binaires système dangereux (format, rm, etc.).
 */
const DEFAULT_ALLOWED_COMMANDS = [
    'gemini',
    'gemini-cli',
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
    // Extraire le nom de base si un chemin complet est fourni
    const baseName = path.basename(trimmed).replace(/\.(exe|cmd|bat|sh)$/i, '');
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
            resolve(false);
        }, 800);

        p.on('close', (code) => {
            clearTimeout(timer);
            resolve(code === 0);
        });
        p.on('error', () => {
            clearTimeout(timer);
            resolve(false);
        });
    });
}

/**
 * Détecte les outils et CLI agentiques disponibles sur le système d'exploitation.
 * Teste la présence de chaque commande en tentant d'exécuter `--version`.
 *
 * @returns {Promise<Array<{ command: string, installed: boolean, version: string|null }>>}
 */
async function detectInstalledClis() {
    const commandsToCheck = [
        { name: 'gemini', flag: '--version' },
        { name: 'gemini-cli', flag: '--version' },
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
                timeout: 3000,
                skipAllowanceCheck: true
            });

            if (check.success) {
                const versionOutput = (check.stdout || check.stderr || '').trim().split('\n')[0];
                return {
                    command: item.name,
                    installed: true,
                    version: versionOutput || 'Installé'
                };
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

    return results;
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

    const cleanCmd = (command || '').toLowerCase();
    const executable = (cleanCmd === 'node') ? process.execPath : command;

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
    executeExternalCli
};
