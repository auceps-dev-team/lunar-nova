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

describe('bin/wacopilote.js — Point d\'entrée CLI Inbound', { timeout: 30000 }, () => {
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
        // Extension v1.45.0
        expect(stdout).toContain('pipeline');
        expect(stdout).toContain('documents');
        expect(stdout).toContain('photo');
        expect(stdout).toContain('wordpress');
        expect(stdout).toContain('quotes');
        expect(stdout).toContain('instances');
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

    it('documents create puis list --json font un aller-retour', async () => {
        const created = await runCli(['documents', 'create', '--title', 'Test CLI', '--content', 'Contenu de test', '--json']);
        expect(created.code).toBe(0);
        const createdParsed = JSON.parse(created.stdout.slice(created.stdout.indexOf('{')));
        expect(createdParsed.success).toBe(true);
        expect(createdParsed.document.title).toBe('Test CLI');

        const listed = await runCli(['documents', 'list', '--json']);
        expect(listed.code).toBe(0);
        const listedParsed = JSON.parse(listed.stdout.slice(listed.stdout.indexOf('{')));
        expect(listedParsed.documents.some(d => d.id === createdParsed.document.id)).toBe(true);

        const deleted = await runCli(['documents', 'delete', String(createdParsed.document.id), '--json']);
        expect(deleted.code).toBe(0);
    });

    it('quotes create calcule le total TTC à partir des lignes', async () => {
        const created = await runCli(['quotes', 'create', '--client-name', 'Client CLI Test',
            '--data', '{"items":[{"description":"Article","qty":2,"price":1000}],"taxRate":0}', '--json']);
        expect(created.code).toBe(0);
        const parsed = JSON.parse(created.stdout.slice(created.stdout.indexOf('{')));
        expect(parsed.quote.totalAmount).toBe(2000);

        await runCli(['quotes', 'delete', String(parsed.quote.id), '--json']);
    }, 20000);

    it('instances list --json renvoie un tableau (même vide)', async () => {
        const { code, stdout } = await runCli(['instances', 'list', '--json']);
        expect(code).toBe(0);
        const parsed = JSON.parse(stdout.slice(stdout.indexOf('{')));
        expect(Array.isArray(parsed.instances)).toBe(true);
    });

    it('pipeline cards --json renvoie un tableau (même vide)', async () => {
        const { code, stdout } = await runCli(['pipeline', 'cards', '--json']);
        expect(code).toBe(0);
        const parsed = JSON.parse(stdout.slice(stdout.indexOf('{')));
        expect(Array.isArray(parsed.cards)).toBe(true);
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
