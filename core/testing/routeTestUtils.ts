import { vi } from 'vitest';

/**
 * Creates a mock AuthedCtx for route testing.
 */
export function createMockCtx(
    overrides: {
        params?: Record<string, string>;
        query?: Record<string, string>;
        body?: any;
        adminName?: string;
        permissions?: string[];
    } = {},
) {
    const sentData: any[] = [];
    const ctx = {
        params: overrides.params ?? {},
        query: overrides.query ?? {},
        request: {
            body: overrides.body ?? {},
        },
        send: vi.fn((data: any) => {
            sentData.push(data);
        }),
        utils: {
            error: vi.fn((status: number, message: string) => {
                sentData.push({ error: message, status });
            }),
        },
        admin: {
            name: overrides.adminName ?? 'testadmin',
            testPermission: vi.fn((perm: string) => {
                if (!overrides.permissions) return true;
                return overrides.permissions.includes(perm) || overrides.permissions.includes('all_permissions');
            }),
            hasPermission: vi.fn((perm: string) => {
                if (!overrides.permissions) return true;
                return overrides.permissions.includes(perm) || overrides.permissions.includes('all_permissions');
            }),
            logAction: vi.fn(),
            getAuthData: vi.fn(() => ({
                name: overrides.adminName ?? 'testadmin',
                permissions: overrides.permissions ?? ['all_permissions'],
                csrfToken: 'test-csrf',
                isMaster: true,
                isTempPassword: false,
            })),
        },
        getBody: vi.fn((schema: any) => {
            try {
                return schema.parse(overrides.body);
            } catch {
                sentData.push({ error: 'Validation failed' });
                return undefined;
            }
        }),
    };
    return { ctx: ctx as any, sentData };
}
