const modulename = 'WebServer:AdvancedPage';
import type { AuthedCtx } from '@modules/WebServer/ctxTypes';
import consoleFactory from '@lib/console';
const console = consoleFactory(modulename);

/**
 * Returns JSON data for the Advanced page
 */
export default async function AdvancedPage(ctx: AuthedCtx) {
    //Check permissions
    if (!ctx.admin.hasPermission('all_permissions')) {
        return ctx.send({ error: "You don't have permission to view this page." });
    }

    return ctx.send({
        verbosityEnabled: console.isVerbose,
    });
}
