const modulename = 'AddonProcess';
import { fork, ChildProcess } from 'node:child_process';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import consoleFactory from '@lib/console';
import { AddonStorageScope } from './addonStorage';
import { isPathInside } from './addonUtils';
import { ServerPlayer } from '@lib/player/playerClasses';
import type {
    AddonState,
    AddonRouteDescriptor,
    CoreToAddonMessage,
    AddonToCoreMessage,
} from '@shared/addonTypes';
const console = consoleFactory(modulename);

const IPC_TIMEOUT_MS = 30_000;
const STORAGE_TIMEOUT_MS = 5_000;
const SHUTDOWN_TIMEOUT_MS = 5_000;

interface PendingRequest {
    resolve: (value: unknown) => void;
    reject: (reason: Error) => void;
    timer: NodeJS.Timeout;
}

/**
 * Manages a single addon's child process lifecycle and IPC communication.
 */
export interface AddonLogEntry {
    timestamp: number;
    level: 'info' | 'warn' | 'error';
    message: string;
}

const MAX_LOG_ENTRIES = 200;

export default class AddonProcess {
    public readonly addonId: string;
    public state: AddonState = 'discovered';
    public routes: AddonRouteDescriptor[] = [];
    public readonly logs: AddonLogEntry[] = [];
    public startedAt: number | null = null;
    public startupDurationMs: number | null = null;
    public crashCount = 0;

    private child: ChildProcess | null = null;
    private readonly entryPath: string;
    private readonly addonDir: string;
    private readonly permissions: string[];
    private readonly storage: AddonStorageScope;
    private readonly pendingRequests = new Map<string, PendingRequest>();
    private readonly onWsPush: (addonId: string, event: string, data: unknown) => void;
    private readonly onCrash: ((addonId: string) => void) | undefined;
    private readonly logPrefix: string;

    private readonly nodeModulesDir: string;

    constructor(opts: {
        addonId: string;
        entryPath: string;
        addonDir: string;
        nodeModulesDir: string;
        permissions: string[];
        storage: AddonStorageScope;
        onWsPush: (addonId: string, event: string, data: unknown) => void;
        onCrash?: (addonId: string) => void;
    }) {
        this.addonId = opts.addonId;
        this.entryPath = opts.entryPath;
        this.addonDir = opts.addonDir;
        this.nodeModulesDir = opts.nodeModulesDir;
        this.permissions = opts.permissions;
        this.storage = opts.storage;
        this.onWsPush = opts.onWsPush;
        this.onCrash = opts.onCrash;
        this.logPrefix = `[addon:${opts.addonId}]`;
    }

    /**
     * Spawn the addon child process and wait for it to send "ready".
     */
    async start(timeoutMs: number): Promise<{ success: boolean; error?: string }> {
        this.state = 'starting';
        const startTime = performance.now();

        // Resolve entry path relative to addon dir
        const resolvedEntry = path.resolve(this.addonDir, this.entryPath);

        // Verify entry path is strictly within addon directory (prevent path traversal
        // via ../, sibling-prefix paths like <addonDir>2/..., and symlink escapes).
        if (!isPathInside(this.addonDir, resolvedEntry)) {
            this.state = 'failed';
            return { success: false, error: 'Entry path escapes addon directory' };
        }

        try {
            // The addon-sdk lives at <txaPath>/node_modules/addon-sdk/
            // ESM resolution walks up the directory tree to find node_modules,
            // so addons at <txaPath>/addons/<id>/ naturally resolve it.
            //
            // Do NOT inherit the parent's execArgv (which may contain debug/inspect
            // flags that would expose the host Node process to the addon), and
            // explicitly neutralise a few foot-guns.
            //
            // Inside FXServer's embedded Node runtime, process.execPath points to
            // FXServer.exe rather than node. Using it as the fork executable would
            // spawn a full FXServer instance instead of a plain Node process, causing
            // a duplicate-core boot and config-lock conflict. Detect this and fall
            // back to the system Node.js binary.
            const isFxServerRuntime = /FXServer/i.test(path.basename(process.execPath));
            // Whitelist of additional process.env keys to forward to addon child processes.
            // These are safe locale/timezone/terminal vars that addons may legitimately need.
            const envWhitelist = ['LANG', 'LC_ALL', 'LC_CTYPE', 'TZ', 'TERM'] as const;
            const whitelistedEnv = Object.fromEntries(
                envWhitelist.flatMap((key) => (process.env[key] !== undefined ? [[key, process.env[key]]] : [])),
            );
            this.child = fork(resolvedEntry, [], {
                cwd: this.addonDir,
                ...(isFxServerRuntime && { execPath: 'node' }),
                env: {
                    ...whitelistedEnv,
                    PATH: process.env.PATH,
                    HOME: process.env.HOME,
                    NODE_ENV: process.env.NODE_ENV,
                    ADDON_ID: this.addonId,
                    NODE_PATH: this.nodeModulesDir,
                },
                execArgv: [
                    // Throw on __proto__ writes to reduce prototype-pollution blast radius.
                    '--disable-proto=throw',
                ],
                stdio: ['pipe', 'pipe', 'pipe', 'ipc'],
                serialization: 'json',
            });

            // Capture stdout/stderr
            this.child.stdout?.on('data', (data: Buffer) => {
                console.log(`${this.logPrefix} ${data.toString().trimEnd()}`);
            });
            this.child.stderr?.on('data', (data: Buffer) => {
                console.error(`${this.logPrefix} ${data.toString().trimEnd()}`);
            });

            // Handle IPC messages
            this.child.on('message', (msg: AddonToCoreMessage) => {
                this.handleMessage(msg);
            });

            // Handle unexpected exits
            this.child.on('exit', (code, signal) => {
                if (this.state === 'running') {
                    console.error(`${this.logPrefix} Process crashed (code=${code}, signal=${signal})`);
                    this.state = 'crashed';
                    this.crashCount++;
                    this.onCrash?.(this.addonId);
                } else if (this.state !== 'stopped' && this.state !== 'stopping') {
                    this.state = 'failed';
                }
                this.child = null;
                this.rejectAllPending(new Error('Addon process exited'));
            });

            this.child.on('error', (err) => {
                console.error(`${this.logPrefix} Process error: ${err.message}`);
                if (this.state === 'starting') {
                    this.state = 'failed';
                }
            });

            // Send init message
            this.send({
                type: 'init',
                payload: {
                    addonId: this.addonId,
                    permissions: this.permissions,
                },
            });

            // Wait for ready signal
            const readyResult = await this.waitForReady(timeoutMs);
            if (!readyResult.success) {
                await this.kill();
                this.state = 'failed';
                return readyResult;
            }

            this.state = 'running';
            this.startedAt = Date.now();
            this.startupDurationMs = performance.now() - startTime;
            return { success: true };
        } catch (error) {
            this.state = 'failed';
            return { success: false, error: `Failed to spawn: ${(error as Error).message}` };
        }
    }

    /**
     * Wait for the addon to send a "ready" message.
     */
    private waitForReady(timeoutMs: number): Promise<{ success: boolean; error?: string }> {
        return new Promise((resolve) => {
            const timer = setTimeout(() => {
                resolve({ success: false, error: `Addon did not send ready signal within ${timeoutMs}ms` });
            }, timeoutMs);

            // Store as a special pending request
            this.pendingRequests.set('__ready__', {
                resolve: (value) => {
                    clearTimeout(timer);
                    const msg = value as AddonToCoreMessage;
                    if (msg.type === 'ready') {
                        this.routes = (msg.payload as { routes: AddonRouteDescriptor[] }).routes || [];
                        resolve({ success: true });
                    }
                },
                reject: (err) => {
                    clearTimeout(timer);
                    resolve({ success: false, error: err.message });
                },
                timer,
            });
        });
    }

    /**
     * Send an HTTP request to the addon and wait for the response.
     */
    async handleHttpRequest(opts: {
        method: string;
        path: string;
        headers: Record<string, string>;
        body: unknown;
        admin: { name: string; permissions: string[] };
    }): Promise<{ status: number; headers?: Record<string, string>; body: unknown }> {
        if (this.state !== 'running') {
            return { status: 503, body: { error: 'Addon is not running' } };
        }

        const id = randomUUID();

        const response = await this.sendRequest<{ status: number; headers?: Record<string, string>; body: unknown }>(
            {
                type: 'http-request',
                id,
                payload: opts,
            },
            id,
            IPC_TIMEOUT_MS,
        );

        return response;
    }

    /**
     * Send a public (unauthenticated) HTTP request to the addon and wait for the response.
     */
    async handlePublicRequest(opts: {
        method: string;
        path: string;
        headers: Record<string, string>;
        body: unknown;
    }): Promise<{ status: number; headers?: Record<string, string>; body: unknown }> {
        if (this.state !== 'running') {
            return { status: 503, body: { error: 'Addon is not running' } };
        }

        const id = randomUUID();

        const response = await this.sendRequest<{ status: number; headers?: Record<string, string>; body: unknown }>(
            {
                type: 'public-request',
                id,
                payload: opts,
            },
            id,
            IPC_TIMEOUT_MS,
        );

        return response;
    }

    /**
     * Send an event to the addon (fire-and-forget).
     */
    sendEvent(event: string, data: unknown): void {
        if (this.state !== 'running') return;
        this.send({
            type: 'event',
            payload: { event, data },
        });
    }

    /**
     * Graceful shutdown.
     */
    async stop(): Promise<void> {
        if (this.state === 'stopped' || this.state === 'stopping') return;
        this.state = 'stopping';

        // If child is already dead, just clean up state
        if (!this.child) {
            this.state = 'stopped';
            this.rejectAllPending(new Error('Addon process already exited'));
            return;
        }

        // Send shutdown signal
        try {
            this.send({ type: 'shutdown', payload: {} });
        } catch {
            // IPC channel may already be closed if the process crashed
        }

        // Wait for graceful exit
        await new Promise<void>((resolve) => {
            const timer = setTimeout(async () => {
                console.warn(`${this.logPrefix} Shutdown timed out, killing process`);
                await this.kill();
                resolve();
            }, SHUTDOWN_TIMEOUT_MS);

            if (this.child) {
                this.child.once('exit', () => {
                    clearTimeout(timer);
                    resolve();
                });
            } else {
                clearTimeout(timer);
                resolve();
            }
        });

        this.state = 'stopped';
        this.child = null;
    }

    /**
     * Force kill the child process.
     */
    private async kill(): Promise<void> {
        if (this.child) {
            this.child.kill('SIGKILL');
            this.child = null;
        }
    }

    /**
     * Handle incoming IPC messages from the addon.
     */
    private handleMessage(msg: AddonToCoreMessage): void {
        switch (msg.type) {
            case 'ready': {
                const pending = this.pendingRequests.get('__ready__');
                if (pending) {
                    this.pendingRequests.delete('__ready__');
                    pending.resolve(msg);
                }
                break;
            }
            case 'http-response': {
                const pending = this.pendingRequests.get(msg.id);
                if (pending) {
                    this.pendingRequests.delete(msg.id);
                    clearTimeout(pending.timer);
                    // Sanitize response - strip dangerous headers (case-insensitive)
                    const headers: Record<string, string> = {};
                    for (const [key, value] of Object.entries(msg.payload.headers || {})) {
                        if (key.toLowerCase() !== 'set-cookie') {
                            headers[key] = value as string;
                        }
                    }
                    pending.resolve({
                        status: msg.payload.status,
                        headers,
                        body: msg.payload.body,
                    });
                }
                break;
            }
            case 'storage-request': {
                this.handleStorageRequest(msg.id, msg.payload as {
                    op: 'get' | 'set' | 'delete' | 'list';
                    key?: string;
                    value?: unknown;
                });
                break;
            }
            case 'ws-push': {
                const payload = msg.payload as { event: string; data: unknown };
                if (this.permissions.includes('ws.push')) {
                    this.onWsPush(this.addonId, payload.event, payload.data);
                } else {
                    console.warn(`${this.logPrefix} Attempted ws.push without permission`);
                }
                break;
            }
            case 'log': {
                const { level, message } = msg.payload as { level: 'info' | 'warn' | 'error'; message: string };
                const truncatedMsg = message.length > 2000 ? message.slice(0, 2000) + '...' : message;
                console[level](`${this.logPrefix} ${truncatedMsg}`);
                this.logs.push({ timestamp: Date.now(), level, message: truncatedMsg });
                if (this.logs.length > MAX_LOG_ENTRIES) this.logs.shift();
                break;
            }
            case 'api-call': {
                this.handleApiCall(
                    msg.id,
                    msg.payload as { method: string; args: unknown[] },
                );
                break;
            }
            case 'error': {
                const { message, stack } = msg.payload as { message: string; stack?: string };
                console.error(`${this.logPrefix} Error: ${message}`);
                if (stack) console.error(`${this.logPrefix} ${stack}`);
                break;
            }
            default: {
                console.warn(`${this.logPrefix} Unknown message type: ${(msg as any).type}`);
            }
        }
    }

    /**
     * Handle addon API calls (e.g. players.addTag, players.removeTag).
     */
    private handleApiCall(id: string, payload: { method: string; args: unknown[] }): void {
        const respond = (data: unknown, error?: string) => {
            this.send({ type: 'api-call-response', id, payload: { data, error } });
        };

        try {
            const { method, args } = payload;

            if (method === 'players.addTag' || method === 'players.removeTag') {
                if (!this.permissions.includes('players.write')) {
                    respond(null, 'players.write permission not granted');
                    return;
                }

                const [netid, tagId] = args;
                if (typeof netid !== 'number' || typeof tagId !== 'string') {
                    respond(null, 'invalid arguments: netid must be number, tagId must be string');
                    return;
                }

                const validIds = new Set((txConfig.gameFeatures.customTags ?? []).map((t: any) => t.id));
                if (!validIds.has(tagId)) {
                    respond(null, `unknown custom tag id: ${tagId}`);
                    return;
                }

                const player = txCore.fxPlayerlist.getPlayerById(netid);
                if (!(player instanceof ServerPlayer) || !player.isRegistered) {
                    respond(null, `player netid ${netid} not found or not registered`);
                    return;
                }

                const isAddTagAction = method === 'players.addTag';
                player.setCustomTag(tagId, isAddTagAction);
                console.info(
                    `${isAddTagAction ? 'Added' : 'Removed'} tag '${tagId}' via addon API (addonId: ${this.addonId}, player: ${player.netid})`,
                );
                respond(true);
            } else {
                respond(null, `unknown API method: ${method}`);
            }
        } catch (error) {
            const errorMessage =
                (error instanceof Error ? error.message || error.name : String(error)) || 'Unknown error';
            respond(null, errorMessage);
        }
    }

    /**
     * Handle addon storage requests.
     */
    private handleStorageRequest(id: string, payload: { op: string; key?: string; value?: unknown }): void {
        if (!this.permissions.includes('storage')) {
            this.send({
                type: 'storage-response',
                id,
                payload: { data: null, error: 'Storage permission not granted' },
            });
            return;
        }

        try {
            let result: unknown;
            switch (payload.op) {
                case 'get':
                    if (!payload.key) {
                        this.send({ type: 'storage-response', id, payload: { data: null, error: 'Missing key for get operation' } });
                        return;
                    }
                    result = this.storage.get(payload.key);
                    break;
                case 'set': {
                    if (!payload.key) {
                        this.send({ type: 'storage-response', id, payload: { data: null, error: 'Missing key for set operation' } });
                        return;
                    }
                    const setResult = this.storage.set(payload.key, payload.value);
                    if (!setResult.success) {
                        this.send({ type: 'storage-response', id, payload: { data: null, error: setResult.error } });
                        return;
                    }
                    result = true;
                    break;
                }
                case 'delete':
                    if (!payload.key) {
                        this.send({ type: 'storage-response', id, payload: { data: null, error: 'Missing key for delete operation' } });
                        return;
                    }
                    this.storage.delete(payload.key);
                    result = true;
                    break;
                case 'list':
                    result = this.storage.list(payload.key);
                    break;
                default:
                    this.send({
                        type: 'storage-response',
                        id,
                        payload: { data: null, error: `Unknown storage op: ${payload.op}` },
                    });
                    return;
            }
            this.send({ type: 'storage-response', id, payload: { data: result } });
        } catch (error) {
            this.send({
                type: 'storage-response',
                id,
                payload: { data: null, error: (error as Error).message },
            });
        }
    }

    /**
     * Send an IPC message and wait for a response with the given correlation ID.
     */
    private sendRequest<T>(message: CoreToAddonMessage, id: string, timeoutMs: number): Promise<T> {
        return new Promise((resolve, reject) => {
            const timer = setTimeout(() => {
                this.pendingRequests.delete(id);
                reject(new Error(`IPC request timed out after ${timeoutMs}ms`));
            }, timeoutMs);

            this.pendingRequests.set(id, {
                resolve: resolve as (value: unknown) => void,
                reject,
                timer,
            });

            this.send(message);
        });
    }

    /**
     * Send a raw IPC message to the child process.
     */
    private send(message: CoreToAddonMessage): void {
        if (!this.child || !this.child.connected) return;
        try {
            this.child.send(message);
        } catch (error) {
            console.error(`${this.logPrefix} Failed to send IPC message: ${(error as Error).message}`);
        }
    }

    /**
     * Reject all pending requests (e.g. on process exit).
     */
    private rejectAllPending(error: Error): void {
        for (const [id, pending] of this.pendingRequests) {
            clearTimeout(pending.timer);
            pending.reject(error);
        }
        this.pendingRequests.clear();
    }
}
