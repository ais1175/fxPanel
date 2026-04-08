import { suite, it, expect, vi } from 'vitest';
import AuthSelf from './self';
import { createMockCtx } from '../../testing/routeTestUtils';

suite('authentication/self', () => {
    it('should return the admin auth data', async () => {
        const { ctx, sentData } = createMockCtx({
            adminName: 'superadmin',
            permissions: ['all_permissions'],
        });

        await AuthSelf(ctx);

        expect(ctx.send).toHaveBeenCalledOnce();
        expect(sentData[0]).toMatchObject({
            name: 'superadmin',
            permissions: ['all_permissions'],
            csrfToken: 'test-csrf',
        });
    });
});
