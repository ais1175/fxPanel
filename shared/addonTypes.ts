import { z } from 'zod';

//============================================
// Addon Manifest Schema
//============================================

const addonIdRegex = /^[a-z0-9][a-z0-9-]{1,62}[a-z0-9]$/;

export const AddonPageSchema = z.object({
    path: z.string().min(1),
    title: z.string().min(1).max(64),
    icon: z.string().optional(),
    sidebar: z.boolean().default(false),
    sidebarGroup: z.string().max(32).optional(),
    permission: z.string().optional(),
    component: z.string().min(1),
});

export const AddonWidgetSchema = z.object({
    slot: z.string()
        .min(1)
        .max(128)
        .regex(/^[a-z][a-z0-9-]*(\.[a-z][a-z0-9-]*)*$/, 'Slot must be dot-separated lowercase segments (e.g. "dashboard.main", "settings.tab.discord")'),
    component: z.string().min(1),
    title: z.string().min(1).max(64),
    defaultSize: z.enum(['full', 'half', 'quarter']).default('half'),
    permission: z.string().optional(),
});

export const AddonNuiPageSchema = z.object({
    id: z.string().min(1),
    title: z.string().min(1).max(64),
    icon: z.string().optional(),
    component: z.string().min(1),
    permission: z.string().optional(),
});

export const AddonManifestSchema = z.object({
    // Identity
    id: z.string().regex(addonIdRegex, 'Addon ID must be 3-64 chars, lowercase alphanumeric + hyphens'),
    name: z.string().min(1).max(64),
    description: z.string().max(256),
    version: z.string().regex(/^\d+\.\d+\.\d+/, 'Version must be semver'),
    author: z.string().min(1).max(64),
    homepage: z.string().url().optional(),
    license: z.string().optional(),

    // Compatibility
    fxpanel: z.object({
        minVersion: z.string(),
        maxVersion: z.string().optional(),
    }),

    // Addon dependencies (other addon IDs that must be running)
    dependencies: z.array(z.string().regex(addonIdRegex)).default([]),

    // Permissions
    permissions: z.object({
        required: z.array(z.string()).default([]),
        optional: z.array(z.string()).default([]),
    }),

    // Custom admin permissions this addon registers
    adminPermissions: z.array(z.object({
        id: z.string().min(1).max(64).regex(/^[a-z][a-z0-9._-]*$/, 'Permission ID must be lowercase alphanumeric with dots, hyphens, or underscores'),
        label: z.string().min(1).max(64),
        description: z.string().max(256),
    })).default([]),

    // Entry points
    server: z.object({
        entry: z.string(),
    }).optional(),

    panel: z.object({
        entry: z.string(),
        styles: z.string().optional(),
        pages: z.array(AddonPageSchema).default([]),
        widgets: z.array(AddonWidgetSchema).default([]),
        settingsComponent: z.string().optional(),
    }).optional(),

    nui: z.object({
        entry: z.string(),
        styles: z.string().optional(),
        pages: z.array(AddonNuiPageSchema).default([]),
    }).optional(),

    resource: z.object({
        server_scripts: z.array(z.string()).default([]),
        client_scripts: z.array(z.string()).default([]),
    }).optional(),

    // Public route support (unauthenticated HTTP)
    publicRoutes: z.boolean().default(false),
    publicServer: z.object({
        defaultPort: z.number().int().min(1).max(65535),
    }).optional(),
});

export type AddonManifest = z.infer<typeof AddonManifestSchema>;

//============================================
// Addon Permissions
//============================================

export const ADDON_PERMISSIONS = [
    'storage',
    'players.read',
    'players.write',
    'players.kick',
    'players.warn',
    'players.ban',
    'server.read',
    'server.announce',
    'server.command',
    'database.read',
    'http.outbound',
    'ws.push',
] as const;

export type AddonPermission = typeof ADDON_PERMISSIONS[number];

//============================================
// Addon State
//============================================

export const ADDON_STATES = [
    'discovered',
    'validating',
    'approved',
    'starting',
    'running',
    'stopping',
    'stopped',
    'invalid',
    'failed',
    'crashed',
] as const;

export type AddonState = typeof ADDON_STATES[number];

//============================================
// Addon Config (addon-config.json)
//============================================

export const AddonApprovalSchema = z.object({
    granted: z.array(z.string()),
    approvedAt: z.string(),
    approvedBy: z.string(),
});

export const AddonConfigSchema = z.object({
    enabled: z.boolean().default(true),
    maxAddons: z.number().int().min(1).max(100).default(20),
    maxStorageMb: z.number().min(1).max(100).default(10),
    processTimeoutMs: z.number().int().min(1000).max(60000).default(10000),
    publicServerPort: z.number().int().min(0).max(65535).default(0),
    approved: z.record(z.string(), AddonApprovalSchema).default({}),
    disabled: z.array(z.string()).default([]),
});

export type AddonConfig = z.infer<typeof AddonConfigSchema>;
export type AddonApproval = z.infer<typeof AddonApprovalSchema>;

//============================================
// IPC Protocol
//============================================

export interface AddonIpcMessage {
    type: string;
    id?: string;
    payload: unknown;
}

// Route descriptor sent by addon on ready
export interface AddonRouteDescriptor {
    method: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';
    path: string;
}

// Core → Addon messages
export type CoreToAddonMessage =
    | { type: 'init'; payload: { addonId: string; permissions: string[] } }
    | { type: 'shutdown'; payload: Record<string, never> }
    | { type: 'http-request'; id: string; payload: { method: string; path: string; headers: Record<string, string>; body: unknown; admin: { name: string; permissions: string[] } } }
    | { type: 'public-request'; id: string; payload: { method: string; path: string; headers: Record<string, string>; body: unknown } }
    | { type: 'event'; payload: { event: string; data: unknown } }
    | { type: 'storage-response'; id: string; payload: { data: unknown; error?: string } }
    | { type: 'api-call-response'; id: string; payload: { data: unknown; error?: string } }
    | { type: 'ws-subscribe'; payload: { sessionId: string } }
    | { type: 'ws-unsubscribe'; payload: { sessionId: string } };

// Addon → Core messages
export type AddonToCoreMessage =
    | { type: 'ready'; payload: { routes: AddonRouteDescriptor[]; publicRoutes?: AddonRouteDescriptor[] } }
    | { type: 'http-response'; id: string; payload: { status: number; headers?: Record<string, string>; body: unknown } }
    | { type: 'storage-request'; id: string; payload: { op: 'get' | 'set' | 'delete' | 'list'; key?: string; value?: unknown } }
    | { type: 'api-call'; id: string; payload: { method: string; args: unknown[] } }
    | { type: 'ws-push'; payload: { event: string; data: unknown } }
    | { type: 'log'; payload: { level: 'info' | 'warn' | 'error'; message: string } }
    | { type: 'error'; payload: { message: string; stack?: string } };

//============================================
// Panel Manifest API Response
//============================================

export interface AddonPanelDescriptor {
    id: string;
    name: string;
    version: string;
    entryUrl: string;
    stylesUrl: string | null;
    pages: z.infer<typeof AddonPageSchema>[];
    widgets: z.infer<typeof AddonWidgetSchema>[];
    settingsComponent: string | null;
}

export interface AddonNuiDescriptor {
    id: string;
    name: string;
    version: string;
    entryUrl: string;
    stylesUrl: string | null;
    pages: z.infer<typeof AddonNuiPageSchema>[];
}

export interface AddonListItem {
    id: string;
    name: string;
    description: string;
    version: string;
    author: string;
    state: AddonState;
    /** True when the addon was previously approved but now requires new permissions. */
    needsReapproval: boolean;
    /** True when the addon exports a settings component. */
    hasSettings: boolean;
    /** Other addon IDs this addon depends on. */
    dependencies: string[];
    permissions: {
        required: string[];
        optional: string[];
        granted: string[];
    };
}
