const modulename = 'AddonManager';
import fs from 'node:fs';
import path from 'node:path';
import { z } from 'zod';
import semver from 'semver';

import consoleFactory from '@lib/console';
import { txEnv } from '@core/globalData';
import { SYM_SYSTEM_AUTHOR } from '@lib/symbols';
import AddonStorage from './addonStorage';
import AddonProcess from './addonProcess';
import AddonFileWatcher from './addonFileWatcher';
import AddonPublicServer from './addonPublicServer';
import { topologicalSort as topoSort, getMissingDependencies as getMissingDeps } from './addonUtils';
import {
    AddonManifestSchema,
    AddonConfigSchema,
    AddonState,
    AddonPanelDescriptor,
    AddonNuiDescriptor,
    AddonListItem,
    type AddonManifest,
    type AddonConfig,
} from '@shared/addonTypes';
const console = consoleFactory(modulename);

/**
 * Internal tracked addon info.
 */
interface AddonDescriptor {
    manifest: AddonManifest;
    dir: string;
    state: AddonState;
    process: AddonProcess | null;
    grantedPermissions: string[];
}

const CONFIG_FILE = 'addon-config.json';
const ADDONS_DIR = 'addons';
const ADDON_DATA_DIR = 'addon-data';

/**
 * AddonManager — Discovers, validates, and manages addons.
 * 
 * Conforms to the GenericTxModule interface. Registered as a module in txAdmin boot.
 */
export default class AddonManager {
    public readonly timers: NodeJS.Timer[] = [];
    private config: AddonConfig;
    private readonly addons = new Map<string, AddonDescriptor>();
    private readonly storage: AddonStorage;
    private readonly addonsDir: string;
    private readonly configPath: string;
    private fileWatcher: AddonFileWatcher | null = null;
    private publicServer: AddonPublicServer | null = null;
    private readonly crashRestartTimers = new Map<string, ReturnType<typeof setTimeout>>();

    constructor() {
        // Resolve paths
        this.addonsDir = path.join(txEnv.txaPath, ADDONS_DIR);
        this.configPath = txEnv.profileSubPath(CONFIG_FILE);
        const dataDir = txEnv.profileSubPath(ADDON_DATA_DIR);

        // Load config
        this.config = this.loadConfig();

        // Init storage
        this.storage = new AddonStorage(dataDir, this.config.maxStorageMb);

        // Early exit if system is disabled
        if (!this.config.enabled) {
            console.log('Addon system is disabled');
            return;
        }

        // Ensure addons directory exists
        if (!fs.existsSync(this.addonsDir)) {
            fs.mkdirSync(this.addonsDir, { recursive: true });
            console.log(`Created addons directory at ${this.addonsDir}`);
        }

        // Boot sequence (async, non-blocking)
        this.boot().catch((err) => {
            console.error(`Addon boot failed: ${(err as Error).message}`);
        });
    }

    /**
     * Load addon-config.json or create defaults.
     */
    private loadConfig(): AddonConfig {
        try {
            if (fs.existsSync(this.configPath)) {
                const raw = JSON.parse(fs.readFileSync(this.configPath, 'utf-8'));
                return AddonConfigSchema.parse(raw);
            }
        } catch (error) {
            console.warn(`Failed to load addon config, using defaults: ${(error as Error).message}`);
        }

        const defaults = AddonConfigSchema.parse({});
        this.saveConfig(defaults);
        return defaults;
    }

    /**
     * Persist addon-config.json to disk.
     */
    private saveConfig(config: AddonConfig): void {
        try {
            fs.writeFileSync(this.configPath, JSON.stringify(config, null, 2), 'utf-8');
        } catch (error) {
            console.error(`Failed to save addon config: ${(error as Error).message}`);
        }
    }

    /**
     * Full boot sequence.
     */
    private async boot(): Promise<void> {
        // 1. Discover and validate
        this.discover();

        // 2. Check permissions (approval)
        this.checkPermissions();

        // 3. Start addon processes
        await this.startProcesses();

        // 4. Start file watcher for hot-reload
        this.fileWatcher = new AddonFileWatcher(this.addonsDir, (dirName, nuiOnly) => {
            const addonId = this.resolveAddonIdFromDir(dirName);
            if (nuiOnly) {
                // Only NUI/panel static files changed — no need to restart addon process
                const addon = addonId ? this.addons.get(addonId) : undefined;
                if (addon?.state === 'running' && addon.manifest.nui) {
                    console.log(`NUI-only change in addon "${addonId}", refreshing monitor resource...`);
                    this.ensureMonitorResource();
                    this.broadcastReloadEvent(addonId!, 'reloaded');
                }
                return;
            }
            // For full reloads, use the addon ID if known, otherwise pass the dir name
            // so reloadAddon can discover the addon from the directory
            const reloadId = addonId ?? dirName;
            this.reloadAddon(reloadId).catch((err) => {
                console.error(`Hot-reload failed for ${reloadId}: ${(err as Error).message}`);
            });
        });

        // 5. Register panel/NUI extensions (done passively via getters)
        const running = [...this.addons.values()].filter(a => a.state === 'running').length;
        const total = this.addons.size;
        console.log(`Addon system ready: ${running}/${total} addons running`);

        // 6. Start public server if any addon has publicRoutes
        await this.maybeStartPublicServer();
    }

    /**
     * Step 1: Scan addons/ directory, read & validate each addon.json
     */
    private discover(): void {
        if (!fs.existsSync(this.addonsDir)) return;

        let entries: string[];
        try {
            entries = fs.readdirSync(this.addonsDir);
        } catch (error) {
            console.error(`Failed to scan addons directory: ${(error as Error).message}`);
            return;
        }

        for (const entry of entries) {
            const addonDir = path.join(this.addonsDir, entry);

            // Must be a directory
            if (!fs.statSync(addonDir).isDirectory()) continue;

            // Must have addon.json
            const manifestPath = path.join(addonDir, 'addon.json');
            if (!fs.existsSync(manifestPath)) {
                console.verbose.warn(`Skipping ${entry}: no addon.json`);
                continue;
            }

            // Enforce max addons limit
            if (this.addons.size >= this.config.maxAddons) {
                console.warn(`Max addon limit reached (${this.config.maxAddons}), skipping ${entry}`);
                break;
            }

            // Parse and validate manifest
            try {
                const raw = JSON.parse(fs.readFileSync(manifestPath, 'utf-8'));
                const manifest = AddonManifestSchema.parse(raw);

                // Check for duplicate IDs (different folder, same manifest ID)
                if (this.addons.has(manifest.id)) {
                    console.warn(`Addon ${entry}: duplicate manifest id "${manifest.id}" (already loaded from another folder), skipping`);
                    continue;
                }

                // Check version compatibility
                if (!this.checkVersionCompat(manifest)) {
                    continue;
                }

                // Check if explicitly disabled
                if (this.config.disabled.includes(manifest.id)) {
                    console.log(`Addon ${manifest.id} is explicitly disabled`);
                    this.addons.set(manifest.id, {
                        manifest,
                        dir: addonDir,
                        state: 'stopped',
                        process: null,
                        grantedPermissions: [],
                    });
                    continue;
                }

                // Validated paths within addon dir — prevent path traversal
                if (manifest.server?.entry) {
                    const resolved = path.resolve(addonDir, manifest.server.entry);
                    if (!resolved.startsWith(path.resolve(addonDir))) {
                        console.warn(`Addon ${manifest.id}: server entry path escapes addon directory, skipping`);
                        continue;
                    }
                }

                this.addons.set(manifest.id, {
                    manifest,
                    dir: addonDir,
                    state: 'discovered',
                    process: null,
                    grantedPermissions: [],
                });

                console.log(`Discovered addon: ${manifest.name} v${manifest.version} by ${manifest.author}`);
            } catch (error) {
                if (error instanceof z.ZodError) {
                    const issues = error.issues.map(i => `  - ${i.path.join('.')}: ${i.message}`).join('\n');
                    console.warn(`Addon ${entry}: invalid manifest:\n${issues}`);
                } else {
                    console.warn(`Addon ${entry}: failed to parse addon.json: ${(error as Error).message}`);
                }
            }
        }

        console.log(`Discovered ${this.addons.size} addon(s)`);
    }

    /**
     * Check if the addon is compatible with the current fxPanel version.
     */
    private checkVersionCompat(manifest: AddonManifest): boolean {
        const currentVersion = txEnv.txaVersion;

        // Check minVersion
        if (manifest.fxpanel.minVersion) {
            try {
                if (semver.valid(currentVersion) && semver.valid(manifest.fxpanel.minVersion)) {
                    if (semver.lt(currentVersion, manifest.fxpanel.minVersion)) {
                        console.warn(
                            `Addon ${manifest.id}: requires fxPanel >= ${manifest.fxpanel.minVersion}, ` +
                            `current is ${currentVersion}, skipping`
                        );
                        return false;
                    }
                }
            } catch {
                // If semver parsing fails, skip compatibility check
                console.verbose.warn(`Addon ${manifest.id}: could not parse version for compatibility check`);
            }
        }

        // Check maxVersion
        if (manifest.fxpanel.maxVersion) {
            try {
                if (semver.valid(currentVersion) && semver.validRange(manifest.fxpanel.maxVersion)) {
                    if (!semver.satisfies(currentVersion, `<=${manifest.fxpanel.maxVersion}`)) {
                        console.warn(
                            `Addon ${manifest.id}: max version ${manifest.fxpanel.maxVersion}, ` +
                            `current is ${currentVersion}, skipping`
                        );
                        return false;
                    }
                }
            } catch {
                console.verbose.warn(`Addon ${manifest.id}: could not parse maxVersion`);
            }
        }

        return true;
    }

    /**
     * Step 2: Check permissions against approved list.
     */
    private checkPermissions(): void {
        for (const [id, addon] of this.addons) {
            if (addon.state !== 'discovered') continue;

            const approval = this.config.approved[id];
            if (!approval) {
                console.warn(`Addon ${id}: not approved, skipping (approve via Settings → Addons tab)`);
                addon.state = 'discovered'; // stays as discovered, pending approval
                continue;
            }

            // Check that all required permissions are granted
            const missingRequired = addon.manifest.permissions.required.filter(
                p => !approval.granted.includes(p)
            );
            if (missingRequired.length > 0) {
                console.warn(
                    `Addon ${id}: missing required permissions: ${missingRequired.join(', ')}. ` +
                    `Re-approve addon to grant them.`
                );
                addon.state = 'discovered';
                continue;
            }

            // Set granted permissions (required + approved optional)
            addon.grantedPermissions = approval.granted;
            addon.state = 'approved';
            console.log(`Addon ${id}: approved with permissions [${approval.granted.join(', ')}]`);
        }
    }

    /**
     * Step 3: Start all approved addons that have server entries.
     * Addons are started in dependency order — dependencies first.
     */
    private async startProcesses(): Promise<void> {
        const approvedAddons = [...this.addons.values()].filter(a => a.state === 'approved');
        const sorted = this.topologicalSort(approvedAddons);

        for (const addon of sorted) {
            // Check dependencies are running
            const missingDeps = this.getMissingDependencies(addon);
            if (missingDeps.length > 0) {
                addon.state = 'failed';
                console.error(`Addon ${addon.manifest.id}: missing dependencies: ${missingDeps.join(', ')}`);
                continue;
            }

            if (!addon.manifest.server) {
                // No server process needed — just mark as running
                addon.state = 'running';
                this.registerAddonPerms(addon);
                continue;
            }

            addon.process = new AddonProcess({
                addonId: addon.manifest.id,
                entryPath: addon.manifest.server.entry,
                addonDir: addon.dir,
                permissions: addon.grantedPermissions,
                storage: this.storage.getScope(addon.manifest.id),
                onWsPush: this.handleWsPush.bind(this),
                onCrash: this.handleAddonCrash.bind(this),
            });

            const result = await addon.process.start(this.config.processTimeoutMs);
            if (result.success) {
                addon.state = 'running';
                this.registerAddonPerms(addon);
                console.log(`Addon ${addon.manifest.id}: process started successfully`);
            } else {
                addon.state = 'failed';
                addon.process = null;
                console.error(`Addon ${addon.manifest.id}: failed to start — ${result.error}`);
            }
        }
    }

    /**
     * Handle addon crash — schedule restart with exponential backoff.
     * Delays: 5s, 15s, 45s; gives up after 3 attempts.
     */
    private handleAddonCrash(addonId: string): void {
        const addon = this.addons.get(addonId);
        if (!addon?.process) return;

        const attempts = addon.process.crashCount;
        const MAX_CRASH_RESTARTS = 3;
        if (attempts > MAX_CRASH_RESTARTS) {
            console.error(`Addon ${addonId}: exceeded ${MAX_CRASH_RESTARTS} crash restarts, giving up`);
            return;
        }

        const delayMs = 5_000 * Math.pow(3, attempts - 1); // 5s, 15s, 45s
        console.warn(`Addon ${addonId}: scheduling restart attempt ${attempts}/${MAX_CRASH_RESTARTS} in ${delayMs / 1000}s`);

        // Clear any existing restart timer for this addon
        const existing = this.crashRestartTimers.get(addonId);
        if (existing) clearTimeout(existing);

        const timer = setTimeout(async () => {
            this.crashRestartTimers.delete(addonId);
            const current = this.addons.get(addonId);
            if (!current || current.state !== 'crashed') return;

            console.log(`Addon ${addonId}: attempting crash restart (attempt ${attempts}/${MAX_CRASH_RESTARTS})`);
            try {
                const result = await this.reloadAddon(addonId);
                if (result.success) {
                    console.log(`Addon ${addonId}: crash restart succeeded`);
                } else {
                    console.error(`Addon ${addonId}: crash restart failed: ${result.error}`);
                }
            } catch (error) {
                console.error(`Addon ${addonId}: crash restart threw: ${(error as Error).message}`);
            }
        }, delayMs);

        this.crashRestartTimers.set(addonId, timer);
    }

    /**
     * Handle WebSocket push from an addon process (routed through Socket.io).
     */
    private handleWsPush(addonId: string, event: string, data: unknown): void {
        try {
            const roomName = `addon:${addonId}`;
            txCore.webServer.webSocket.pushToRoom(roomName, `addon:${addonId}:${event}`, data);
        } catch (error) {
            console.error(`Failed to push WS event for addon ${addonId}: ${(error as Error).message}`);
        }
    }

    //============================================
    // Public API
    //============================================

    /**
     * Get addon descriptor by ID.
     */
    getAddon(addonId: string): AddonDescriptor | undefined {
        return this.addons.get(addonId);
    }

    /**
     * Get all addon descriptors.
     */
    getAllAddons(): AddonDescriptor[] {
        return [...this.addons.values()];
    }

    /**
     * Get the list of addons for the settings UI.
     */
    getAddonList(): AddonListItem[] {
        return [...this.addons.values()].map(addon => ({
            id: addon.manifest.id,
            name: addon.manifest.name,
            description: addon.manifest.description,
            version: addon.manifest.version,
            author: addon.manifest.author,
            state: addon.state,
            needsReapproval: addon.state === 'discovered' && !!this.config.approved[addon.manifest.id],
            hasSettings: !!addon.manifest.panel?.settingsComponent,
            dependencies: addon.manifest.dependencies,
            permissions: {
                required: addon.manifest.permissions.required,
                optional: addon.manifest.permissions.optional,
                granted: addon.grantedPermissions,
            },
        }));
    }

    /**
     * Get the number of addons awaiting approval or re-approval.
     */
    getPendingApprovalCount(): number {
        return [...this.addons.values()].filter(a => a.state === 'discovered').length;
    }

    /**
     * Get log entries for a specific addon.
     */
    getAddonLogs(addonId: string): import('./addonProcess').AddonLogEntry[] {
        const addon = this.addons.get(addonId);
        if (!addon?.process) return [];
        return [...addon.process.logs];
    }

    /**
     * Get panel manifest for the frontend loader.
     */
    getPanelManifest(): AddonPanelDescriptor[] {
        const result: AddonPanelDescriptor[] = [];
        for (const addon of this.addons.values()) {
            if (addon.state !== 'running' || !addon.manifest.panel) continue;

            result.push({
                id: addon.manifest.id,
                name: addon.manifest.name,
                version: addon.manifest.version,
                entryUrl: `/addons/${addon.manifest.id}/panel/${path.basename(addon.manifest.panel.entry)}`,
                stylesUrl: addon.manifest.panel.styles
                    ? `/addons/${addon.manifest.id}/panel/${path.basename(addon.manifest.panel.styles)}`
                    : null,
                pages: addon.manifest.panel.pages,
                widgets: addon.manifest.panel.widgets,
                settingsComponent: addon.manifest.panel.settingsComponent ?? null,
            });
        }
        return result;
    }

    /**
     * Get NUI manifest.
     */
    getNuiManifest(): AddonNuiDescriptor[] {
        const result: AddonNuiDescriptor[] = [];
        for (const addon of this.addons.values()) {
            if (addon.state !== 'running' || !addon.manifest.nui) continue;

            result.push({
                id: addon.manifest.id,
                name: addon.manifest.name,
                version: addon.manifest.version,
                entryUrl: `/nui/addons/${addon.manifest.id}/${path.basename(addon.manifest.nui.entry)}`,
                stylesUrl: addon.manifest.nui.styles
                    ? `/nui/addons/${addon.manifest.id}/${path.basename(addon.manifest.nui.styles)}`
                    : null,
                pages: addon.manifest.nui.pages,
            });
        }
        return result;
    }

    /**
     * Get the addon process for HTTP request proxying.
     */
    getProcess(addonId: string): AddonProcess | null {
        return this.addons.get(addonId)?.process ?? null;
    }

    /**
     * Check if an addon is running.
     */
    isRunning(addonId: string): boolean {
        return this.addons.get(addonId)?.state === 'running';
    }

    /**
     * Check if an addon has publicRoutes enabled in its manifest.
     */
    hasPublicRoutes(addonId: string): boolean {
        const addon = this.addons.get(addonId);
        return !!addon && addon.state === 'running' && addon.manifest.publicRoutes === true;
    }

    /**
     * Approve an addon with specific permissions.
     * Saves config then triggers a reload to start the addon immediately.
     */
    async approveAddon(addonId: string, grantedPermissions: string[], approvedBy: string): Promise<{ success: boolean; error?: string }> {
        const addon = this.addons.get(addonId);
        if (!addon) return { success: false, error: 'Addon not found' };

        // Verify all required permissions are granted
        const missingRequired = addon.manifest.permissions.required.filter(
            p => !grantedPermissions.includes(p)
        );
        if (missingRequired.length > 0) {
            return {
                success: false,
                error: `Missing required permissions: ${missingRequired.join(', ')}`,
            };
        }

        // Update config
        this.config.approved[addonId] = {
            granted: grantedPermissions,
            approvedAt: new Date().toISOString(),
            approvedBy,
        };

        // Remove from disabled list if present
        this.config.disabled = this.config.disabled.filter(id => id !== addonId);

        this.saveConfig(this.config);

        // Hot-reload to start the addon immediately
        return this.reloadAddon(addonId);
    }

    /**
     * Revoke addon approval.
     * Stops the addon process then removes approval from config.
     */
    async revokeAddon(addonId: string): Promise<{ success: boolean; error?: string }> {
        const addon = this.addons.get(addonId);
        if (!addon) return { success: false, error: 'Addon not found' };

        // Stop the process if running
        if (addon.process && (addon.state === 'running' || addon.state === 'starting')) {
            try {
                await addon.process.stop();
            } catch (err) {
                console.warn(`Failed to stop addon ${addonId} during revoke: ${(err as Error).message}`);
            }
            addon.process = null;
        }
        addon.state = 'discovered';
        addon.grantedPermissions = [];

        txCore.adminStore.unregisterAddonPermissions(addonId);
        await this.maybeStopPublicServer();

        delete this.config.approved[addonId];
        this.saveConfig(this.config);
        this.broadcastReloadEvent(addonId, 'reloaded');
        return { success: true };
    }

    /**
     * Disable/enable an addon.
     */
    setAddonDisabled(addonId: string, disabled: boolean): { success: boolean; error?: string } {
        const addon = this.addons.get(addonId);
        if (!addon) return { success: false, error: 'Addon not found' };

        if (disabled && !this.config.disabled.includes(addonId)) {
            this.config.disabled.push(addonId);
        } else if (!disabled) {
            this.config.disabled = this.config.disabled.filter(id => id !== addonId);
        }

        this.saveConfig(this.config);
        return { success: true };
    }

    /**
     * Stop a running addon's process without revoking approval.
     */
    async stopAddon(addonId: string): Promise<{ success: boolean; error?: string }> {
        const addon = this.addons.get(addonId);
        if (!addon) return { success: false, error: 'Addon not found' };

        if (addon.state !== 'running' && addon.state !== 'starting') {
            return { success: false, error: `Addon is not running (state: ${addon.state})` };
        }

        // Cancel any pending crash-restart timer
        const crashTimer = this.crashRestartTimers.get(addonId);
        if (crashTimer) {
            clearTimeout(crashTimer);
            this.crashRestartTimers.delete(addonId);
        }

        if (addon.process) {
            try {
                await addon.process.stop();
            } catch (err) {
                console.warn(`Error stopping addon ${addonId}: ${(err as Error).message}`);
            }
            addon.process = null;
        }

        addon.state = 'stopped';
        this.setAddonDisabled(addonId, true);
        txCore.adminStore.unregisterAddonPermissions(addonId);
        await this.maybeStopPublicServer();
        this.broadcastReloadEvent(addonId, 'reloaded');
        console.log(`Addon ${addonId} stopped`);
        return { success: true };
    }

    /**
     * Start a stopped/approved addon.
     */
    async startAddon(addonId: string): Promise<{ success: boolean; error?: string }> {
        const addon = this.addons.get(addonId);
        if (!addon) return { success: false, error: 'Addon not found' };

        if (addon.state === 'running' || addon.state === 'starting') {
            return { success: false, error: 'Addon is already running' };
        }

        // Must be approved
        const approval = this.config.approved[addonId];
        if (!approval) {
            return { success: false, error: 'Addon is not approved' };
        }

        // Remove from disabled list
        this.setAddonDisabled(addonId, false);

        // Check dependencies
        const missingDeps = this.getMissingDependencies(addon);
        if (missingDeps.length > 0) {
            addon.state = 'failed';
            const msg = `Missing dependencies: ${missingDeps.join(', ')}`;
            console.error(`Addon ${addonId}: ${msg}`);
            this.broadcastReloadEvent(addonId, 'reloaded');
            return { success: false, error: msg };
        }

        // No server entry — just mark running
        if (!addon.manifest.server) {
            addon.state = 'running';
            addon.grantedPermissions = approval.granted;
            this.registerAddonPerms(addon);
            this.broadcastReloadEvent(addonId, 'reloaded');
            console.log(`Addon ${addonId} started (no server process)`);
            return { success: true };
        }

        addon.grantedPermissions = approval.granted;
        addon.process = new AddonProcess({
            addonId: addon.manifest.id,
            entryPath: addon.manifest.server.entry,
            addonDir: addon.dir,
            permissions: addon.grantedPermissions,
            storage: this.storage.getScope(addon.manifest.id),
            onWsPush: this.handleWsPush.bind(this),
            onCrash: this.handleAddonCrash.bind(this),
        });

        const result = await addon.process.start(this.config.processTimeoutMs);
        if (result.success) {
            addon.state = 'running';
            this.registerAddonPerms(addon);
            await this.maybeStartPublicServer();
            console.log(`Addon ${addonId} started`);
            this.broadcastReloadEvent(addonId, 'reloaded');
            return { success: true };
        } else {
            addon.state = 'failed';
            addon.process = null;
            console.error(`Addon ${addonId} failed to start: ${result.error}`);
            this.broadcastReloadEvent(addonId, 'reloaded');
            return { success: false, error: result.error };
        }
    }

    /**
     * Resolve a panel static file path for serving.
     * Returns the absolute path if valid, or null if invalid.
     */
    resolveAddonStaticPath(addonId: string, layer: 'panel' | 'nui' | 'static', filePath: string): string | null {
        const addon = this.addons.get(addonId);
        if (!addon) return null;

        // Resolve and validate path is within addon's layer directory
        const layerDir = path.join(addon.dir, layer);
        const resolved = path.resolve(layerDir, filePath);

        if (!resolved.startsWith(path.resolve(layerDir))) {
            return null; // Path traversal attempt
        }

        if (!fs.existsSync(resolved)) {
            return null;
        }

        return resolved;
    }

    /**
     * Broadcast an event to all running addon processes.
     */
    broadcastEvent(event: string, data: unknown): void {
        for (const addon of this.addons.values()) {
            if (addon.state === 'running' && addon.process) {
                addon.process.sendEvent(event, data);
            }
        }
    }

    /**
     * Get addon system config.
     */
    getConfig(): AddonConfig {
        return { ...this.config };
    }

    /**
     * Update global addon config settings.
     */
    updateConfig(updates: Partial<Pick<AddonConfig, 'enabled' | 'maxAddons' | 'maxStorageMb' | 'processTimeoutMs'>>): void {
        Object.assign(this.config, updates);
        this.saveConfig(this.config);
    }

    //============================================
    // Hot-Reload
    //============================================

    /**
     * Check which dependencies of an addon are not in 'running' state.
     */
    private getMissingDependencies(addon: AddonDescriptor): string[] {
        const runningIds = new Set<string>();
        for (const [id, a] of this.addons) {
            if (a.state === 'running') runningIds.add(id);
        }
        return getMissingDeps(addon.manifest.dependencies, runningIds);
    }

    /**
     * Topological sort of addons by dependencies (dependencies come first).
     * Addons with circular or unresolvable dependencies are placed at the end.
     */
    private topologicalSort(addons: AddonDescriptor[]): AddonDescriptor[] {
        return topoSort(addons.map(a => ({ ...a, id: a.manifest.id, dependencies: a.manifest.dependencies })))
            .map(n => addons.find(a => a.manifest.id === n.id)!);
    }

    /**
     * Register an addon's custom admin permissions with AdminStore.
     */
    private registerAddonPerms(addon: AddonDescriptor): void {
        if (addon.manifest.adminPermissions.length > 0) {
            txCore.adminStore.registerAddonPermissions(addon.manifest.id, addon.manifest.adminPermissions);
        }
    }

    /**
     * Reload a single addon: stop process → re-read manifest → re-validate → re-start → notify clients.
     * Returns a result object indicating success or failure.
     */
    async reloadAddon(addonId: string, skipEnsure = false): Promise<{ success: boolean; error?: string }> {
        console.log(`Reloading addon: ${addonId}`);

        // Clear any pending debounce timer to prevent stale reloads
        this.fileWatcher?.clearPending(addonId);

        // Cancel any pending crash-restart timer
        const crashTimer = this.crashRestartTimers.get(addonId);
        if (crashTimer) {
            clearTimeout(crashTimer);
            this.crashRestartTimers.delete(addonId);
        }

        let existing = this.addons.get(addonId);

        // If addonId isn't a known key, it might be a directory name — try to resolve
        if (!existing) {
            const resolved = this.resolveAddonIdFromDir(addonId);
            if (resolved) {
                existing = this.addons.get(resolved);
            }
        }

        // 1. Stop existing process if running
        if (existing?.process) {
            try {
                await existing.process.stop();
            } catch (err) {
                console.warn(`Failed to stop addon ${addonId} during reload: ${(err as Error).message}`);
            }
            existing.process = null;
        }

        // Unregister addon permissions (will re-register if start succeeds)
        txCore.adminStore.unregisterAddonPermissions(addonId);

        // 2. Re-read and validate the manifest
        const addonDir = existing?.dir ?? path.join(this.addonsDir, addonId);
        const manifestPath = path.join(addonDir, 'addon.json');

        if (!fs.existsSync(manifestPath)) {
            // Addon was removed — clean up
            if (existing) {
                this.addons.delete(addonId);
                this.fileWatcher?.removeAddon(addonId);
                console.log(`Addon ${addonId} removed (addon.json not found)`);
                this.broadcastReloadEvent(addonId, 'removed');
            }
            return { success: true };
        }

        let manifest: AddonManifest;
        try {
            const raw = JSON.parse(fs.readFileSync(manifestPath, 'utf-8'));
            manifest = AddonManifestSchema.parse(raw);
        } catch (error) {
            const msg = error instanceof z.ZodError
                ? error.issues.map(i => `${i.path.join('.')}: ${i.message}`).join('; ')
                : (error as Error).message;
            console.error(`Addon ${addonId}: invalid manifest on reload — ${msg}`);
            if (existing) {
                existing.state = 'invalid';
                existing.process = null;
            }
            return { success: false, error: `Invalid manifest: ${msg}` };
        }

        // 3. If manifest ID changed (or addonId was a dir name), re-key the map
        if (manifest.id !== addonId) {
            if (existing) {
                this.addons.delete(addonId);
                console.log(`Addon re-keyed: "${addonId}" → "${manifest.id}"`);
            }
            addonId = manifest.id;
        }

        // 4. Verify version compatibility
        if (!this.checkVersionCompat(manifest)) {
            if (existing) existing.state = 'invalid';
            return { success: false, error: 'Version incompatible' };
        }

        // 5. Path traversal check on server entry
        if (manifest.server?.entry) {
            const resolved = path.resolve(addonDir, manifest.server.entry);
            if (!resolved.startsWith(path.resolve(addonDir))) {
                console.warn(`Addon ${addonId}: server entry escapes addon directory on reload`);
                if (existing) existing.state = 'invalid';
                return { success: false, error: 'Server entry escapes addon directory' };
            }
        }

        // 6. Check disabled
        if (this.config.disabled.includes(addonId)) {
            this.addons.set(addonId, {
                manifest,
                dir: addonDir,
                state: 'stopped',
                process: null,
                grantedPermissions: existing?.grantedPermissions ?? [],
            });
            console.log(`Addon ${addonId} reloaded (disabled)`);
            this.broadcastReloadEvent(addonId, 'reloaded');
            return { success: true };
        }

        // 7. Check approval
        const approval = this.config.approved[addonId];
        if (!approval) {
            this.addons.set(addonId, {
                manifest,
                dir: addonDir,
                state: 'discovered',
                process: null,
                grantedPermissions: [],
            });
            console.log(`Addon ${addonId} reloaded (pending approval)`);
            this.broadcastReloadEvent(addonId, 'reloaded');
            return { success: true };
        }

        // 8. Check required permissions
        const missingRequired = manifest.permissions.required.filter(
            p => !approval.granted.includes(p)
        );
        if (missingRequired.length > 0) {
            this.addons.set(addonId, {
                manifest,
                dir: addonDir,
                state: 'discovered',
                process: null,
                grantedPermissions: [],
            });
            console.warn(`Addon ${addonId}: missing permissions on reload: ${missingRequired.join(', ')}`);
            this.broadcastReloadEvent(addonId, 'reloaded');
            return { success: true };
        }

        const grantedPermissions = approval.granted;

        // 9. Check dependencies are running
        const missingDeps = manifest.dependencies.filter(depId => {
            const dep = this.addons.get(depId);
            return !dep || dep.state !== 'running';
        });
        if (missingDeps.length > 0) {
            this.addons.set(addonId, {
                manifest,
                dir: addonDir,
                state: 'failed',
                process: null,
                grantedPermissions,
            });
            const msg = `Missing dependencies: ${missingDeps.join(', ')}`;
            console.warn(`Addon ${addonId}: ${msg}`);
            this.broadcastReloadEvent(addonId, 'reloaded');
            return { success: false, error: msg };
        }

        // 10. Start the process (if server entry exists)
        if (!manifest.server) {
            this.addons.set(addonId, {
                manifest,
                dir: addonDir,
                state: 'running',
                process: null,
                grantedPermissions,
            });
            this.registerAddonPerms(this.addons.get(addonId)!);
            console.log(`Addon ${addonId} reloaded (no server process)`);
            this.broadcastReloadEvent(addonId, 'reloaded');
            if (!skipEnsure && manifest.nui) this.ensureMonitorResource();
            return { success: true };
        }

        const addonProcess = new AddonProcess({
            addonId: manifest.id,
            entryPath: manifest.server.entry,
            addonDir,
            permissions: grantedPermissions,
            storage: this.storage.getScope(manifest.id),
            onWsPush: this.handleWsPush.bind(this),
            onCrash: this.handleAddonCrash.bind(this),
        });

        const result = await addonProcess.start(this.config.processTimeoutMs);
        if (result.success) {
            this.addons.set(addonId, {
                manifest,
                dir: addonDir,
                state: 'running',
                process: addonProcess,
                grantedPermissions,
            });
            this.registerAddonPerms(this.addons.get(addonId)!);
            console.log(`Addon ${addonId} reloaded and running`);
            this.broadcastReloadEvent(addonId, 'reloaded');
            await this.maybeStartPublicServer();
            if (!skipEnsure && manifest.nui) this.ensureMonitorResource();
            return { success: true };
        } else {
            this.addons.set(addonId, {
                manifest,
                dir: addonDir,
                state: 'failed',
                process: null,
                grantedPermissions,
            });
            console.error(`Addon ${addonId} failed to start on reload: ${result.error}`);
            this.broadcastReloadEvent(addonId, 'reloaded');
            await this.maybeStopPublicServer();
            return { success: false, error: result.error };
        }
    }

    /**
     * Reload all addons. Also picks up newly added addon directories.
     */
    async reloadAllAddons(): Promise<{ results: Record<string, { success: boolean; error?: string }> }> {
        console.log('Reloading all addons...');
        const results: Record<string, { success: boolean; error?: string }> = {};

        // Get current addon IDs + scan for new directories
        const knownIds = new Set(this.addons.keys());
        const dirEntries = fs.existsSync(this.addonsDir)
            ? fs.readdirSync(this.addonsDir).filter(e =>
                fs.statSync(path.join(this.addonsDir, e)).isDirectory())
            : [];

        // For on-disk dirs, resolve to addon ID if already known, otherwise use dir name
        // so reloadAddon can discover new addons from their directory
        const onDiskIds = dirEntries.map(dir => this.resolveAddonIdFromDir(dir) ?? dir);

        // Merge known + on-disk
        const allIds = new Set([...knownIds, ...onDiskIds]);

        for (const addonId of allIds) {
            results[addonId] = await this.reloadAddon(addonId, true);
        }

        // If any running addon has NUI content, ensure monitor once to refresh all NUI
        const hasNuiAddon = [...this.addons.values()].some(
            a => a.state === 'running' && a.manifest.nui,
        );
        if (hasNuiAddon) this.ensureMonitorResource();

        const running = [...this.addons.values()].filter(a => a.state === 'running').length;
        console.log(`Reload complete: ${running}/${this.addons.size} addons running`);
        return { results };
    }

    /**
     * Ensure (restart) the monitor resource so the NUI browser is recreated
     * with fresh addon JS/CSS. Players stay connected — only the NUI resets.
     */
    private ensureMonitorResource(): void {
        try {
            const setCmdResult = txCore.fxRunner.sendCommand(
                'set',
                ['txAdmin-luaComToken', txCore.webServer.luaComToken],
                SYM_SYSTEM_AUTHOR,
            );
            if (!setCmdResult) {
                console.warn('Failed to reset luaComToken before ensure monitor');
                return;
            }
            const ok = txCore.fxRunner.sendCommand('ensure', ['monitor'], SYM_SYSTEM_AUTHOR);
            if (ok) {
                console.log('Ensured monitor resource for NUI addon reload');
            } else {
                console.warn('Failed to ensure monitor resource (server might not be running)');
            }
        } catch (err) {
            console.warn(`ensure monitor failed: ${(err as Error).message}`);
        }
    }

    /**
     * Broadcast an addon reload event to all connected panel/NUI clients.
     */
    private broadcastReloadEvent(addonId: string, action: 'reloaded' | 'removed'): void {
        try {
            txCore.webServer.webSocket.pushEvent('addonReloaded', { addonId, action });
        } catch {
            // WebSocket might not be initialized yet during early boot
        }
    }

    /**
     * Resolve a directory name (from file watcher) to the addon ID in our Map.
     * Returns the addon ID if found, or null if no addon is loaded from that directory.
     */
    private resolveAddonIdFromDir(dirName: string): string | null {
        const dirPath = path.resolve(this.addonsDir, dirName);
        for (const [id, addon] of this.addons) {
            if (path.resolve(addon.dir) === dirPath) return id;
        }
        return null;
    }

    //============================================
    // Public Server Lifecycle
    //============================================

    /**
     * Start the public server if any running addon has publicRoutes and a port is configured.
     * Resolves the port from the first addon's publicServer.defaultPort or config.publicServerPort.
     */
    private async maybeStartPublicServer(): Promise<void> {
        if (this.publicServer?.isListening) return;

        // Find first addon with publicRoutes enabled
        const publicAddon = [...this.addons.values()].find(
            a => a.state === 'running' && a.manifest.publicRoutes === true,
        );
        if (!publicAddon) return;

        // Determine port: config override > manifest default
        let port = this.config.publicServerPort;
        if (!port && publicAddon.manifest.publicServer?.defaultPort) {
            port = publicAddon.manifest.publicServer.defaultPort;
        }
        if (!port) {
            console.warn('Addon has publicRoutes but no port configured (set publicServerPort in addon config)');
            return;
        }

        this.publicServer = new AddonPublicServer(
            port,
            publicAddon.manifest.id,
            (addonId) => this.getProcess(addonId),
        );

        try {
            await this.publicServer.start();
        } catch (err) {
            console.error(`Failed to start public server: ${(err as Error).message}`);
            this.publicServer = null;
        }
    }

    /**
     * Stop the public server if no remaining addons need it.
     */
    private async maybeStopPublicServer(): Promise<void> {
        if (!this.publicServer?.isListening) return;

        const hasPublicAddon = [...this.addons.values()].some(
            a => a.state === 'running' && a.manifest.publicRoutes === true,
        );
        if (hasPublicAddon) return;

        await this.publicServer.stop();
        this.publicServer = null;
    }

    //============================================
    // Shutdown
    //============================================

    /**
     * Graceful shutdown — stop all addon processes and flush storage.
     */
    async handleShutdown(): Promise<void> {
        console.log('Shutting down addon system...');

        // Clear all crash-restart timers
        for (const timer of this.crashRestartTimers.values()) {
            clearTimeout(timer);
        }
        this.crashRestartTimers.clear();

        // Close file watcher
        if (this.fileWatcher) {
            this.fileWatcher.close();
            this.fileWatcher = null;
        }

        // Stop public server
        if (this.publicServer) {
            await this.publicServer.stop();
            this.publicServer = null;
        }

        // Stop all addon processes
        const stopPromises: Promise<void>[] = [];
        for (const addon of this.addons.values()) {
            if (addon.process && addon.state === 'running') {
                stopPromises.push(addon.process.stop());
            }
        }

        await Promise.allSettled(stopPromises);

        // Flush storage
        this.storage.shutdown();

        console.log('Addon system shutdown complete');
    }
}
