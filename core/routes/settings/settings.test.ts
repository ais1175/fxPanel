import { suite, it, expect, vi } from 'vitest';
import GetBanTemplates from './getBanTemplates';
import SaveBanTemplates from './saveBanTemplates';
import { createMockCtx } from '../../testing/routeTestUtils';

vi.stubGlobal('txConfig', {
    banlist: {
        templates: [
            { id: '1', reason: 'Cheating', duration: { value: 30, unit: 'days' } },
            { id: '2', reason: 'Toxicity', duration: { value: 7, unit: 'days' } },
        ],
    },
});

vi.stubGlobal('txCore', {
    configStore: {
        saveConfigs: vi.fn(),
    },
    webServer: {
        webSocket: { pushEvent: vi.fn() },
    },
});

suite('settings/getBanTemplates', () => {
    it('should return the ban templates from txConfig', async () => {
        const { ctx, sentData } = createMockCtx();

        await GetBanTemplates(ctx);

        expect(ctx.send).toHaveBeenCalledOnce();
        expect(sentData[0]).toHaveLength(2);
        expect(sentData[0][0].reason).toBe('Cheating');
    });
});

suite('settings/saveBanTemplates', () => {
    it('should reject without settings.write permission', async () => {
        const { ctx, sentData } = createMockCtx({
            permissions: ['settings.view'],
            body: [],
        });

        await SaveBanTemplates(ctx);

        expect(sentData[0]).toMatchObject({ error: expect.stringContaining('permission') });
    });

    it('should save valid templates and push websocket event', async () => {
        const newTemplates = [{ id: '3', reason: 'RDM', duration: { value: 1, unit: 'days' } }];
        const { ctx, sentData } = createMockCtx({
            permissions: ['settings.write'],
            body: newTemplates,
        });

        await SaveBanTemplates(ctx);

        expect(txCore.configStore.saveConfigs).toHaveBeenCalledWith(
            { banlist: { templates: newTemplates } },
            'testadmin',
        );
        expect(sentData[0]).toMatchObject({ success: true });
        expect(txCore.webServer.webSocket.pushEvent).toHaveBeenCalledWith('banTemplatesUpdate', newTemplates);
    });
});
