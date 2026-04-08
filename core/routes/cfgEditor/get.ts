const modulename = 'WebServer:CFGEditorPage';
import { resolveCFGFilePath, readRawCFGFile } from '@lib/fxserver/fxsConfigHelper';
import type { AuthedCtx } from '@modules/WebServer/ctxTypes';
import consoleFactory from '@lib/console';
const console = consoleFactory(modulename);

/**
 * Returns JSON data for the CFG editor page
 */
export default async function CFGEditorPage(ctx: AuthedCtx) {
    //Check permissions
    if (!ctx.admin.hasPermission('server.cfg.editor')) {
        return ctx.send({ error: "You don't have permission to view this page." });
    }

    //Check if file is set
    if (!txCore.fxRunner.isConfigured) {
        return ctx.send({
            error: 'You need to configure your server data path before being able to edit the CFG file.',
        });
    }

    //Read cfg file
    let rawFile: string;
    try {
        const cfgFilePath = resolveCFGFilePath(txConfig.server.cfgPath!, txConfig.server.dataPath!);
        rawFile = await readRawCFGFile(cfgFilePath);
    } catch (error) {
        return ctx.send({ error: `Failed to read CFG File with error: ${emsg(error)}` });
    }

    return ctx.send({
        rawFile,
        cfgErrors: txCore.fxRunner.lastCfgErrors ?? null,
    });
}
