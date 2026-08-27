import { describe, it, expect } from 'vitest';
import { spawn } from 'child_process';
import path from 'path';

const binPath = path.resolve(__dirname, '../../bin/wacopilote.cjs');

function runCli(args = [], input = '') {
    return new Promise((resolve) => {
        let stdout = '';
        let stderr = '';

        // process.execPath garantit l'accès direct à l'exécutable node.exe
        // sans interpolation shell, préservant les espaces des chemins sous Windows.
        const proc = spawn(process.execPath, [binPath, ...args], {
            shell: false,
            stdio: ['pipe', 'pipe', 'pipe']
        });

        if (proc.stdin) {
            if (input) {
                proc.stdin.write(input);
            }
            proc.stdin.end();
        }

        proc.stdout.on('data', d => stdout += d.toString());
        proc.stderr.on('data', d => stderr += d.toString());

        proc.on('close', code => {
            resolve({ code, stdout: stdout.trim(), stderr: stderr.trim() });
        });
    });
}

describe('bin/wacopilote.js — Point d\'entrée CLI Inbound', { timeout: 15000 }, () => {
    it('--version affiche la version de WaCopilote', async () => {
        const { code, stdout } = await runCli(['--version']);
        expect(code).toBe(0);
        expect(stdout).toMatch(/WaCopilote v\d+\.\d+\.\d+/);
    });

    it('help affiche le manuel d\'utilisation complet', async () => {
        const { code, stdout } = await runCli(['help']);
        expect(code).toBe(0);
        expect(stdout).toContain('USAGE :');
        expect(stdout).toContain('COMMANDES DISPONIBLES :');
        expect(stdout).toContain('list-agents');
        expect(stdout).toContain('run');
        expect(stdout).toContain('mcp');
    });

    it('list-agents --json renvoie la liste complète des 27 personas', async () => {
        const { code, stdout } = await runCli(['list-agents', '--json']);
        expect(code).toBe(0);
        const jsonStart = stdout.indexOf('{');
        const parsed = JSON.parse(stdout.slice(jsonStart));
        expect(parsed.success).toBe(true);
        expect(parsed.count).toBeGreaterThanOrEqual(25);
        expect(Array.isArray(parsed.personas)).toBe(true);

        const ids = parsed.personas.map(p => p.id);
        expect(ids).toContain('copywriter');
        expect(ids).toContain('creative');
        expect(ids).toContain('outbound_strategist');
    });

    it('status --json renvoie l\'état de la base de données et des clés', async () => {
        const { code, stdout } = await runCli(['status', '--json']);
        expect(code).toBe(0);
        const jsonStart = stdout.indexOf('{');
        const parsed = JSON.parse(stdout.slice(jsonStart));
        expect(parsed.success).toBe(true);
        expect(parsed.database).toContain('SQLite');
        expect(parsed.personasCount).toBeGreaterThanOrEqual(25);
    });

    it('rejette une commande inconnue avec code de sortie 1', async () => {
        const { code, stderr } = await runCli(['unknown_subcommand_xyz']);
        expect(code).toBe(1);
        expect(stderr).toContain("Commande inconnue : 'unknown_subcommand_xyz'");
    });

    it('rejette run sans prompt avec code de sortie 1', async () => {
        const { code, stderr } = await runCli(['run', '--agent', 'copywriter']);
        expect(code).toBe(1);
        expect(stderr).toContain('Aucun prompt fourni');
    });
});
