import { describe, it, expect } from 'vitest';
import {
    sanitizeCommandName,
    isCommandAllowed,
    getAllowedCommands,
    executeExternalCli,
    detectInstalledClis,
    DEFAULT_ALLOWED_COMMANDS
} from '../services/externalAgentRunner';

describe('externalAgentRunner — service d\'exécution CLI externe', { timeout: 15000 }, () => {
    describe('sanitizeCommandName', () => {
        it('assainit correctement un nom simple', () => {
            expect(sanitizeCommandName('gemini')).toBe('gemini');
            expect(sanitizeCommandName('  CLAUDE  ')).toBe('claude');
        });

        it('retire les extensions de fichiers (.exe, .cmd, .bat, .sh)', () => {
            expect(sanitizeCommandName('gemini.exe')).toBe('gemini');
            expect(sanitizeCommandName('ollama.CMD')).toBe('ollama');
            expect(sanitizeCommandName('script.sh')).toBe('script');
        });

        it('extrait le nom de base en cas de chemin fourni', () => {
            expect(sanitizeCommandName('C:\\Program Files\\nodejs\\node.exe')).toBe('node');
            expect(sanitizeCommandName('/usr/local/bin/python3')).toBe('python3');
        });

        it('lève une erreur en cas d\'argument invalide ou vide', () => {
            expect(() => sanitizeCommandName('')).toThrow('Nom de commande CLI invalide.');
            expect(() => sanitizeCommandName(null)).toThrow('Nom de commande CLI invalide.');
        });
    });

    describe('isCommandAllowed & liste blanche de sécurité', () => {
        it('autorise les commandes par défaut standard', async () => {
            for (const cmd of DEFAULT_ALLOWED_COMMANDS) {
                expect(await isCommandAllowed(cmd)).toBe(true);
            }
        });

        it('renvoie un ensemble contenant les commandes par défaut', async () => {
            const allowedSet = await getAllowedCommands();
            expect(allowedSet).toBeInstanceOf(Set);
            expect(allowedSet.has('node')).toBe(true);
            expect(allowedSet.has('gemini')).toBe(true);
            expect(allowedSet.has('gcloud')).toBe(true);
            expect(allowedSet.has('google-genai')).toBe(true);
        });

        it('bloque les binaires système dangereux ou non autorisés', async () => {
            expect(await isCommandAllowed('rm')).toBe(false);
            expect(await isCommandAllowed('format')).toBe(false);
            expect(await isCommandAllowed('shutdown')).toBe(false);
            expect(await isCommandAllowed('powershell.exe')).toBe(false);
        });
    });

    describe('executeExternalCli', () => {
        it('bloque l\'exécution d\'une commande non autorisée', async () => {
            const result = await executeExternalCli({
                command: 'rmdir',
                args: ['/s']
            });
            expect(result.success).toBe(false);
            expect(result.error).toContain('n\'est pas autorisée par la politique de sécurité');
        });

        it('exécute avec succès une commande Node autorisée et capture stdout', async () => {
            const result = await executeExternalCli({
                command: 'node',
                args: ['-e', 'console.log("HELLO_WACOPILOTE_CLI")'],
                timeout: 5000
            });
            expect(result.success).toBe(true);
            expect(result.exitCode).toBe(0);
            expect(result.stdout).toContain('HELLO_WACOPILOTE_CLI');
        });

        it('injecte correctement le flux stdin dans le sous-processus', async () => {
            const script = `
                let str = '';
                process.stdin.on('data', c => str += c);
                process.stdin.on('end', () => console.log('STDIN_RECV:' + str.trim()));
            `;
            const result = await executeExternalCli({
                command: 'node',
                args: ['-e', script],
                input: 'DATA_FROM_WACOPILOTE',
                timeout: 5000
            });
            expect(result.success).toBe(true);
            expect(result.stdout).toContain('STDIN_RECV:DATA_FROM_WACOPILOTE');
        });

        it('ne laisse pas les métacaractères shell d\'un argument npx s\'exécuter (anti-injection)', async () => {
            const result = await executeExternalCli({
                command: 'npx',
                args: ['--version', '&&', 'echo', 'SHOULD_NOT_BE_EXECUTED'],
                timeout: 20000
            });
            expect(result.stdout).not.toContain('SHOULD_NOT_BE_EXECUTED');
        }, 25000);

        it('interrompt proprement un processus en cas de dépassement de timeout', async () => {
            const infiniteScript = `
                setTimeout(() => {}, 100000);
            `;
            const result = await executeExternalCli({
                command: 'node',
                args: ['-e', infiniteScript],
                timeout: 300 // 300ms
            });
            expect(result.success).toBe(false);
            expect(result.error).toContain('Délai d\'exécution dépassé');
        });
    });

    describe('detectInstalledClis', () => {
        it('renvoie une liste contenant au moins node comme installé', async () => {
            const detected = await detectInstalledClis();
            expect(Array.isArray(detected)).toBe(true);
            const nodeEntry = detected.find(d => d.command === 'node');
            expect(nodeEntry).toBeDefined();
            expect(nodeEntry.installed).toBe(true);
            expect(nodeEntry.version).toBeTruthy();
        }, 30000);
    });
});
