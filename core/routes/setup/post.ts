const modulename = 'WebServer:SetupPost';
import type { AuthedCtx } from '@modules/WebServer/ctxTypes';
import { TxConfigState } from '@shared/enums';
import {
    handleValidateRecipeURL,
    handleValidateLocalDeployPath,
    handleValidateLocalDataFolder,
    handleValidateCFGFile,
} from './postValidate';
import { handleSaveDeployerImport, handleSaveDeployerCustom } from './postDeployer';
import { handleSaveLocal } from './postLocal';

/**
 * Dispatches setup page POST actions to their respective handlers.
 */
export default async function SetupPost(ctx: AuthedCtx) {
    //Sanity check
    if (ctx.params.action === undefined) {
        return ctx.utils.error(400, 'Invalid Request');
    }
    const action = ctx.params.action as string;

    //Check permissions
    if (!ctx.admin.testPermission('all_permissions', modulename)) {
        return ctx.send({
            success: false,
            message: 'You need to be the admin master or have all permissions to use the setup page.',
        });
    }

    //Ensure the correct state for the setup page
    if (txManager.configState !== TxConfigState.Setup) {
        return ctx.send({
            success: false,
            refresh: true,
        });
    }

    //Delegate to the specific action handlers
    if (action === 'validateRecipeURL') {
        return await handleValidateRecipeURL(ctx);
    } else if (action === 'validateLocalDeployPath') {
        return await handleValidateLocalDeployPath(ctx);
    } else if (action === 'validateLocalDataFolder') {
        return await handleValidateLocalDataFolder(ctx);
    } else if (action === 'validateCFGFile') {
        return await handleValidateCFGFile(ctx);
    } else if (action === 'save') {
        const type = ctx.request.body?.type;
        if (typeof type !== 'string' || !type.length) {
            return ctx.utils.error(400, 'Invalid Request - missing or invalid type');
        }
        if (type === 'popular' || type === 'remote') {
            return await handleSaveDeployerImport(ctx);
        } else if (type === 'custom') {
            return await handleSaveDeployerCustom(ctx);
        } else if (type === 'local') {
            return await handleSaveLocal(ctx);
        }
    }

    return ctx.send({
        success: false,
        message: 'Unknown setup action.',
    });
}
