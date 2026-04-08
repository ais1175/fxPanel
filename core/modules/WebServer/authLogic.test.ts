import { suite, it, expect, vi, beforeEach } from 'vitest';
import { checkRequestAuth, normalAuthLogic, nuiAuthLogic } from './authLogic';
import { StoredAdmin } from '@modules/AdminStore/adminClasses';
import type { SessToolsType } from './middlewares/sessionMws';
import type { PassSessAuthType, CfxreSessAuthType } from './authLogic';

//Mock admin data
const mockAdminRaw = {
    $schema: 1,
    name: 'testadmin',
    master: true,
    password_hash: '$2b$11$K3HwDzkoUfhU6.W.tScfhOLEtR5uNc9qpQ685emtERx3dZ7fmgXCy',
    providers: {
        citizenfx: {
            id: '123456',
            identifier: 'fivem:123456',
            data: {},
        },
    },
    permissions: ['all_permissions'],
};
const storedAdmin = new StoredAdmin(mockAdminRaw);

//Stub txCore globals for auth logic
vi.stubGlobal('txCore', {
    adminStore: {
        getAdminByName: (name: string) => (name === 'testadmin' ? storedAdmin : null),
        getAdminByIdentifiers: (ids: string[]) => {
            if (ids.some((id) => id === 'fivem:123456')) return storedAdmin;
            return null;
        },
    },
    webServer: {
        luaComToken: 'test-lua-com-token',
    },
    cacheStore: {
        get: () => undefined,
    },
});
vi.stubGlobal('txConfig', {
    webServer: {
        disableNuiSourceCheck: false,
    },
});

const mockSessTools = (sessData?: any): SessToolsType => ({
    get: () => sessData,
    set: vi.fn(),
    destroy: vi.fn(),
});

suite('normalAuthLogic', () => {
    it('should fail with no session', () => {
        const result = normalAuthLogic(mockSessTools(undefined));
        expect(result.success).toBe(false);
    });

    it('should fail with empty session', () => {
        const result = normalAuthLogic(mockSessTools({}));
        expect(result.success).toBe(false);
    });

    it('should fail with invalid auth shape', () => {
        const result = normalAuthLogic(mockSessTools({ auth: { type: 'garbage' } }));
        expect(result.success).toBe(false);
    });

    it('should succeed with valid password session', () => {
        const sessAuth: PassSessAuthType = {
            type: 'password',
            username: 'testadmin',
            csrfToken: 'test-csrf-token',
            expiresAt: false,
            password_hash: mockAdminRaw.password_hash,
        };
        const result = normalAuthLogic(mockSessTools({ auth: sessAuth }));
        expect(result.success).toBe(true);
        if (result.success) {
            expect(result.admin.name).toBe('testadmin');
            expect(result.admin.csrfToken).toBe('test-csrf-token');
        }
    });

    it('should fail with wrong password hash', () => {
        const sessAuth: PassSessAuthType = {
            type: 'password',
            username: 'testadmin',
            csrfToken: 'test-csrf-token',
            expiresAt: false,
            password_hash: 'wrong-hash',
        };
        const result = normalAuthLogic(mockSessTools({ auth: sessAuth }));
        expect(result.success).toBe(false);
    });

    it('should succeed with valid cfxre session', () => {
        const sessAuth: CfxreSessAuthType = {
            type: 'cfxre',
            username: 'testadmin',
            csrfToken: 'test-csrf-token',
            expiresAt: Date.now() + 60_000,
            identifier: 'fivem:123456',
        };
        const result = normalAuthLogic(mockSessTools({ auth: sessAuth }));
        expect(result.success).toBe(true);
        if (result.success) {
            expect(result.admin.name).toBe('testadmin');
        }
    });

    it('should fail with expired cfxre session', () => {
        const sessAuth: CfxreSessAuthType = {
            type: 'cfxre',
            username: 'testadmin',
            csrfToken: 'test-csrf-token',
            expiresAt: Date.now() - 60_000,
            identifier: 'fivem:123456',
        };
        const result = normalAuthLogic(mockSessTools({ auth: sessAuth }));
        expect(result.success).toBe(false);
    });

    it('should fail with wrong cfxre identifier', () => {
        const sessAuth: CfxreSessAuthType = {
            type: 'cfxre',
            username: 'testadmin',
            csrfToken: 'test-csrf-token',
            expiresAt: Date.now() + 60_000,
            identifier: 'fivem:999999',
        };
        const result = normalAuthLogic(mockSessTools({ auth: sessAuth }));
        expect(result.success).toBe(false);
    });

    it('should fail when admin not found in store', () => {
        const sessAuth: PassSessAuthType = {
            type: 'password',
            username: 'nonexistent',
            csrfToken: 'test-csrf-token',
            expiresAt: false,
            password_hash: 'whatever',
        };
        const result = normalAuthLogic(mockSessTools({ auth: sessAuth }));
        expect(result.success).toBe(false);
    });
});

suite('nuiAuthLogic', () => {
    it('should fail with non-local request when source check enabled', () => {
        const result = nuiAuthLogic('8.8.8.8', false, {
            'x-txadmin-token': 'test-token',
            'x-txadmin-identifiers': 'license:abc123',
        });
        expect(result.success).toBe(false);
    });

    it('should fail with missing token header', () => {
        const result = nuiAuthLogic('127.0.0.1', true, {
            'x-txadmin-identifiers': 'license:abc123',
        });
        expect(result.success).toBe(false);
    });

    it('should fail with missing identifiers header', () => {
        const result = nuiAuthLogic('127.0.0.1', true, {
            'x-txadmin-token': 'test-lua-com-token',
        });
        expect(result.success).toBe(false);
    });

    it('should fail with wrong token', () => {
        const result = nuiAuthLogic('127.0.0.1', true, {
            'x-txadmin-token': 'wrong-token',
            'x-txadmin-identifiers': 'license:abc123',
        });
        expect(result.success).toBe(false);
    });

    it('should fail with empty identifiers', () => {
        const result = nuiAuthLogic('127.0.0.1', true, {
            'x-txadmin-token': 'test-lua-com-token',
            'x-txadmin-identifiers': '',
        });
        expect(result.success).toBe(false);
    });

    it('should succeed with valid token and matching identifiers', () => {
        const result = nuiAuthLogic('127.0.0.1', true, {
            'x-txadmin-token': 'test-lua-com-token',
            'x-txadmin-identifiers': 'fivem:123456',
        });
        expect(result.success).toBe(true);
        if (result.success) {
            expect(result.admin.name).toBe('testadmin');
        }
    });

    it('should return nui_admin_not_found with valid token but no matching admin', () => {
        const result = nuiAuthLogic('127.0.0.1', true, {
            'x-txadmin-token': 'test-lua-com-token',
            'x-txadmin-identifiers': 'license:nomatch',
        });
        expect(result.success).toBe(false);
        if (!result.success) {
            expect(result.rejectReason).toBe('nui_admin_not_found');
        }
    });
});

suite('checkRequestAuth', () => {
    it('should dispatch to nuiAuthLogic when x-txadmin-token is present', () => {
        const result = checkRequestAuth(
            { 'x-txadmin-token': 'test-lua-com-token', 'x-txadmin-identifiers': 'fivem:123456' },
            '127.0.0.1',
            true,
            mockSessTools(undefined),
        );
        expect(result.success).toBe(true);
    });

    it('should dispatch to normalAuthLogic when no x-txadmin-token', () => {
        const sessAuth: PassSessAuthType = {
            type: 'password',
            username: 'testadmin',
            csrfToken: 'test-csrf-token',
            expiresAt: false,
            password_hash: mockAdminRaw.password_hash,
        };
        const result = checkRequestAuth({}, '127.0.0.1', true, mockSessTools({ auth: sessAuth }));
        expect(result.success).toBe(true);
    });

    it('should fail normalAuthLogic path when no session', () => {
        const result = checkRequestAuth({}, '127.0.0.1', true, mockSessTools(undefined));
        expect(result.success).toBe(false);
    });
});
