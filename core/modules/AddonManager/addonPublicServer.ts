const modulename = 'AddonPublicServer';
import Koa from 'koa';
import KoaBodyParser from 'koa-bodyparser';
import HttpClass from 'node:http';

import consoleFactory from '@lib/console';
import type AddonProcess from './addonProcess';
const console = consoleFactory(modulename);

/**
 * Rate limiter — simple per-IP counter that resets every minute.
 * Counters are kept per AddonPublicServer instance so each addon has an
 * isolated rate-limit pool.
 */
const MAX_RPM = 600;

type ProcessResolver = (addonId: string) => AddonProcess | null;

/**
 * AddonPublicServer — Standalone HTTP server for public addon routes.
 *
 * Listens on a configurable port, routes all requests to a single addon
 * via the `public-request` IPC message type (no authentication).
 * The addon owns the entire URL space: / → home, /rules → rules page, etc.
 */
export default class AddonPublicServer {
    private app: Koa;
    private httpServer: HttpClass.Server | null = null;
    private ipClearTimer: ReturnType<typeof setInterval> | null = null;
    private readonly ipCounters = new Map<string, number>();
    private readonly port: number;
    private readonly addonId: string;
    private readonly getProcess: ProcessResolver;
    public isListening = false;
    private isStarting = false;

    private checkRate(ip: string): boolean {
        const count = this.ipCounters.get(ip) ?? 0;
        this.ipCounters.set(ip, count + 1);
        return count < MAX_RPM;
    }

    constructor(port: number, addonId: string, getProcess: ProcessResolver) {
        this.port = port;
        this.addonId = addonId;
        this.getProcess = getProcess;

        this.app = new Koa();

        // Error handler
        this.app.on('error', (error) => {
            if ((error as any).code === 'ECONNRESET') return;
            console.error(`Koa error: ${(error as Error).message}`);
        });

        // Body parser
        this.app.use(KoaBodyParser({ jsonLimit: '1mb' }));

        // Main routing middleware
        this.app.use(async (ctx) => {
            // Rate limit
            const ip = ctx.ip;
            if (!this.checkRate(ip)) {
                ctx.status = 429;
                ctx.body = { error: 'Too many requests' };
                return;
            }

            const addonProcess = this.getProcess(this.addonId);
            if (!addonProcess) {
                ctx.status = 503;
                ctx.body = { error: 'Addon is not running' };
                return;
            }

            try {
                const sanitisedHeaders: Record<string, string> = {};
                for (const [key, value] of Object.entries(ctx.headers)) {
                    if (value === undefined) continue;
                    const lower = key.toLowerCase();
                    if (lower === 'cookie' || lower === 'authorization' || lower === 'x-txadmin-csrftoken' || lower === 'x-txadmin-token') continue;
                    sanitisedHeaders[key] = Array.isArray(value) ? value.join(', ') : String(value);
                }

                const result = await addonProcess.handlePublicRequest({
                    method: ctx.method,
                    path: ctx.path || '/',
                    headers: sanitisedHeaders,
                    body: ctx.request.body,
                });

                ctx.status = result.status;
                if (result.headers) {
                    for (const [key, value] of Object.entries(result.headers)) {
                        const lowerKey = key.toLowerCase();
                        if (lowerKey === 'set-cookie') continue;
                        ctx.set(key, value);
                    }
                }
                ctx.body = result.body;
            } catch (error) {
                console.error(`Public request error for ${this.addonId}: ${(error as Error).message}`);
                ctx.status = 504;
                ctx.body = { error: 'Request timed out' };
            }
        });
    }

    /**
     * Start listening on the configured port.
     */
    async start(): Promise<void> {
        if (this.isListening || this.isStarting) return;
        this.isStarting = true;
        if (!this.ipClearTimer) {
            this.ipClearTimer = setInterval(() => this.ipCounters.clear(), 60_000);
        }

        return new Promise((resolve, reject) => {
            this.httpServer = HttpClass.createServer(this.app.callback());

            this.httpServer.on('error', (error: NodeJS.ErrnoException) => {
                this.isStarting = false;
                this.isListening = false;
                if (this.ipClearTimer) {
                    clearInterval(this.ipClearTimer);
                    this.ipClearTimer = null;
                }
                if (error.code === 'EADDRINUSE') {
                    console.error(`Port ${this.port} is already in use. Public server not started.`);
                    reject(error);
                } else {
                    console.error(`HTTP server error: ${error.message}`);
                    reject(error);
                }
            });

            this.httpServer.listen(this.port, '0.0.0.0', () => {
                this.isStarting = false;
                this.isListening = true;
                console.log(`Public server listening on port ${this.port}`);
                resolve();
            });
        });
    }

    /**
     * Stop the HTTP server.
     */
    async stop(): Promise<void> {
        if (!this.httpServer || !this.isListening) return;
        if (this.ipClearTimer) {
            clearInterval(this.ipClearTimer);
            this.ipClearTimer = null;
        }

        return new Promise((resolve) => {
            this.httpServer!.close(() => {
                this.isStarting = false;
                this.isListening = false;
                this.httpServer = null;
                console.log('Public server stopped');
                resolve();
            });
        });
    }
}
