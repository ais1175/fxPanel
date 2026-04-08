const modulename = 'WebServer:SessionMws';
import fs from 'node:fs';
import fsp from 'node:fs/promises';
import type { CfxreSessAuthType, PassSessAuthType, Pending2faSessAuthType } from '../authLogic';
import { LRUCacheWithDelete } from 'mnemonist';
import { RawKoaCtx } from '../ctxTypes';
import { Next } from 'koa';
import { randomUUID } from 'node:crypto';
import { Socket } from 'socket.io';
import { parse as cookieParse } from 'cookie';
import { SetOption as KoaCookieSetOption } from 'cookies';
import type { DeepReadonly } from 'utility-types';
import consoleFactory from '@lib/console';
const console = consoleFactory(modulename);

//Types
export type AddMasterUserInfoType = {
    name: string;
    identifier: string;
};
export type ValidSessionType = {
    auth?: PassSessAuthType | CfxreSessAuthType | Pending2faSessAuthType;
    tmpAddMasterUserInfo?: AddMasterUserInfoType;
    tmpDiscourseNonce?: string; //uuid v4
    tmpDiscoursePrivateKey?: string; //PEM-encoded RSA private key
    tmpTotpSecret?: string; //pending TOTP secret during 2FA setup
};
export type SessToolsType = {
    get: () => DeepReadonly<ValidSessionType> | undefined;
    set: (sess: ValidSessionType) => void;
    destroy: () => void;
};
type StoredSessionType = {
    expires: number;
    data: ValidSessionType;
};

/**
 * Storage for the sessions, with optional file persistence.
 */
export class SessionMemoryStorage {
    private readonly sessions = new LRUCacheWithDelete<string, StoredSessionType>(5000);
    public readonly maxAgeMs = 24 * 60 * 60 * 1000;
    private readonly persistFilePath: string | null;

    constructor(maxAgeMs?: number, persistFilePath?: string) {
        if (maxAgeMs) {
            this.maxAgeMs = maxAgeMs;
        }
        this.persistFilePath = persistFilePath ?? null;

        //Restore from disk if persistence is enabled
        if (this.persistFilePath) {
            this.loadFromFile();
        }

        //Cleanup every 5 mins
        setInterval(() => {
            const now = Date.now();
            for (const [key, sess] of this.sessions) {
                if (sess.expires < now) {
                    this.sessions.delete(key);
                }
            }
        }, 5 * 60_000);
    }

    get(key: string) {
        const stored = this.sessions.get(key);
        if (!stored) return;
        if (stored.expires < Date.now()) {
            this.sessions.delete(key);
            return;
        }
        return stored.data as DeepReadonly<ValidSessionType>;
    }

    set(key: string, sess: ValidSessionType) {
        this.sessions.set(key, {
            expires: Date.now() + this.maxAgeMs,
            data: sess,
        });
    }

    refresh(key: string) {
        const stored = this.sessions.get(key);
        if (!stored) return;
        this.sessions.set(key, {
            expires: Date.now() + this.maxAgeMs,
            data: stored.data,
        });
    }

    destroy(key: string) {
        return this.sessions.delete(key);
    }

    get size() {
        return this.sessions.size;
    }

    /**
     * Persist session data to disk (called on shutdown).
     */
    handleShutdown() {
        if (!this.persistFilePath) return;
        try {
            const now = Date.now();
            const entries: [string, StoredSessionType][] = [];
            for (const [key, sess] of this.sessions) {
                if (sess.expires > now) {
                    entries.push([key, sess]);
                }
            }
            fs.writeFileSync(this.persistFilePath, JSON.stringify(entries));
            console.verbose.debug(`Persisted ${entries.length} sessions to disk.`);
        } catch (error) {
            console.error(`Failed to persist sessions: ${(error as Error).message}`);
        }
    }

    /**
     * Restore session data from disk (called on boot).
     */
    private loadFromFile() {
        if (!this.persistFilePath) return;
        try {
            const raw = fs.readFileSync(this.persistFilePath, 'utf8');
            const entries: [string, StoredSessionType][] = JSON.parse(raw);
            if (!Array.isArray(entries)) throw new Error('data_is_not_an_array');
            const now = Date.now();
            let restored = 0;
            for (const [key, sess] of entries) {
                if (
                    typeof key === 'string' &&
                    sess &&
                    typeof sess.expires === 'number' &&
                    sess.expires > now &&
                    sess.data != null &&
                    typeof sess.data === 'object' &&
                    !Array.isArray(sess.data)
                ) {
                    this.sessions.set(key, sess);
                    restored++;
                }
            }
            console.verbose.ok(`Restored ${restored} sessions from disk.`);
        } catch (error) {
            if ((error as NodeJS.ErrnoException)?.code === 'ENOENT') {
                console.verbose.debug('No persisted sessions file found, starting fresh.');
            } else {
                console.warn(`Failed to load persisted sessions: ${(error as Error).message}`);
                console.warn('Starting with empty session store.');
            }
        }
    }
}

/**
 * Helper to check if the session id is valid
 */
const isValidSessId = (sessId: string) => {
    if (typeof sessId !== 'string') return false;
    if (sessId.length !== 36) return false;
    return true;
};

/**
 * Middleware factory to add sessTools to the koa context.
 */
export const koaSessMw = (cookieName: string, store: SessionMemoryStorage) => {
    // Determine if we should use secure cookies
    // Enable secure cookies if explicitly configured or in production
    const isSecureEnabled = txConfig.webServer.useSecureCookies || process.env.NODE_ENV === 'production';

    const cookieOptions = {
        path: '/',
        maxAge: store.maxAgeMs,
        httpOnly: true,
        sameSite: 'lax' as const,
        secure: isSecureEnabled,
        overwrite: true,
        signed: true,
    } satisfies KoaCookieSetOption;

    // Log warning if secure cookies are enabled but not on HTTPS
    if (isSecureEnabled) {
        console.verbose.debug('Session cookies configured with secure flag enabled.');
    }

    //Middleware
    return (ctx: RawKoaCtx, next: Next) => {
        const sessGet = () => {
            const sessId = ctx.cookies.get(cookieName);
            if (!sessId || !isValidSessId(sessId)) return;
            const stored = store.get(sessId);
            if (!stored) return;
            ctx._refreshSessionCookieId = sessId;
            return stored;
        };

        const sessSet = (sess: ValidSessionType) => {
            const sessId = ctx.cookies.get(cookieName);
            if (!sessId || !isValidSessId(sessId)) {
                const newSessId = randomUUID();
                ctx.cookies.set(cookieName, newSessId, cookieOptions);
                store.set(newSessId, sess);
            } else {
                store.set(sessId, sess);
            }
        };

        const sessDestroy = () => {
            const sessId = ctx.cookies.get(cookieName);
            if (!sessId || !isValidSessId(sessId)) return;
            store.destroy(sessId);
            ctx.cookies.set(cookieName, 'unset', cookieOptions);
        };

        ctx.sessTools = {
            get: sessGet,
            set: sessSet,
            destroy: sessDestroy,
        } satisfies SessToolsType;

        try {
            return next();
        } catch (error) {
            throw error;
        } finally {
            if (typeof ctx._refreshSessionCookieId === 'string') {
                ctx.cookies.set(cookieName, ctx._refreshSessionCookieId, cookieOptions);
                store.refresh(ctx._refreshSessionCookieId);
            }
        }
    };
};

/**
 * Middleware factory to add sessTools to the socket context.
 *
 * NOTE: The set() and destroy() functions are NO-OPs because we cannot set cookies in socket.io,
 *  but that's fine since socket pages are always acompanied by a web page
 *  the authLogic only needs to get the cookie, and the webAuthMw only destroys it
 *  and webSocket.handleConnection() just drops if authLogic fails.
 */
export const socketioSessMw = (cookieName: string, store: SessionMemoryStorage) => {
    return async (socket: Socket & { sessTools?: SessToolsType }, next: Function) => {
        const sessGet = () => {
            const cookiesString = socket?.handshake?.headers?.cookie;
            if (typeof cookiesString !== 'string') return;
            const cookies = cookieParse(cookiesString);
            const sessId = cookies[cookieName];
            if (!sessId || !isValidSessId(sessId)) return;
            return store.get(sessId);
        };

        socket.sessTools = {
            get: sessGet,
            set: (sess: ValidSessionType) => {},
            destroy: () => {},
        } satisfies SessToolsType;

        return next();
    };
};
