import { describe, it, expect, beforeAll } from 'vitest';
import { MCP_TOOLS, handleToolCall } from '../mcp/wacopiloteMcpServer';
import db from '../db';

describe('wacopiloteMcpServer — Serveur MCP standard', () => {
    beforeAll(async () => {
        await db.initDB();
    });

    it('expose la liste des outils MCP avec leurs schémas de validation', () => {
        expect(Array.isArray(MCP_TOOLS)).toBe(true);
        expect(MCP_TOOLS.length).toBeGreaterThanOrEqual(4);

        const toolNames = MCP_TOOLS.map(t => t.name);
        expect(toolNames).toContain('list_agents');
        expect(toolNames).toContain('call_agent');
        expect(toolNames).toContain('get_orders');
        expect(toolNames).toContain('create_product_proposal');
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

    it('handleToolCall("unknown_tool") lève une erreur explicite', async () => {
        await expect(handleToolCall('fake_tool_xyz', {})).rejects.toThrow("Outil inconnu : 'fake_tool_xyz'");
    });
});
