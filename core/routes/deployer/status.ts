const modulename = 'WebServer:DeployerStatus';
import type { AuthedCtx } from '@modules/WebServer/ctxTypes';
import consoleFactory from '@lib/console';
const console = consoleFactory(modulename);

/**
 * Returns the output page containing the live console
 */
export default async function DeployerStatus(ctx: AuthedCtx) {
    //Check permissions
    if (!ctx.admin.hasPermission('master')) {
        return ctx.send({ success: false, refresh: true });
    }

    //Check if this is the correct state for the deployer
    if (txManager.deployer == null) {
        return ctx.send({ success: false, refresh: true });
    }

    //Prepare data
    const outData: Record<string, unknown> = {
        progress: txManager.deployer.progress,
        log: txManager.deployer.logLines,
    };
    if (txManager.deployer.step == 'configure') {
        outData.status = 'done';
    } else if (txManager.deployer.deployFailed) {
        outData.status = 'failed';
    } else {
        outData.status = 'running';
    }

    return ctx.send(outData);
}
