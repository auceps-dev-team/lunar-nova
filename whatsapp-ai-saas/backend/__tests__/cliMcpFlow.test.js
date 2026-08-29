// Suite utilitaire : flux CLI/MCP bout-en-bout.
//
// Distincte de cliInbound.test.js (spawn CLI isolé par commande) et de
// mcpServer.test.js (appelle handleToolCall() en process, sans passer par le
// protocole) : ici on ouvre une VRAIE session MCP sur stdio (subprocess
// `wacopilote mcp`, JSON-RPC réel) et on vérifie que CLI et MCP, lancés comme
// deux process indépendants, restent cohérents à travers la même base SQLite.
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { spawn } from 'child_process';
import path from 'path';
import readline from 'readline';

const binPath = path.resolve(__dirname, '../../bin/wacopilote.cjs');

function runCli(args = []) {
    return new Promise((resolve) => {
        let stdout = '';
        let stderr = '';
        const proc = spawn(process.execPath, [binPath, ...args], { shell: false, stdio: ['ignore', 'pipe', 'pipe'] });
        proc.stdout.on('data', d => stdout += d.toString());
        proc.stderr.on('data', d => stderr += d.toString());
        proc.on('close', code => resolve({ code, stdout: stdout.trim(), stderr: stderr.trim() }));
    });
}

function parseCliJson(stdout) {
    return JSON.parse(stdout.slice(stdout.indexOf('{')));
}

/**
 * Ouvre une session MCP persistante (un seul subprocess pour toute la suite,
 * comme le ferait un vrai client MCP) et expose un `call(method, params)`
 * qui résout la réponse JSON-RPC correspondante par id.
 */
function startMcpSession() {
    const proc = spawn(process.execPath, [binPath, 'mcp'], { shell: false, stdio: ['pipe', 'pipe', 'pipe'] });
    const rl = readline.createInterface({ input: proc.stdout, terminal: false });
    const pending = new Map();
    const protocolViolations = [];
    let nextId = 1;

    rl.on('line', (line) => {
        const trimmed = line.trim();
        if (!trimmed) return;
        let msg;
        try {
            msg = JSON.parse(trimmed);
        } catch {
            // Toute ligne non-JSON sur stdout est une violation du protocole
            // JSON-RPC (voir le correctif stdout->stderr de v1.45.0).
            protocolViolations.push(trimmed);
            return;
        }
        if (msg.id != null && pending.has(msg.id)) {
            pending.get(msg.id).resolve(msg);
            pending.delete(msg.id);
        }
    });

    return {
        protocolViolations,
        call(method, params = {}) {
            const id = nextId++;
            return new Promise((resolve, reject) => {
                const timer = setTimeout(() => {
                    pending.delete(id);
                    reject(new Error(`Timeout MCP sur ${method} (id=${id})`));
                }, 15000);
                pending.set(id, {
                    resolve: (msg) => { clearTimeout(timer); resolve(msg); }
                });
                proc.stdin.write(JSON.stringify({ jsonrpc: '2.0', id, method, params }) + '\n');
            });
        },
        async callTool(name, args = {}) {
            const response = await this.call('tools/call', { name, arguments: args });
            if (response.error) {
                const err = new Error(response.error.message);
                err.rpcError = response.error;
                throw err;
            }
            const text = response.result.content[0].text;
            try {
                return JSON.parse(text);
            } catch {
                return text;
            }
        },
        stop() {
            rl.close();
            proc.kill();
        }
    };
}

describe('Flux CLI/MCP bout-en-bout (subprocess réels)', { timeout: 20000 }, () => {
    let session;

    beforeAll(async () => {
        session = startMcpSession();
        await session.call('initialize', {});
    });

    afterAll(() => {
        session.stop();
    });

    it('le protocole JSON-RPC reste pur sur toute la session (aucune ligne non-JSON sur stdout)', async () => {
        await session.call('tools/list', {});
        await session.callTool('list_documents', {});
        await session.callTool('list_pipeline_cards', {});
        await session.callTool('list_instances', {});
        expect(session.protocolViolations).toEqual([]);
    });

    it('tools/list expose au moins 30 outils couvrant tous les domaines v1.45.0', async () => {
        const response = await session.call('tools/list', {});
        const names = response.result.tools.map(t => t.name);
        expect(names.length).toBeGreaterThanOrEqual(30);
        for (const domain of ['prospect_leads', 'run_pipeline', 'create_document', 'generate_photo',
            'wordpress_propose_action', 'create_quote', 'list_instances']) {
            expect(names).toContain(domain);
        }
    });

    it('un document créé via le CLI est immédiatement visible via le tool MCP get_document (même base)', async () => {
        const created = await runCli(['documents', 'create', '--title', 'Flux CLI->MCP', '--content', 'contenu de flux', '--json']);
        expect(created.code).toBe(0);
        const { document } = parseCliJson(created.stdout);

        const fetched = await session.callTool('get_document', { id: document.id });
        expect(fetched.document.content).toBe('contenu de flux');

        await session.callTool('delete_document', { id: document.id });
        const deletedCheck = await runCli(['documents', 'get', String(document.id), '--json']);
        expect(deletedCheck.code).toBe(1);
    });

    it('un devis créé via le tool MCP create_quote est immédiatement visible via le CLI quotes list', async () => {
        const created = await session.callTool('create_quote', {
            clientName: 'Flux MCP->CLI',
            items: [{ description: 'Service', qty: 1, price: 5000 }],
            taxRate: 0
        });
        expect(created.quote.totalAmount).toBe(5000);

        const listed = await runCli(['quotes', 'list', '--json']);
        const { quotes } = parseCliJson(listed.stdout);
        expect(quotes.some(q => q.id === created.quote.id)).toBe(true);

        await runCli(['quotes', 'delete', String(created.quote.id), '--json']);
    });

    it('un run de pipeline créé via le CLI est visible via list_pipeline_cards après organize côté MCP', async () => {
        const run = await runCli(['pipeline', 'create', '--brief', 'Flux pipeline CLI->MCP', '--json']);
        expect(run.code).toBe(0);
        const { run: createdRun } = parseCliJson(run.stdout);

        const organized = await session.callTool('organize_pipeline', {
            runId: createdRun.id,
            cards: [{ contact_id: null, draft_message: 'Bonjour depuis le flux MCP' }]
        });
        expect(organized.cards).toHaveLength(1);

        const cards = await session.callTool('list_pipeline_cards', { runId: createdRun.id });
        expect(cards.cards).toHaveLength(1);
        expect(cards.cards[0].draft_message).toBe('Bonjour depuis le flux MCP');
    });

    it('save_pipeline_contacts via MCP crée un segment et réaffecte les contacts', async () => {
        const run = await runCli(['pipeline', 'create', '--brief', 'Flux segment CLI->MCP', '--json']);
        const { run: createdRun } = parseCliJson(run.stdout);

        const saved = await session.callTool('save_pipeline_contacts', {
            runId: createdRun.id,
            leads: [{ name: 'Lead Flow P1', phone: '0700000099', address: 'Abidjan Plateau' }],
            segmentName: 'Segment Flow MCP'
        });
        expect(saved.contacts).toHaveLength(1);
        expect(saved.contacts[0].segment_id).toBeDefined();

        // Réaffectation doublon
        const savedAgain = await session.callTool('save_pipeline_contacts', {
            runId: createdRun.id,
            leads: [{ name: 'Lead Flow P1 Re-visite', phone: '0700000099', address: 'Abidjan Cocody' }],
            segmentName: 'Segment Flow MCP 2'
        });
        expect(savedAgain.reassignedCount).toBe(1);
        expect(savedAgain.contacts).toHaveLength(1);
        expect(savedAgain.contacts[0].address).toBe('Abidjan Cocody');
    });

    it('un contact créé via le CLI est visible via les tools MCP list_contacts et get_contact', async () => {
        const segRes = await session.callTool('create_segment', { name: 'Segment Flow Cross' });
        expect(segRes.segment.id).toBeDefined();

        const created = await runCli([
            'contacts', 'create',
            '--phone', '0700112233',
            '--name', 'Lead Cross Process',
            '--segment-id', String(segRes.segment.id),
            '--json'
        ]);
        expect(created.code).toBe(0);
        const { contact } = parseCliJson(created.stdout);

        const fetched = await session.callTool('get_contact', { id: contact.id });
        expect(fetched.contact.name).toBe('Lead Cross Process');
        expect(fetched.contact.segment_id).toBe(segRes.segment.id);

        const list = await session.callTool('list_contacts', { segmentId: segRes.segment.id });
        expect(list.contacts.some(c => c.id === contact.id)).toBe(true);

        await session.callTool('delete_contact', { id: contact.id });
    });

    it('wordpress_propose_action échoue proprement (sans planter la session) sur une connexion inconnue', async () => {
        await expect(
            session.callTool('wordpress_propose_action', { connectionId: 999999, prompt: 'test' })
        ).rejects.toThrow();

        // La session doit rester utilisable après une erreur d'outil.
        const stillAlive = await session.call('tools/list', {});
        expect(Array.isArray(stillAlive.result.tools)).toBe(true);
    });
});
