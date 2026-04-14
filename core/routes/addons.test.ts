import { suite, it, expect, vi, beforeEach } from 'vitest';
import { createMockCtx } from '@core/testing/routeTestUtils';
import { addonsStop, addonsStart, addonsLogs } from './addons';

// Mock txCore
const mockStopAddon = vi.fn();
const mockStartAddon = vi.fn();
const mockGetAddonLogs = vi.fn();

vi.stubGlobal('txCore', {
    addonManager: {
        stopAddon: mockStopAddon,
        startAddon: mockStartAddon,
        getAddonLogs: mockGetAddonLogs,
    },
});

beforeEach(() => {
    vi.clearAllMocks();
});

suite('addonsStop', () => {
    it('rejects without all_permissions', async () => {
        const { ctx, sentData } = createMockCtx({
            params: { addonId: 'test-addon' },
            permissions: ['settings.view'],
        });
        await addonsStop(ctx);
        expect(sentData[0]).toEqual({ error: 'Insufficient permissions.' });
        expect(mockStopAddon).not.toHaveBeenCalled();
    });

    it('rejects invalid addon ID', async () => {
        const { ctx, sentData } = createMockCtx({ params: {} });
        await addonsStop(ctx);
        expect(sentData[0]).toEqual({ error: 'Invalid addon ID.' });
    });

    it('calls stopAddon and returns result', async () => {
        mockStopAddon.mockResolvedValue({ success: true });
        const { ctx, sentData } = createMockCtx({ params: { addonId: 'test-addon' } });
        await addonsStop(ctx);
        expect(mockStopAddon).toHaveBeenCalledWith('test-addon');
        expect(sentData[0]).toEqual({ success: true });
    });

    it('returns error from stopAddon', async () => {
        mockStopAddon.mockResolvedValue({ success: false, error: 'Addon is not running (state: stopped)' });
        const { ctx, sentData } = createMockCtx({ params: { addonId: 'test-addon' } });
        await addonsStop(ctx);
        expect(sentData[0]).toEqual({ success: false, error: 'Addon is not running (state: stopped)' });
    });
});

suite('addonsStart', () => {
    it('rejects without all_permissions', async () => {
        const { ctx, sentData } = createMockCtx({
            params: { addonId: 'test-addon' },
            permissions: ['settings.view'],
        });
        await addonsStart(ctx);
        expect(sentData[0]).toEqual({ error: 'Insufficient permissions.' });
        expect(mockStartAddon).not.toHaveBeenCalled();
    });

    it('rejects invalid addon ID', async () => {
        const { ctx, sentData } = createMockCtx({ params: {} });
        await addonsStart(ctx);
        expect(sentData[0]).toEqual({ error: 'Invalid addon ID.' });
    });

    it('calls startAddon and returns result', async () => {
        mockStartAddon.mockResolvedValue({ success: true });
        const { ctx, sentData } = createMockCtx({ params: { addonId: 'test-addon' } });
        await addonsStart(ctx);
        expect(mockStartAddon).toHaveBeenCalledWith('test-addon');
        expect(sentData[0]).toEqual({ success: true });
    });
});

suite('addonsLogs', () => {
    it('rejects without all_permissions', async () => {
        const { ctx, sentData } = createMockCtx({
            params: { addonId: 'test-addon' },
            permissions: ['settings.view'],
        });
        await addonsLogs(ctx);
        expect(sentData[0]).toEqual({ error: 'Insufficient permissions.' });
    });

    it('returns logs for valid addon', async () => {
        const logs = [
            { timestamp: 1000, level: 'info', message: 'hello' },
            { timestamp: 2000, level: 'error', message: 'oops' },
        ];
        mockGetAddonLogs.mockReturnValue(logs);
        const { ctx, sentData } = createMockCtx({ params: { addonId: 'test-addon' } });
        await addonsLogs(ctx);
        expect(mockGetAddonLogs).toHaveBeenCalledWith('test-addon');
        expect(sentData[0]).toEqual({ logs });
    });

    it('returns null when addon not found', async () => {
        mockGetAddonLogs.mockReturnValue(null);
        const { ctx, sentData } = createMockCtx({ params: { addonId: 'nonexistent' } });
        await addonsLogs(ctx);
        expect(sentData[0]).toEqual({ logs: null });
    });
});
