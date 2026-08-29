import { describe, it, expect, beforeAll } from 'vitest';
import { MCP_TOOLS, handleToolCall } from '../mcp/wacopiloteMcpServer';
import db from '../db';

describe('wacopiloteMcpServer — Serveur MCP standard', { timeout: 30000 }, () => {
    beforeAll(async () => {
        await db.initDB();
    }, 30000);

    it('expose la liste des outils MCP avec leurs schémas de validation', () => {
        expect(Array.isArray(MCP_TOOLS)).toBe(true);
        expect(MCP_TOOLS.length).toBeGreaterThanOrEqual(4);

        const toolNames = MCP_TOOLS.map(t => t.name);
        expect(toolNames).toContain('list_agents');
        expect(toolNames).toContain('call_agent');
        expect(toolNames).toContain('get_orders');
        expect(toolNames).toContain('create_product_proposal');

        // Extension v1.45.0 : prospection/pipeline, documents, photo, WordPress
        // (gouvernance HITL), devis, instances WhatsApp.
        for (const name of [
            'prospect_leads', 'run_pipeline', 'list_pipeline_cards',
            'list_documents', 'create_document', 'generate_photo',
            'wordpress_propose_action', 'wordpress_approve_action',
            'list_quotes', 'export_quote_pdf',
            'list_instances', 'open_whatsapp_chat'
        ]) {
            expect(toolNames).toContain(name);
        }
    });

    it('handleToolCall("list_agents") renvoie les 27 personas', async () => {
        const result = await handleToolCall('list_agents', {});
        expect(result).toBeDefined();
        expect(result.count).toBeGreaterThanOrEqual(25);
        expect(Array.isArray(result.personas)).toBe(true);

        const copywriter = result.personas.find(p => p.id === 'copywriter');
        expect(copywriter).toBeDefined();
        expect(copywriter.name).toContain('Jarvis');
    });

    it('handleToolCall("create_product_proposal") enregistre une action HITL dans SQLite', async () => {
        const fakeResult = {
            title: 'Robe Wax Abidjan',
            price: '25000 FCFA',
            description: 'Magnifique création artisanale',
            category: 'Mode'
        };

        const response = await handleToolCall('create_product_proposal', fakeResult);
        expect(response.success).toBe(true);
        expect(response.message).toContain('validation humaine (HITL)');
        expect(response.actionId).toBeDefined();
    });

    it('handleToolCall("list_documents"/"list_pipeline_cards"/"list_quotes"/"list_instances") renvoient des tableaux', async () => {
        for (const name of ['list_documents', 'list_pipeline_cards', 'list_quotes', 'list_instances']) {
            const result = await handleToolCall(name, {});
            const key = Object.keys(result).find(k => Array.isArray(result[k]));
            expect(key, `${name} devrait renvoyer un tableau`).toBeDefined();
        }
        // Timeout explicite (> défaut 5000ms) : 4 accès DB séquentiels sur la
        // base réelle, sensibles à la contention sous le pool forks à process
        // unique (singleFork: true) quand d'autres suites tournent en parallèle.
    }, 15000);

    it('handleToolCall("save_pipeline_contacts") prend en charge segmentName et listName', async () => {
        const pipelineService = require('../services/pipelineService');
        const run = await pipelineService.createRun({ brief: 'brief mcp' });
        const result = await handleToolCall('save_pipeline_contacts', {
            runId: run.id,
            leads: [{ name: 'Lead MCP', phone: '0506070809', address: 'Plateau' }],
            segmentName: 'Segments MCP',
            listName: 'Listes MCP'
        });
        expect(result.contacts).toHaveLength(1);
        expect(result.contacts[0].name).toBe('Lead MCP');
        expect(result.contacts[0].segment_id).toBeDefined();
        expect(result.contacts[0].list_id).toBeDefined();
    });

    it('handleToolCall CRUD CRM : create_segment, create_contact, list_contacts, assign_contacts_to_segment', async () => {
        const segRes = await handleToolCall('create_segment', { name: 'Segment MCP Atomique' });
        expect(segRes.success).toBe(true);
        expect(segRes.segment.id).toBeDefined();

        const contactRes = await handleToolCall('create_contact', {
            name: 'Contact MCP Atomique',
            phone: '0711223344',
            address: 'Abidjan Treichville',
            segmentId: segRes.segment.id
        });
        expect(contactRes.success).toBe(true);
        expect(contactRes.contact.segment_id).toBe(segRes.segment.id);

        const listRes = await handleToolCall('list_contacts', { segmentId: segRes.segment.id });
        expect(listRes.contacts.length).toBeGreaterThanOrEqual(1);

        const assignRes = await handleToolCall('assign_contacts_to_segment', {
            contactIds: [contactRes.contact.id],
            segmentId: null
        });
        expect(assignRes.success).toBe(true);

        const getRes = await handleToolCall('get_contact', { id: contactRes.contact.id });
        expect(getRes.contact.segment_id).toBeNull();
    });

    it('handleToolCall("wordpress_propose_action") exige connectionId et prompt', async () => {
        await expect(handleToolCall('wordpress_propose_action', {})).rejects.toThrow(/obligatoires/);
    });

    it('handleToolCall("unknown_tool") lève une erreur explicite', async () => {
        await expect(handleToolCall('fake_tool_xyz', {})).rejects.toThrow("Outil inconnu : 'fake_tool_xyz'");
    });
});
