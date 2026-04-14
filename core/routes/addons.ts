const modulename = 'WebServer:AddonRoutes';
import fs from 'node:fs';
import path from 'node:path';
import consoleFactory from '@lib/console';
import { AuthedCtx, InitializedCtx } from '@modules/WebServer/ctxTypes';
const console = consoleFactory(modulename);

const MIME_TYPES: Record<string, string> = {
    '.js': 'application/javascript',
    '.css': 'text/css',
    '.json': 'application/json',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.svg': 'image/svg+xml',
    '.gif': 'image/gif',
    '.webp': 'image/webp',
    '.ico': 'image/x-icon',
    '.woff': 'font/woff',
    '.woff2': 'font/woff2',
    '.ttf': 'font/ttf',
};

/**
 * GET /api/addons/list
 * Returns the list of all discovered addons and their states.
 * Requires manage.admins permission.
 */
export async function addonsList(ctx: AuthedCtx) {
    if (!ctx.admin.testPermission('all_permissions', modulename)) {
        return ctx.send({ error: 'Insufficient permissions.' });
    }

    const addonManager = txCore.addonManager;
    return ctx.send({
        addons: addonManager.getAddonList(),
        config: addonManager.getConfig(),
    });
}

/**
 * GET /api/addons/panel-manifest
 * Returns the panel manifest for dynamic addon loading.
 * Available to all authenticated admins.
 */
export async function addonsPanelManifest(ctx: AuthedCtx) {
    const addonManager = txCore.addonManager;
    return ctx.send({
        addons: addonManager.getPanelManifest(),
    });
}

/**
 * GET /api/addons/nui-manifest
 * Returns the NUI manifest for dynamic addon loading in-game.
 */
export async function addonsNuiManifest(ctx: AuthedCtx) {
    const addonManager = txCore.addonManager;
    return ctx.send({
        addons: addonManager.getNuiManifest(),
    });
}

/**
 * POST /api/addons/:addonId/approve
 * Approve an addon with specified permissions.
 */
export async function addonsApprove(ctx: AuthedCtx) {
    if (!ctx.admin.testPermission('all_permissions', modulename)) {
        return ctx.send({ error: 'Insufficient permissions.' });
    }

    const { addonId } = ctx.params;
    const { permissions } = ctx.request.body;

    if (!addonId || typeof addonId !== 'string') {
        return ctx.send({ error: 'Invalid addon ID.' });
    }
    if (!Array.isArray(permissions)) {
        return ctx.send({ error: 'Permissions must be an array.' });
    }

    const result = txCore.addonManager.approveAddon(addonId, permissions, ctx.admin.name);
    return ctx.send(result);
}

/**
 * POST /api/addons/:addonId/revoke
 * Revoke addon approval.
 */
export async function addonsRevoke(ctx: AuthedCtx) {
    if (!ctx.admin.testPermission('all_permissions', modulename)) {
        return ctx.send({ error: 'Insufficient permissions.' });
    }

    const { addonId } = ctx.params;
    if (!addonId || typeof addonId !== 'string') {
        return ctx.send({ error: 'Invalid addon ID.' });
    }

    const result = txCore.addonManager.revokeAddon(addonId);
    return ctx.send(result);
}

/**
 * ALL /api/addons/:addonId/api/*
 * Proxy HTTP requests to addon child processes.
 */
export async function addonsProxy(ctx: AuthedCtx) {
    const { addonId } = ctx.params;
    if (!addonId || typeof addonId !== 'string') {
        ctx.status = 400;
        return ctx.send({ error: 'Invalid addon ID.' });
    }

    // Validate addon ID format
    if (!/^[a-z0-9][a-z0-9-]{1,62}[a-z0-9]$/.test(addonId)) {
        ctx.status = 400;
        return ctx.send({ error: 'Invalid addon ID format.' });
    }

    const addonManager = txCore.addonManager;
    const addonProcess = addonManager.getProcess(addonId);

    if (!addonProcess) {
        ctx.status = 503;
        return ctx.send({ error: 'Addon is not running.' });
    }

    // Extract the path after /addons/:addonId/api/
    const fullPath = ctx.path;
    const prefix = `/addons/${addonId}/api`;
    const addonPath = fullPath.slice(prefix.length) || '/';

    try {
        const result = await addonProcess.handleHttpRequest({
            method: ctx.method,
            path: addonPath,
            headers: ctx.headers as Record<string, string>,
            body: ctx.request.body,
            admin: {
                name: ctx.admin.name,
                permissions: ctx.admin.permissions,
                isMaster: ctx.admin.isMaster,
            },
        });

        ctx.status = result.status;
        if (result.headers) {
            for (const [key, value] of Object.entries(result.headers)) {
                // Safety: don't allow addon to set certain headers
                const lowerKey = key.toLowerCase();
                if (lowerKey === 'set-cookie' || lowerKey === 'content-security-policy') continue;
                ctx.set(key, value);
            }
        }
        ctx.body = result.body;
    } catch (error) {
        console.error(`Addon proxy error for ${addonId}: ${(error as Error).message}`);
        ctx.status = 504;
        ctx.body = { error: 'Addon request timed out.' };
    }
}

/**
 * ALL /site/:addonId/*
 * Proxy public (unauthenticated) HTTP requests to addon child processes.
 */
export async function addonsPublicProxy(ctx: InitializedCtx) {
    const { addonId } = ctx.params;
    if (!addonId || typeof addonId !== 'string') {
        ctx.status = 400;
        return ctx.send({ error: 'Invalid addon ID.' });
    }

    if (!/^[a-z0-9][a-z0-9-]{1,62}[a-z0-9]$/.test(addonId)) {
        ctx.status = 400;
        return ctx.send({ error: 'Invalid addon ID format.' });
    }

    const addonManager = txCore.addonManager;

    // Check addon has publicRoutes enabled
    if (!addonManager.hasPublicRoutes(addonId)) {
        ctx.status = 403;
        return ctx.send({ error: 'Addon does not support public routes.' });
    }

    const addonProcess = addonManager.getProcess(addonId);
    if (!addonProcess) {
        ctx.status = 503;
        return ctx.send({ error: 'Addon is not running.' });
    }

    const fullPath = ctx.path;
    const prefix = `/site/${addonId}`;
    const addonPath = fullPath.slice(prefix.length) || '/';

    try {
        const result = await addonProcess.handlePublicRequest({
            method: ctx.method,
            path: addonPath,
            headers: ctx.headers as Record<string, string>,
            body: ctx.request.body,
        });

        ctx.status = result.status;
        if (result.headers) {
            for (const [key, value] of Object.entries(result.headers)) {
                const lowerKey = key.toLowerCase();
                if (lowerKey === 'set-cookie' || lowerKey === 'content-security-policy') continue;
                ctx.set(key, value);
            }
        }
        ctx.body = result.body;
    } catch (error) {
        console.error(`Public proxy error for ${addonId}: ${(error as Error).message}`);
        ctx.status = 504;
        ctx.body = { error: 'Addon request timed out.' };
    }
}

/**
 * GET /addons/:addonId/panel/*
 * Serve addon panel static files.
 */
export async function addonsServePanelFile(ctx: InitializedCtx) {
    const addonId = ctx.params.addonId;
    if (!addonId || !/^[a-z0-9][a-z0-9-]{1,62}[a-z0-9]$/.test(addonId)) {
        ctx.status = 404;
        return;
    }

    // Get remaining path after /addons/:addonId/panel/
    const filePath = ctx.params[0] || 'index.js';

    const resolved = txCore.addonManager.resolveAddonStaticPath(addonId, 'panel', filePath);
    if (!resolved) {
        ctx.status = 404;
        return;
    }

    const ext = path.extname(resolved).toLowerCase();
    ctx.type = MIME_TYPES[ext] || 'application/octet-stream';
    ctx.set('Cache-Control', 'public, max-age=300');
    ctx.body = fs.createReadStream(resolved);
}

/**
 * GET /nui/addons/:addonId/*
 * Serve addon NUI static files.
 */
export async function addonsServeNuiFile(ctx: InitializedCtx) {
    const addonId = ctx.params.addonId;
    if (!addonId || !/^[a-z0-9][a-z0-9-]{1,62}[a-z0-9]$/.test(addonId)) {
        ctx.status = 404;
        return;
    }

    const filePath = ctx.params[0] || 'index.js';

    const resolved = txCore.addonManager.resolveAddonStaticPath(addonId, 'nui', filePath);
    if (!resolved) {
        ctx.status = 404;
        return;
    }

    const ext = path.extname(resolved).toLowerCase();
    ctx.type = MIME_TYPES[ext] || 'application/octet-stream';
    ctx.set('Cache-Control', 'public, max-age=300');
    ctx.body = fs.createReadStream(resolved);
}

/**
 * GET /addons/:addonId/static/*
 * Serve addon static assets.
 */
export async function addonsServeStaticFile(ctx: InitializedCtx) {
    const addonId = ctx.params.addonId;
    if (!addonId || !/^[a-z0-9][a-z0-9-]{1,62}[a-z0-9]$/.test(addonId)) {
        ctx.status = 404;
        return;
    }

    const filePath = ctx.params[0];
    if (!filePath) {
        ctx.status = 404;
        return;
    }

    const resolved = txCore.addonManager.resolveAddonStaticPath(addonId, 'static', filePath);
    if (!resolved) {
        ctx.status = 404;
        return;
    }

    const ext = path.extname(resolved).toLowerCase();
    ctx.type = MIME_TYPES[ext] || 'application/octet-stream';
    ctx.set('Cache-Control', 'public, max-age=300');
    ctx.body = fs.createReadStream(resolved);
}

/**
 * POST /api/addons/:addonId/reload
 * Hot-reload a single addon (stop, re-read manifest, restart).
 */
export async function addonsReload(ctx: AuthedCtx) {
    if (!ctx.admin.testPermission('all_permissions', modulename)) {
        return ctx.send({ error: 'Insufficient permissions.' });
    }

    const { addonId } = ctx.params;
    if (!addonId || typeof addonId !== 'string') {
        return ctx.send({ error: 'Invalid addon ID.' });
    }

    if (!/^[a-z0-9][a-z0-9-]{1,62}[a-z0-9]$/.test(addonId)) {
        return ctx.send({ error: 'Invalid addon ID format.' });
    }

    const result = await txCore.addonManager.reloadAddon(addonId);
    return ctx.send(result);
}

/**
 * POST /api/addons/:addonId/stop
 * Stop a running addon without revoking approval.
 */
export async function addonsStop(ctx: AuthedCtx) {
    if (!ctx.admin.testPermission('all_permissions', modulename)) {
        return ctx.send({ error: 'Insufficient permissions.' });
    }

    const { addonId } = ctx.params;
    if (!addonId || typeof addonId !== 'string') {
        return ctx.send({ error: 'Invalid addon ID.' });
    }

    const result = await txCore.addonManager.stopAddon(addonId);
    return ctx.send(result);
}

/**
 * POST /api/addons/:addonId/start
 * Start a stopped/approved addon.
 */
export async function addonsStart(ctx: AuthedCtx) {
    if (!ctx.admin.testPermission('all_permissions', modulename)) {
        return ctx.send({ error: 'Insufficient permissions.' });
    }

    const { addonId } = ctx.params;
    if (!addonId || typeof addonId !== 'string') {
        return ctx.send({ error: 'Invalid addon ID.' });
    }

    const result = await txCore.addonManager.startAddon(addonId);
    return ctx.send(result);
}

/**
 * POST /api/addons/reload-all
 * Hot-reload all addons.
 */
export async function addonsReloadAll(ctx: AuthedCtx) {
    if (!ctx.admin.testPermission('all_permissions', modulename)) {
        return ctx.send({ error: 'Insufficient permissions.' });
    }

    const result = await txCore.addonManager.reloadAllAddons();
    return ctx.send(result);
}

/**
 * GET /api/addons/:addonId/logs
 * Get addon log entries.
 */
export async function addonsLogs(ctx: AuthedCtx) {
    if (!ctx.admin.testPermission('all_permissions', modulename)) {
        return ctx.send({ error: 'Insufficient permissions.' });
    }

    const { addonId } = ctx.params;
    if (!addonId || typeof addonId !== 'string') {
        return ctx.send({ error: 'Invalid addon ID.' });
    }

    return ctx.send({ logs: txCore.addonManager.getAddonLogs(addonId) });
}
