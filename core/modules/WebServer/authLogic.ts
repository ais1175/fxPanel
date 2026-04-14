const modulename = 'WebServer:AuthLogic';
import { z } from 'zod';
import consoleFactory from '@lib/console';
import type { SessToolsType } from './middlewares/sessionMws';
import { StoredAdmin, AuthedAdmin } from '@modules/AdminStore/adminClasses';
export { AuthedAdmin, StoredAdmin };
export type { AuthedAdminType } from '@modules/AdminStore/adminClasses';
const console = consoleFactory(modulename);

/**
 * Return type helper - null reason indicates nothing to print
 */
type AuthLogicReturnType =
    | {
          success: true;
          admin: AuthedAdmin;
      }
    | {
          success: false;
          rejectReason?: string;
      };
const successResp = (storedAdmin: StoredAdmin, csrfToken?: string) =>
    ({
        success: true,
        admin: storedAdmin.getAuthed(csrfToken),
    }) as const;
const failResp = (reason?: string) =>
    ({
        success: false,
        rejectReason: reason,
    }) as const;

/**
 * ZOD schemas for session auth
 */
const validPassSessAuthSchema = z.object({
    type: z.literal('password'),
    username: z.string(),
    csrfToken: z.string(),
    expiresAt: z.literal(false),
    password_hash: z.string(),
});
export type PassSessAuthType = z.infer<typeof validPassSessAuthSchema>;

const validCfxreSessAuthSchema = z.object({
    type: z.literal('cfxre'),
    username: z.string(),
    csrfToken: z.string(),
    expiresAt: z.number(),
    identifier: z.string(),
});
export type CfxreSessAuthType = z.infer<typeof validCfxreSessAuthSchema>;

const validDiscordSessAuthSchema = z.object({
    type: z.literal('discord'),
    username: z.string(),
    csrfToken: z.string(),
    expiresAt: z.number(),
    identifier: z.string(),
});
export type DiscordSessAuthType = z.infer<typeof validDiscordSessAuthSchema>;

// 2FA pending session — password verified, awaiting TOTP code
const validPending2faSessSchema = z.object({
    type: z.literal('pending_2fa'),
    username: z.string(),
    password_hash: z.string(),
});
export type Pending2faSessAuthType = z.infer<typeof validPending2faSessSchema>;

const validSessAuthSchema = z.discriminatedUnion('type', [validPassSessAuthSchema, validCfxreSessAuthSchema, validDiscordSessAuthSchema]);

/**
 * Autentication logic used in both websocket and webserver, for both web and nui requests.
 */
export const checkRequestAuth = (
    reqHeader: { [key: string]: unknown },
    reqIp: string,
    isLocalRequest: boolean,
    sessTools: SessToolsType,
) => {
    return typeof reqHeader['x-txadmin-token'] === 'string'
        ? nuiAuthLogic(reqIp, isLocalRequest, reqHeader)
        : normalAuthLogic(sessTools);
};

/**
 * Autentication logic used in both websocket and webserver
 */
export const normalAuthLogic = (sessTools: SessToolsType): AuthLogicReturnType => {
    try {
        // Getting session
        const sess = sessTools.get();
        if (!sess) {
            return failResp();
        }

        // Parsing session auth
        const validationResult = validSessAuthSchema.safeParse(sess?.auth);
        if (!validationResult.success) {
            return failResp();
        }
        const sessAuth = validationResult.data;

        // Checking for expiration
        if (sessAuth.expiresAt !== false && Date.now() > sessAuth.expiresAt) {
            return failResp(`Expired session from '${sess.auth?.username}'.`);
        }

        // Searching for admin in AdminStore
        const storedAdmin = txCore.adminStore.getAdminByName(sessAuth.username);
        if (!storedAdmin) {
            return failResp(`Admin '${sessAuth.username}' not found.`);
        }

        // Checking for auth types
        if (sessAuth.type === 'password') {
            if (storedAdmin.passwordHash !== sessAuth.password_hash) {
                return failResp(`Password hash doesn't match for '${sessAuth.username}'.`);
            }
            return successResp(storedAdmin, sessAuth.csrfToken);
        } else if (sessAuth.type === 'cfxre') {
            if (
                typeof storedAdmin.providers.citizenfx !== 'object' ||
                storedAdmin.providers.citizenfx.identifier !== sessAuth.identifier
            ) {
                return failResp(`Cfxre identifier doesn't match for '${sessAuth.username}'.`);
            }
            return successResp(storedAdmin, sessAuth.csrfToken);
        } else if (sessAuth.type === 'discord') {
            if (
                typeof storedAdmin.providers.discord !== 'object' ||
                storedAdmin.providers.discord.identifier !== sessAuth.identifier
            ) {
                return failResp(`Discord identifier doesn't match for '${sessAuth.username}'.`);
            }
            return successResp(storedAdmin, sessAuth.csrfToken);
        } else {
            return failResp('Invalid auth type.');
        }
    } catch (error) {
        console.debug(`Error validating session data: ${emsg(error)}`);
        return failResp('Error validating session data.');
    }
};

/**
 * Autentication & authorization logic used in for nui requests
 */
export const nuiAuthLogic = (
    reqIp: string,
    isLocalRequest: boolean,
    reqHeader: { [key: string]: unknown },
): AuthLogicReturnType => {
    try {
        // Check sus IPs
        if (!isLocalRequest && !txConfig.webServer.disableNuiSourceCheck) {
            console.verbose.warn(`NUI Auth Failed: reqIp "${reqIp}" not a local or allowed address.`);
            return failResp('Invalid Request: source');
        }

        // Check missing headers
        if (typeof reqHeader['x-txadmin-token'] !== 'string') {
            return failResp('Invalid Request: token header');
        }
        if (typeof reqHeader['x-txadmin-identifiers'] !== 'string') {
            return failResp('Invalid Request: identifiers header');
        }

        // Check token value
        if (reqHeader['x-txadmin-token'] !== txCore.webServer.luaComToken) {
            const expected = txCore.webServer.luaComToken;
            const censoredExpected = expected.slice(0, 6) + '...' + expected.slice(-6);
            console.verbose.warn(
                `NUI Auth Failed: token received '${reqHeader['x-txadmin-token']}' !== expected '${censoredExpected}'.`,
            );
            return failResp('Unauthorized: token value');
        }

        // Check identifier array
        const identifiers = reqHeader['x-txadmin-identifiers'].split(',').filter((i) => i.length);
        if (!identifiers.length) {
            return failResp('Unauthorized: empty identifier array');
        }

        // Searching for admin in AdminStore
        const storedAdmin = txCore.adminStore.getAdminByIdentifiers(identifiers);
        if (!storedAdmin) {
            if (!reqHeader['x-txadmin-identifiers'].includes('license:')) {
                return failResp(
                    'Unauthorized: you do not have a license identifier, which means the server probably has sv_lan enabled. Please disable sv_lan and restart the server to use the in-game menu.',
                );
            } else {
                //this one is handled differently in resource/menu/client/cl_base.lua
                return failResp('nui_admin_not_found');
            }
        }
        return successResp(storedAdmin, undefined);
    } catch (error) {
        console.debug(`Error validating session data: ${emsg(error)}`);
        return failResp('Error validating auth header');
    }
};
