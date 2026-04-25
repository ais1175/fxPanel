const modulename = 'WebServer:CFGEditorSave';
import fsp from 'node:fs/promises';
import path from 'node:path';
import { resolveCFGFilePath, validateModifyServerConfig } from '@lib/fxserver/fxsConfigHelper';
import type { AuthedCtx } from '@modules/WebServer/ctxTypes';
import consoleFactory from '@lib/console';
const console = consoleFactory(modulename);

/**
 * Validates a cfg filename to prevent path traversal.
 */
const isValidCfgFileName = (fileName: string): boolean => {
    if (typeof fileName !== 'string') return false;
    if (!fileName.endsWith('.cfg')) return false;
    if (fileName.includes('/') || fileName.includes('\\') || fileName.includes('..')) return false;
    if (fileName.length > 128) return false;
    return true;
};

/**
 * Saves a .cfg file
 */
export default async function CFGEditorSave(ctx: AuthedCtx) {
    //Sanity check
    if (typeof ctx.request.body.cfgData !== 'string') {
        return ctx.utils.error(400, 'Invalid Request');
    }

    //Check permissions
    if (!ctx.admin.testPermission('server.cfg.editor', modulename)) {
        return ctx.send({
            type: 'error',
            message: "You don't have permission to execute this action.",
        });
    }

    //Check if file is set
    if (!txCore.fxRunner.isConfigured) {
        const message = 'CFG or Server Data Path not defined. Configure it in the settings page first.';
        return ctx.send({ type: 'error', message });
    }

    //Determine which file to save
    const requestedFile = ctx.request.body.cfgFile as string | undefined;
    const isMainCfg = !requestedFile || requestedFile === txConfig.server.cfgPath;

    //For non-main cfg files, simple save with backup (no validation)
    if (!isMainCfg) {
        if (!isValidCfgFileName(requestedFile!)) {
            return ctx.send({ type: 'error', message: 'Invalid CFG file name.' });
        }

        const cfgAbsolutePath = resolveCFGFilePath(requestedFile!, txConfig.server.dataPath!);

        //Ensure the resolved path is inside the data directory. Using
        //path.relative avoids Windows case-insensitivity and separator
        //edge cases that a string `startsWith` check misses (e.g.
        //"C:\\Data" vs "C:\\data\\evil" or a sibling like "C:\\Datab").
        const normalizedDataPath = path.resolve(txConfig.server.dataPath!);
        const normalizedCfgPath = path.resolve(cfgAbsolutePath);
        const relative = path.relative(normalizedDataPath, normalizedCfgPath);
        if (!relative || relative.startsWith('..') || path.isAbsolute(relative)) {
            return ctx.send({ type: 'error', message: 'Invalid file path.' });
        }

        try {
            try {
                await fsp.access(cfgAbsolutePath);
                await fsp.copyFile(cfgAbsolutePath, `${cfgAbsolutePath}.bkp`);
            } catch (e) {
                /* no backup needed if file is new */
            }

            await fsp.writeFile(cfgAbsolutePath, ctx.request.body.cfgData, 'utf8');
            console.warn(`Saved '${cfgAbsolutePath}' by ${ctx.admin.name}`);
            return ctx.send({
                type: 'success',
                markdown: true,
                message: `**File \`${requestedFile}\` saved.**`,
            });
        } catch (error) {
            return ctx.send({
                type: 'error',
                markdown: true,
                message: `**Failed to save \`${requestedFile}\`:**\n${emsg(error)}`,
            });
        }
    }

    //Main server.cfg — validate then save
    let result: Awaited<ReturnType<typeof validateModifyServerConfig>>;
    try {
        result = await validateModifyServerConfig(
            ctx.request.body.cfgData,
            txConfig.server.cfgPath!,
            txConfig.server.dataPath!,
        );
    } catch (error) {
        return ctx.send({
            type: 'error',
            markdown: true,
            message: `**Failed to save \`server.cfg\` with error:**\n${emsg(error)}`,
        });
    }

    //Handle result
    if (result.errors) {
        return ctx.send({
            type: 'error',
            markdown: true,
            message: `**Cannot save \`server.cfg\` due to error(s) in your config file(s):**\n${result.errors}`,
        });
    }
    txCore.fxRunner.lastCfgErrors = null;
    if (result.warnings) {
        return ctx.send({
            type: 'warning',
            markdown: true,
            message: `**File saved, but there are warnings you should pay attention to:**\n${result.warnings}`,
        });
    }
    return ctx.send({
        type: 'success',
        markdown: true,
        message: '**File saved.**',
    });
}
