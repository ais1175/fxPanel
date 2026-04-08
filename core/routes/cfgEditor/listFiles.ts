const modulename = 'WebServer:CFGEditorFiles';
import fsp from 'node:fs/promises';
import path from 'node:path';
import { resolveCFGFilePath, readRawCFGFile } from '@lib/fxserver/fxsConfigHelper';
import consoleFactory from '@lib/console';
const console = consoleFactory(modulename);

/**
 * Validates a cfg filename to prevent path traversal.
 */
const isValidCfgFileName = (fileName: string) => {
    if (typeof fileName !== 'string') return false;
    if (!fileName.endsWith('.cfg')) return false;
    if (fileName.includes('/') || fileName.includes('\\') || fileName.includes('..')) return false;
    if (fileName.length > 128) return false;
    return true;
};

/**
 * GET /cfgEditor/files — lists .cfg files in the server data directory.
 * GET /cfgEditor/files?file=xxx.cfg — returns the contents of that file.
 */
export default async function CFGEditorFiles(ctx: any) {
    //Check permissions
    if (!ctx.admin.hasPermission('server.cfg.editor')) {
        return ctx.send({ error: "You don't have permission to view this page." });
    }

    //Check if server data path is configured
    if (!txCore.fxRunner.isConfigured) {
        return ctx.send({ error: 'Server data path not configured.' });
    }

    const dataPath = txConfig.server.dataPath;
    const requestedFile = ctx.query.file;

    //If a file is requested, return its contents
    if (requestedFile) {
        if (!isValidCfgFileName(requestedFile)) {
            return ctx.send({ error: 'Invalid file name.' });
        }
        const cfgAbsolutePath = resolveCFGFilePath(requestedFile, dataPath);

        //Ensure path stays inside data directory
        const normalizedDataPath = path.resolve(dataPath);
        const normalizedCfgPath = path.resolve(cfgAbsolutePath);
        if (!normalizedCfgPath.startsWith(normalizedDataPath + path.sep) && normalizedCfgPath !== normalizedDataPath) {
            return ctx.send({ error: 'Invalid file path.' });
        }

        try {
            const contents = await readRawCFGFile(cfgAbsolutePath);
            return ctx.send({
                name: requestedFile,
                contents,
                isMainCfg: requestedFile === txConfig.server.cfgPath,
            });
        } catch (error) {
            return ctx.send({ error: `Failed to read file: ${(error as Error).message}` });
        }
    }

    //Otherwise, list all .cfg files
    try {
        const entries = await fsp.readdir(dataPath, { withFileTypes: true });
        const cfgFiles = entries
            .filter((e) => e.isFile() && e.name.endsWith('.cfg'))
            .map((e) => e.name)
            .sort((a, b) => {
                if (a === txConfig.server.cfgPath) return -1;
                if (b === txConfig.server.cfgPath) return 1;
                return a.localeCompare(b);
            });
        return ctx.send({ files: cfgFiles, mainCfg: txConfig.server.cfgPath });
    } catch (error) {
        console.error(`Failed to list .cfg files: ${(error as Error).message}`);
        return ctx.send({ error: 'Failed to list files in server data directory.' });
    }
}
