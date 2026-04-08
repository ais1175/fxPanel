const modulename = 'WebServer:AdminManagerStats';
import consoleFactory from '@lib/console';
import { AuthedCtx } from '@modules/WebServer/ctxTypes';
import type { ApiGetAdminStatsResp, ApiGetAdminActionsResp } from '@shared/adminApiTypes';
const console = consoleFactory(modulename);

/**
 * Returns per-admin action stats (bans, warns, revocation rates, etc).
 */
export async function AdminManagerStats(ctx: AuthedCtx) {
    const sendTypedResp = (data: ApiGetAdminStatsResp) => ctx.send(data);
    if (!ctx.admin.testPermission('manage.admins', modulename)) {
        return sendTypedResp({ error: "You don't have permission to view admin stats." });
    }

    try {
        const stats = txCore.database.stats.getAdminStats();
        return sendTypedResp({ stats });
    } catch (error) {
        const msg = `getAdminStats failed with error: ${emsg(error)}`;
        console.verbose.error(msg);
        return sendTypedResp({ error: msg });
    }
}

/**
 * Returns recent actions by a specific admin.
 */
export async function AdminManagerActions(ctx: AuthedCtx) {
    const sendTypedResp = (data: ApiGetAdminActionsResp) => ctx.send(data);
    if (!ctx.admin.testPermission('manage.admins', modulename)) {
        return sendTypedResp({ error: "You don't have permission to view admin stats." });
    }

    const adminName = ctx.request.query?.admin;
    if (typeof adminName !== 'string' || !adminName.length) {
        return sendTypedResp({ error: 'Missing admin parameter.' });
    }

    try {
        const actions = txCore.database.stats.getAdminRecentActions(adminName);
        return sendTypedResp({ actions });
    } catch (error) {
        const msg = `getAdminRecentActions failed with error: ${emsg(error)}`;
        console.verbose.error(msg);
        return sendTypedResp({ error: msg });
    }
}
