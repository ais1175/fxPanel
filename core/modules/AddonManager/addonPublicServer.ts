const modulename = 'AddonPublicServer';
import Koa from 'koa';
import KoaBodyParser from 'koa-bodyparser';
import HttpClass from 'node:http';

import consoleFactory from '@lib/console';
import type AddonProcess from './addonProcess';
const console = consoleFactory(modulename);

/**
 * Rate limiter — simple per-IP counter that resets every minute.
 */
const MAX_RPM = 600;
const ipCounters = new Map<string, number>();
setInterval(() => ipCounters.clear(), 60_000);

function checkRate(ip: string): boolean {
    const count = ipCounters.get(ip) ?? 0;
    ipCounters.set(ip, count + 1);
    return count < MAX_RPM;
}

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
    private readonly port: number;
    private readonly addonId: string;
    private readonly getProcess: ProcessResolver;
    public isListening = false;

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
            if (!checkRate(ip)) {
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
                const result = await addonProcess.handlePublicRequest({
                    method: ctx.method,
                    path: ctx.path || '/',
                    headers: ctx.headers as Record<string, string>,
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
        if (this.isListening) return;

        return new Promise((resolve, reject) => {
            this.httpServer = HttpClass.createServer(this.app.callback());

            this.httpServer.on('error', (error: NodeJS.ErrnoException) => {
                if (error.code === 'EADDRINUSE') {
                    console.error(`Port ${this.port} is already in use. Public server not started.`);
                    reject(error);
                } else {
                    console.error(`HTTP server error: ${error.message}`);
                    reject(error);
                }
            });

            this.httpServer.listen(this.port, '0.0.0.0', () => {
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

        return new Promise((resolve) => {
            this.httpServer!.close(() => {
                this.isListening = false;
                this.httpServer = null;
                console.log('Public server stopped');
                resolve();
            });
        });
    }
}
