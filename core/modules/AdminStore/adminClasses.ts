import consoleFactory from '@lib/console';
import type { ReactAuthDataType } from '@shared/authApiTypes';
const console = consoleFactory('AuthedAdmin');

//======================================================================
// Types
//======================================================================
export type AdminProviderData = {
    id: string;
    identifier: string;
    data: Record<string, unknown>;
};

export type AdminProviders = {
    citizenfx?: AdminProviderData;
    discord?: AdminProviderData;
};

export type RawAdminType = {
    $schema: number;
    name: string;
    master: boolean;
    password_hash: string;
    password_temporary?: boolean;
    providers: AdminProviders;
    permissions: string[];
    // 2FA fields (optional, added by totp setup)
    totp_secret?: string;
    totp_backup_codes?: string[];
};

//======================================================================
// StoredAdmin
//======================================================================
/**
 * Typed wrapper around a raw admin record from admins.json.
 * Instances are returned by AdminStore getters and are immutable snapshots.
 */
export class StoredAdmin {
    public readonly name: string;
    public readonly isMaster: boolean;
    public readonly passwordHash: string;
    public readonly isTempPassword: boolean;
    public readonly providers: AdminProviders;
    public readonly permissions: string[];
    public readonly totpEnabled: boolean;

    constructor(raw: RawAdminType | StoredAdmin) {
        if (raw instanceof StoredAdmin) {
            this.name = raw.name;
            this.isMaster = raw.isMaster;
            this.passwordHash = raw.passwordHash;
            this.isTempPassword = raw.isTempPassword;
            this.providers = raw.providers;
            this.permissions = raw.permissions;
            this.totpEnabled = raw.totpEnabled;
        } else {
            this.name = raw.name;
            this.isMaster = raw.master;
            this.passwordHash = raw.password_hash;
            this.isTempPassword = raw.password_temporary === true;
            this.providers = raw.providers;
            this.permissions = raw.permissions;
            this.totpEnabled = typeof raw.totp_secret === 'string' && raw.totp_secret.length > 0;
        }
    }

    /**
     * Creates an AuthedAdmin for this stored admin, to be attached to a request context.
     */
    getAuthed(csrfToken?: string) {
        return new AuthedAdmin(this, csrfToken);
    }
}

//======================================================================
// AuthedAdmin
//======================================================================
/**
 * Request-scoped admin with auth context (CSRF token, profile picture).
 * Used as ctx.admin in web/api/nui routes.
 */
export class AuthedAdmin extends StoredAdmin {
    public readonly csrfToken?: string;
    public readonly profilePicture: string | undefined;

    constructor(storedAdmin: StoredAdmin, csrfToken?: string) {
        super(storedAdmin);
        this.csrfToken = csrfToken;
        const cachedPfp = txCore.cacheStore.get(`admin:picture:${this.name}`);
        this.profilePicture = typeof cachedPfp === 'string' ? cachedPfp : undefined;
    }

    /**
     * Logs an action to the console and the action logger
     */
    logAction(action: string) {
        txCore.logger.system.write(this.name, action, 'action');
    }

    /**
     * Logs a command to the console and the action logger
     */
    logCommand(data: string) {
        txCore.logger.system.write(this.name, data, 'command');
    }

    /**
     * Returns if admin has permission or not - no message is printed
     */
    hasPermission(perm: string) {
        try {
            if (perm === 'master') {
                return this.isMaster;
            }
            return this.isMaster || this.permissions.includes('all_permissions') || this.permissions.includes(perm);
        } catch (error) {
            console.verbose.warn(`Error validating permission '${perm}' denied.`);
            return false;
        }
    }

    /**
     * Test for a permission and prints warn if test fails and verbose
     */
    testPermission(perm: string, fromCtx: string) {
        if (!this.hasPermission(perm)) {
            console.verbose.warn(`[${this.name}] Permission '${perm}' denied.`, fromCtx);
            return false;
        }
        return true;
    }

    /**
     * Returns the data used for the frontend or sv_admins.lua
     */
    getAuthData(): ReactAuthDataType {
        return {
            name: this.name,
            permissions: this.isMaster ? ['all_permissions'] : this.permissions,
            isMaster: this.isMaster,
            isTempPassword: this.isTempPassword,
            profilePicture: this.profilePicture,
            csrfToken: this.csrfToken ?? 'not_set',
            totpEnabled: this.totpEnabled,
        };
    }
}

export type AuthedAdminType = InstanceType<typeof AuthedAdmin>;
