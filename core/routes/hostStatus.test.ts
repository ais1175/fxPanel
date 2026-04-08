import { suite, it, expect, vi } from 'vitest';
import HostStatus from './hostStatus';

vi.stubGlobal('txManager', {
    hostStatus: {
        cpu: 45,
        memory: { total: 16384, used: 8192, free: 8192 },
        uptime: 3600,
    },
});

suite('routes/hostStatus', () => {
    it('should return txManager.hostStatus directly', async () => {
        const sentData: any[] = [];
        const ctx = {
            send: vi.fn((data: any) => sentData.push(data)),
        };

        await HostStatus(ctx as any);

        expect(ctx.send).toHaveBeenCalledOnce();
        expect(sentData[0]).toEqual({
            cpu: 45,
            memory: { total: 16384, used: 8192, free: 8192 },
            uptime: 3600,
        });
    });
});
