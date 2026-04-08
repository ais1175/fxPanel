const modulename = 'WebServer:AdminManagerPresets';
import fs from 'node:fs';
import fsp from 'node:fs/promises';
import { txHostConfig } from '@core/globalData';
import consoleFactory from '@lib/console';
import { AuthedCtx } from '@modules/WebServer/ctxTypes';
const console = consoleFactory(modulename);

const PRESETS_FILE = txHostConfig.dataSubPath('permissionPresets.json');

type StoredPreset = {
    id: string;
    name: string;
    permissions: string[];
};

const readPresetsFile = (): StoredPreset[] => {
    try {
        if (!fs.existsSync(PRESETS_FILE)) return [];
        const raw = fs.readFileSync(PRESETS_FILE, 'utf8');
        const data = JSON.parse(raw);
        if (!Array.isArray(data)) return [];
        return data;
    } catch (error) {
        console.warn(`Failed to read presets file: ${emsg(error)}`);
        return [];
    }
};

const writePresetsFile = async (presets: StoredPreset[]) => {
    await fsp.writeFile(PRESETS_FILE, JSON.stringify(presets, null, 2));
};

/**
 * GET handler — returns stored presets.
 */
export const handleGetPresets = async (ctx: AuthedCtx) => {
    if (!ctx.admin.testPermission('manage.admins', modulename)) {
        return ctx.send({ error: "You don't have permission to view presets." });
    }
    const presets = readPresetsFile();
    return ctx.send({ presets });
};

/**
 * POST handler — saves the full presets array.
 */
export const handleSavePresets = async (ctx: AuthedCtx) => {
    if (!ctx.admin.testPermission('manage.admins', modulename)) {
        return ctx.send({ type: 'danger', message: "You don't have permission to manage presets." });
    }

    const { presets } = ctx.request.body;
    if (!Array.isArray(presets)) {
        return ctx.utils.error(400, 'Invalid Request - presets must be an array.');
    }

    //Validate each preset
    for (const preset of presets) {
        if (
            typeof preset.id !== 'string' ||
            !preset.id.length ||
            typeof preset.name !== 'string' ||
            !preset.name.trim().length ||
            !Array.isArray(preset.permissions)
        ) {
            return ctx.send({ type: 'danger', message: 'Invalid preset data.' });
        }
    }

    const cleaned: StoredPreset[] = presets.map((p: any) => ({
        id: p.id,
        name: p.name.trim(),
        permissions: p.permissions.filter((x: unknown) => typeof x === 'string'),
    }));

    try {
        await writePresetsFile(cleaned);
        ctx.admin.logAction('Saving permission presets.');
        return ctx.send({ type: 'success' });
    } catch (error) {
        return ctx.send({ type: 'danger', message: emsg(error) });
    }
};
