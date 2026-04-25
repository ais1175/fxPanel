const modulename = 'WebServer:AddonRoutes';
import fs from 'node:fs';
import path from 'node:path';
import consoleFactory from '@lib/console';
import { AuthedCtx, InitializedCtx } from '@modules/WebServer/ctxTypes';
import { txEnv } from '@core/globalData';
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

const ADDON_ID_REGEX = /^[a-z0-9][a-z0-9-]{0,62}[a-z0-9]$/;

async function isPathInsideOrEqualCompat(base: string, target: string): Promise<boolean> {
    const normalize = (value: string) => {
        const normalized = path.normalize(value);
        return process.platform === 'win32' ? normalized.toLowerCase() : normalized;
    };

    // Resolve symlinks on both ends so a symlinked addon directory cannot be
    // used to escape the configured base. If realpath fails (e.g. ENOENT),
    // fall back to denying the comparison rather than trusting the raw path.
    let realBase: string;
    let realTarget: string;
    try {
        realBase = await fs.promises.realpath(base);
    } catch {
        return false;
    }
    try {
        realTarget = await fs.promises.realpath(target);
    } catch {
        return false;
    }

    const normBase = normalize(realBase);
    const normTarget = normalize(realTarget);
    if (normBase === normTarget) return true;
    const withSep = normBase.endsWith(path.sep) ? normBase : normBase + path.sep;
    return normTarget.startsWith(withSep);
}

async function resolveAddonStaticPathCompat(
    addonId: string,
    layer: 'panel' | 'nui' | 'static',
    filePath: string,
): Promise<string | null> {
    const strictResolved = txCore.addonManager.resolveAddonStaticPath(addonId, layer, filePath);
    if (strictResolved) return strictResolved;

    // Compatibility fallback: resolve from addon directory lookup even if
    // manager state is transient/stale (or folder name differs from addon ID).
    const addonDir = await findAddonDirByIdCompat(addonId);
    if (!addonDir) return null;

    const layerDir = path.resolve(addonDir, layer);
    const candidate = path.resolve(layerDir, filePath);
    if (!await isPathInsideOrEqualCompat(layerDir, candidate)) return null;

    try {
        const stat = await fs.promises.stat(candidate);
        return stat.isFile() ? candidate : null;
    } catch {
        return null;
    }
}

async function findAddonDirByIdCompat(addonId: string): Promise<string | null> {
    const fromManager = txCore.addonManager.getAllAddons().find((entry) => entry.manifest.id === addonId);
    if (fromManager?.dir) {
        return path.resolve(fromManager.dir);
    }

    // Last-resort filesystem scan: map addon.json id -> directory.
    const addonsRoot = path.join(txEnv.txaPath, 'addons');

    try {
        const entries = await fs.promises.readdir(addonsRoot, { withFileTypes: true });
        for (const entry of entries) {
            if (!entry.isDirectory()) continue;
            const dir = path.join(addonsRoot, entry.name);
            const manifestPath = path.join(dir, 'addon.json');

            try {
                // Guard against memory exhaustion from oversized manifests.
                const stat = await fs.promises.stat(manifestPath);
                if (!stat.isFile() || stat.size > 1024 * 1024) continue;
                const manifest = JSON.parse(await fs.promises.readFile(manifestPath, 'utf-8')) as { id?: string };
                if (manifest?.id === addonId) {
                    return path.resolve(dir);
                }
            } catch {
                // Ignore malformed manifests / unreadable stats in fallback scan.
            }
        }
    } catch {
        return null;
    }

    return null;
}

function normalizeWildcardPath(rawPath: string | undefined, fallback = ''): string {
    if (!rawPath) return fallback;

    let filePath = rawPath;
    try {
        filePath = decodeURIComponent(rawPath);
    } catch {
        // Keep raw value when decode fails; resolver validation still applies.
    }

    // Strip any URL query/hash artifacts and normalize accidental leading slash.
    filePath = filePath.split('?')[0].split('#')[0].replace(/^[/\\]+/, '');
    return filePath || fallback;
}

/**
 * Sensitive request headers that MUST NOT be forwarded to addon processes.
 * Addons run with full Node access and are not part of the trust boundary for
 * admin sessions, so exposing session cookies / CSRF tokens / NUI auth tokens
 * to them would defeat HttpOnly and let a compromised addon steal sessions.
 */
const STRIPPED_REQUEST_HEADERS = new Set([
    'cookie',
    'set-cookie',
    'authorization',
    'proxy-authorization',
    'x-txadmin-csrftoken',
    'x-txadmin-token',
    'x-txadmin-identifiers',
    'x-txadmin-password',
    'x-forwarded-for',
    'x-real-ip',
    'host',
]);

/**
 * Response headers that an addon MUST NOT be able to set on the parent origin.
 */
const STRIPPED_RESPONSE_HEADERS = new Set([
    'set-cookie',
    'content-security-policy',
    'content-security-policy-report-only',
    'strict-transport-security',
    'x-frame-options',
    'access-control-allow-origin',
    'access-control-allow-credentials',
    'access-control-allow-headers',
    'access-control-allow-methods',
    'access-control-expose-headers',
]);

/**
 * Build a sanitised header bag safe to forward into addon-controlled code.
 */
function sanitiseRequestHeaders(
    headers: Record<string, string | string[] | undefined>,
): Record<string, string> {
    const out: Record<string, string> = {};
    for (const [key, value] of Object.entries(headers)) {
        if (value === undefined) continue;
        if (STRIPPED_REQUEST_HEADERS.has(key.toLowerCase())) continue;
        out[key] = Array.isArray(value) ? value.join(', ') : value;
    }
    return out;
}

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
    if (!ADDON_ID_REGEX.test(addonId)) {
        return ctx.send({ error: 'Invalid addon ID format.' });
    }
    if (!Array.isArray(permissions) || !permissions.every((p) => typeof p === 'string')) {
        return ctx.send({ error: 'Permissions must be an array of strings.' });
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
    if (!ADDON_ID_REGEX.test(addonId)) {
        return ctx.send({ error: 'Invalid addon ID format.' });
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
    if (!ADDON_ID_REGEX.test(addonId)) {
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
            headers: sanitiseRequestHeaders(ctx.headers as Record<string, string | string[] | undefined>),
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
                if (STRIPPED_RESPONSE_HEADERS.has(key.toLowerCase())) continue;
                ctx.set(key, value);
            }
        }
        // Always enforce a strict CSP on addon responses — addon-served HTML/JS
        // must not be able to reach into the panel origin's cookies via fetch.
        ctx.set('X-Content-Type-Options', 'nosniff');
        ctx.set('X-Frame-Options', 'DENY');
        ctx.body = result.body;
    } catch (error) {
        const err = error as NodeJS.ErrnoException & { name?: string };
        console.error(`Addon proxy error for ${addonId}:`, error);
        const isTimeout =
            err?.name === 'TimeoutError'
            || err?.code === 'ECONNABORTED'
            || err?.code === 'ETIMEDOUT'
            || /timed?\s*out/i.test(err?.message ?? '');
        if (isTimeout) {
            ctx.status = 504;
            ctx.body = { error: 'Addon request timed out.' };
        } else {
            ctx.status = 502;
            ctx.body = { error: 'Addon request failed.' };
        }
    }
}

/**
 * ALL /site/:addonId/*
 * Proxy public (unauthenticated) HTTP requests to addon child processes.
 *
 * SECURITY: This endpoint is intentionally gated off on the primary panel
 * origin — see core/modules/WebServer/router.ts. Public addon traffic MUST
 * go through AddonPublicServer which listens on a separate port so that an
 * addon cannot serve HTML/JS under the same origin as the admin panel and
 * exfiltrate admin session cookies. The handler below is retained only so
 * the AddonPublicServer can reuse the same proxy logic when needed.
 */
export async function addonsPublicProxy(ctx: InitializedCtx) {
    const { addonId } = ctx.params;
    if (!addonId || typeof addonId !== 'string') {
        ctx.status = 400;
        return ctx.send({ error: 'Invalid addon ID.' });
    }

    if (!ADDON_ID_REGEX.test(addonId)) {
        ctx.status = 400;
        return ctx.send({ error: 'Invalid addon ID format.' });
    }

    // Hard-disable the public proxy on the primary (admin) origin. Any request
    // that still reaches this handler is treated as forbidden.
    ctx.status = 404;
    ctx.body = { error: 'Not found.' };
    return;
}

/**
 * GET /addons/:addonId/panel/*
 * Serve addon panel static files.
 */
export async function addonsServePanelFile(ctx: InitializedCtx) {
    const addonId = ctx.params.addonId;
    if (!addonId || !ADDON_ID_REGEX.test(addonId)) {
        ctx.status = 404;
        return;
    }

    // Get remaining path after /addons/:addonId/panel/
    const filePath = normalizeWildcardPath(ctx.params[0], 'index.js');

    const resolved = await resolveAddonStaticPathCompat(addonId, 'panel', filePath);
    if (!resolved) {
        ctx.status = 404;
        return;
    }

    const ext = path.extname(resolved).toLowerCase();
    ctx.type = MIME_TYPES[ext] || 'application/octet-stream';
    ctx.set('Cache-Control', 'public, max-age=300');
    ctx.set('X-Content-Type-Options', 'nosniff');
    ctx.set('X-Frame-Options', 'DENY');
    ctx.body = fs.createReadStream(resolved);
}

/**
 * GET /nui/addons/:addonId/*
 * Serve addon NUI static files.
 */
export async function addonsServeNuiFile(ctx: InitializedCtx) {
    const addonId = ctx.params.addonId;
    if (!addonId || !ADDON_ID_REGEX.test(addonId)) {
        ctx.status = 404;
        return;
    }

    const filePath = normalizeWildcardPath(ctx.params[0], 'index.js');

    const resolved = await resolveAddonStaticPathCompat(addonId, 'nui', filePath);
    if (!resolved) {
        ctx.status = 404;
        return;
    }

    const ext = path.extname(resolved).toLowerCase();
    ctx.type = MIME_TYPES[ext] || 'application/octet-stream';
    ctx.set('Cache-Control', 'public, max-age=300');
    ctx.set('X-Content-Type-Options', 'nosniff');
    ctx.set('X-Frame-Options', 'DENY');
    ctx.body = fs.createReadStream(resolved);
}

/**
 * GET /addons/:addonId/static/*
 * Serve addon static assets.
 */
export async function addonsServeStaticFile(ctx: InitializedCtx) {
    const addonId = ctx.params.addonId;
    if (!addonId || !ADDON_ID_REGEX.test(addonId)) {
        ctx.status = 404;
        return;
    }

    const filePath = normalizeWildcardPath(ctx.params[0]);
    if (!filePath) {
        ctx.status = 404;
        return;
    }

    const resolved = await resolveAddonStaticPathCompat(addonId, 'static', filePath);
    if (!resolved) {
        ctx.status = 404;
        return;
    }

    const ext = path.extname(resolved).toLowerCase();
    ctx.type = MIME_TYPES[ext] || 'application/octet-stream';
    ctx.set('Cache-Control', 'public, max-age=300');
    ctx.set('X-Content-Type-Options', 'nosniff');
    ctx.set('X-Frame-Options', 'DENY');
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

    if (!ADDON_ID_REGEX.test(addonId)) {
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

    if (!ADDON_ID_REGEX.test(addonId)) {
        return ctx.send({ error: 'Invalid addon ID format.' });
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

    if (!ADDON_ID_REGEX.test(addonId)) {
        return ctx.send({ error: 'Invalid addon ID format.' });
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

    if (!ADDON_ID_REGEX.test(addonId)) {
        return ctx.send({ error: 'Invalid addon ID format.' });
    }

    return ctx.send({ logs: txCore.addonManager.getAddonLogs(addonId) });
}
