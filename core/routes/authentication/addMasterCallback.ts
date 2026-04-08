const modulename = 'WebServer:AuthAddMasterCallback';
import { InitializedCtx } from '@modules/WebServer/ctxTypes';
import consoleFactory from '@lib/console';
import { ApiAddMasterCallbackResp } from '@shared/authApiTypes';
import { addMasterCallbackBodySchema as bodySchema } from '@shared/authApiSchemas';
import { decryptPayload, getDiscourseUserInfo } from '@modules/AdminStore/providers/DiscourseUser';
const console = consoleFactory(modulename);

/**
 * Handles the Add Master Discourse callback
 */
export default async function AuthAddMasterCallback(ctx: InitializedCtx) {
    const schemaRes = bodySchema.safeParse(ctx.request.body);
    if (!schemaRes.success) {
        return ctx.send<ApiAddMasterCallbackResp>({
            errorTitle: 'Invalid request body',
            errorMessage: schemaRes.error.message,
        });
    }
    const { payload } = schemaRes.data;

    //Check if there are already admins set up
    if (txCore.adminStore.hasAdmins()) {
        return ctx.send<ApiAddMasterCallbackResp>({
            errorTitle: `Master account already set.`,
            errorMessage: `Please return to the login page.`,
        });
    }

    //Checking session for stored private key and nonce
    const inboundSession = ctx.sessTools.get();
    if (!inboundSession?.tmpDiscourseNonce || !inboundSession?.tmpDiscoursePrivateKey) {
        return ctx.send<ApiAddMasterCallbackResp>({
            errorCode: 'invalid_session',
        });
    }

    //Decrypt the Discourse payload
    let apiKey: string;
    try {
        const decrypted = decryptPayload(payload, inboundSession.tmpDiscoursePrivateKey);
        if (decrypted.nonce !== inboundSession.tmpDiscourseNonce) {
            return ctx.send<ApiAddMasterCallbackResp>({
                errorCode: 'invalid_state',
            });
        }
        apiKey = decrypted.key;
    } catch (error) {
        console.warn(`Payload decryption error: ${emsg(error)}`);
        return ctx.send<ApiAddMasterCallbackResp>({
            errorTitle: 'Payload decryption error:',
            errorMessage: emsg(error),
        });
    }

    //Fetch user info from Discourse
    let fivemIdentifier: string;
    let discourseName: string;
    try {
        const userInfo = await getDiscourseUserInfo(apiKey);
        fivemIdentifier = userInfo.identifier;
        discourseName = userInfo.username;
    } catch (error) {
        console.verbose.error(`Discourse user info error: ${emsg(error)}`);
        return ctx.send<ApiAddMasterCallbackResp>({
            errorTitle: 'Failed to get Discourse user info:',
            errorMessage: emsg(error),
        });
    }

    //Setting session
    ctx.sessTools.set({
        tmpAddMasterUserInfo: {
            name: discourseName,
            identifier: fivemIdentifier,
        },
    });

    return ctx.send<ApiAddMasterCallbackResp>({
        fivemName: discourseName,
        fivemId: fivemIdentifier,
    });
}
