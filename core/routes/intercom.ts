const modulename = 'WebServer:Intercom';
import { txEnv } from '@core/globalData';
import consoleFactory from '@lib/console';
import { InitializedCtx } from '@modules/WebServer/ctxTypes';
import { reportsCreate, reportsPlayerList, reportsPlayerMessage } from './reports';
import { resolveScreenshot } from './player/screenshot';
import { handleSpectateFrame } from './player/liveSpectate';
import { z } from 'zod';
import { reportTypes } from '@shared/reportApiTypes';
import got from '@lib/got';
import { randomUUID } from 'node:crypto';
const console = consoleFactory(modulename);

const STATS_ENDPOINT = 'https://fxapi.fxpanel.org/api/stats';

let statsInstallId: string | null = null;

const sendStatsToFxApi = async () => {
    if (!statsInstallId) {
        statsInstallId = txCore.cacheStore.get('stats:installId') as string | null;
        if (!statsInstallId) {
            statsInstallId = randomUUID();
            txCore.cacheStore.set('stats:installId', statsInstallId);
        }
    }

    const playerCount = txCore.fxPlayerlist.getPlayerList().length;
    const maxClients = txCore.cacheStore.get('fxsRuntime:maxClients') as number | null;

    let dbStats = { players: 0, playTime: 0 };
    try {
        dbStats = txCore.database.stats.getDatabaseStats();
    } catch {
        // database not ready yet
    }

    const payload = {
        installId: statsInstallId,
        version: txEnv.txaVersion,
        timestamp: Date.now(),
        server: {
            os: process.platform,
            playerSlots: maxClients ?? 0,
            currentPlayers: playerCount,
        },
        stats: {
            totalUniquePlayers: dbStats.players,
            totalPlayTimeSeconds: dbStats.playTime,
        },
    };

    try {
        await got.post(STATS_ENDPOINT, { json: payload, timeout: { send: 5000 } });
    } catch (error) {
        console.verbose.warn('Failed to send stats to fxapi.fxpanel.org', { error: (error as Error).message });
    }
};

// Send stats every 5 minutes
setInterval(sendStatsToFxApi, 5 * 60 * 1000);
// Also send once shortly after boot (30s delay to let DB init)
setTimeout(sendStatsToFxApi, 30 * 1000);

// Base schema with txAdminToken that all intercom requests include
const baseIntercomSchema = {
    txAdminToken: z.string(),
};

// Validation schemas for intercom scopes
const monitorSchema = z.object(baseIntercomSchema).strict();

const resourcesSchema = z
    .object({
        ...baseIntercomSchema,
        resources: z.array(z.any()), // Resource objects with metadata
    })
    .strict();

const reportPlayerRefSchema = z.object({
    license: z.string(),
    name: z.string(),
    netid: z.number(),
});

const reportCreateSchema = z
    .object({
        ...baseIntercomSchema,
        type: z.enum(reportTypes),
        reporter: reportPlayerRefSchema,
        targets: z.array(reportPlayerRefSchema).optional(),
        reason: z.string(),
    })
    .strict();

const reportPlayerListSchema = z
    .object({
        ...baseIntercomSchema,
        playerLicense: z.string(),
    })
    .strict();

const reportPlayerMessageSchema = z
    .object({
        ...baseIntercomSchema,
        reportId: z.string(),
        playerLicense: z.string(),
        content: z.string(),
    })
    .strict();

const screenshotResultSchema = z
    .object({
        ...baseIntercomSchema,
        requestId: z.string(),
        fileName: z.string().optional(),
        error: z.string().optional(),
    })
    .strict();

const spectateFrameSchema = z
    .object({
        ...baseIntercomSchema,
        sessionId: z.string(),
        frameData: z.string(),
    })
    .strict();

const statsSchema = z
    .object({
        ...baseIntercomSchema,
    })
    .strict();

// Map of scope names to their validation schemas
const scopeValidators = {
    monitor: monitorSchema,
    resources: resourcesSchema,
    reportCreate: reportCreateSchema,
    reportPlayerList: reportPlayerListSchema,
    reportPlayerMessage: reportPlayerMessageSchema,
    screenshotResult: screenshotResultSchema,
    spectateFrame: spectateFrameSchema,
    stats: statsSchema,
} as const;

type IntercomScope = keyof typeof scopeValidators;
type ScopeData<S extends IntercomScope> = z.infer<(typeof scopeValidators)[S]>;

/**
 * Validates the request body against the schema for the given scope
 * @param scope - The intercom scope
 * @param body - The request body to validate
 * @returns An object with success boolean and either data or error
 */
const validateScopeData = <S extends IntercomScope>(
    scope: S,
    body: unknown,
): { success: true; data: ScopeData<S> } | { success: false; error: string } => {
    const schema = scopeValidators[scope];

    const result = schema.safeParse(body);
    if (!result.success) {
        const errorDetails = result.error.errors.map((e) => `${e.path.join('.')}: ${e.message}`).join(', ');
        return { success: false, error: `Validation failed: ${errorDetails}` };
    }

    return { success: true, data: result.data as ScopeData<S> };
};

/**
 * Intercommunications endpoint
 * @param {object} ctx
 */
export default async function Intercom(ctx: InitializedCtx) {
    //Sanity check
    const params = ctx.params as Record<string, string>;
    if (typeof params.scope !== 'string' || ctx.request.body === undefined) {
        return ctx.utils.error(400, 'Invalid Request');
    }
    const scope = params.scope;

    // Validate scope name
    if (!(scope in scopeValidators)) {
        return ctx.send({
            type: 'danger',
            message: 'Unknown intercom scope.',
        });
    }
    const validScope = scope as IntercomScope;

    // Validate the request body against the schema for this scope
    const validationResult = validateScopeData(validScope, ctx.request.body);
    if (!validationResult.success) {
        console.verbose.warn(`Intercom validation failed for scope '${scope}': ${validationResult.error}`);
        return ctx.utils.error(400, validationResult.error);
    }

    const postData = validationResult.data;
    (postData as Record<string, unknown>).txAdminToken = true;

    //Delegate to the specific scope functions
    if (validScope == 'monitor') {
        try {
            txCore.fxMonitor.handleHeartBeat('http');
            return ctx.send(txManager.txRuntime.currHbData);
        } catch (error) {
            return ctx.send({
                txAdminVersion: txEnv.txaVersion,
                success: false,
            });
        }
    } else if (validScope == 'stats') {
        sendStatsToFxApi();
        return ctx.send({ success: true });
    } else if (validScope == 'resources') {
        txCore.fxResources.tmpUpdateResourceList(postData.resources);
        return ctx.send({
            txAdminVersion: txEnv.txaVersion,
            success: true,
        });
    } else if (validScope == 'reportCreate') {
        return ctx.send(reportsCreate(postData));
    } else if (validScope == 'reportPlayerList') {
        return ctx.send(reportsPlayerList(postData.playerLicense));
    } else if (validScope == 'reportPlayerMessage') {
        return ctx.send(reportsPlayerMessage(postData.reportId, postData.playerLicense, postData.content));
    } else if (validScope == 'screenshotResult') {
        resolveScreenshot(postData.requestId, postData.fileName, postData.error);
        return ctx.send({ success: true });
    } else if (validScope === 'spectateFrame') {
        console.warn(
            `[spectate] Intercom frame received: session=${postData.sessionId}, len=${postData.frameData.length}`,
        );
        handleSpectateFrame(postData.sessionId, postData.frameData);
        return ctx.send({ success: true });
    } else {
        return ctx.send({
            type: 'danger',
            message: 'Unknown intercom scope.',
        });
    }
}
