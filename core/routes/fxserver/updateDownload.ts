const modulename = 'WebServer:FxArtifactDownload';
import { AuthedCtx } from '@modules/WebServer/ctxTypes';
import consoleFactory from '@lib/console';
import { ApiToastResp } from '@shared/genericApiTypes';
const console = consoleFactory(modulename);

/**
 * Triggers artifact download from a provided URL.
 */
export default async function FxArtifactDownload(ctx: AuthedCtx) {
    if (!ctx.admin.testPermission('all_permissions', modulename)) {
        return ctx.send<ApiToastResp>({
            type: 'error',
            msg: 'Only admins with all permissions can manage artifacts.',
        });
    }

    const { url, version } = ctx.request.body ?? {};
    if (typeof url !== 'string' || !url.startsWith('https://')) {
        return ctx.send<ApiToastResp>({
            type: 'error',
            msg: 'A valid HTTPS download URL is required.',
        });
    }
    if (typeof version !== 'string' || !version) {
        return ctx.send<ApiToastResp>({
            type: 'error',
            msg: 'A version identifier is required.',
        });
    }

    //Start download in background (non-blocking)
    txCore.fxUpdater.download(url).catch(() => {
        //Error is already stored in status
    });
    ctx.admin.logCommand(`FXServer artifact download started (build ${version})`);

    return ctx.send<ApiToastResp>({
        type: 'success',
        msg: `Downloading FXServer build ${version}...`,
    });
}
