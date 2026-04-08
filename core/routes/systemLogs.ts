import { getLogBuffer } from '@lib/console';
import type { AuthedCtx } from '@modules/WebServer/ctxTypes';
import type { GenericApiErrorResp } from '@shared/genericApiTypes';

/**
 * Returns the data for the system logs pages (console)
 */
export default async function SystemLogs(ctx: AuthedCtx) {
    const { scope } = ctx.params as Record<string, string>;

    //Check permissions
    if (!ctx.admin.hasPermission('txadmin.log.view')) {
        return ctx.send({ error: "You don't have permission to call this endpoint." });
    }

    //Returning the data
    if (scope === 'console') {
        return ctx.send<{ data: string } | GenericApiErrorResp>({
            data: getLogBuffer(),
        });
    } else if (scope === 'configChangelog') {
        return ctx.send({
            configChangelog: txCore.configStore.getChangelog(),
        });
    } else {
        return ctx.send<GenericApiErrorResp>({ error: 'Invalid scope' });
    }
}
