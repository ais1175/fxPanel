const modulename = 'WebServer:AuthDiscourseRedirect';
import { InitializedCtx } from '@modules/WebServer/ctxTypes';
import consoleFactory from '@lib/console';
import { ApiOauthRedirectResp } from '@shared/authApiTypes';
import { discourseRedirectQuerySchema as querySchema } from '@shared/authApiSchemas';
import { randomUUID } from 'node:crypto';
import { generateKeyPair, getDiscourseAuthUrl } from '@modules/AdminStore/providers/DiscourseUser';
const console = consoleFactory(modulename);

/**
 * Generates the Discourse User API Key auth URL and returns it to the client.
 */
export default async function AuthDiscourseRedirect(ctx: InitializedCtx) {
    const query = ctx.getQuery(querySchema);
    if (!query) return;
    const { origin } = query;

    //Check if there are already admins set up
    if (!txCore.adminStore.hasAdmins()) {
        return ctx.send<ApiOauthRedirectResp>({
            error: 'no_admins_setup',
        });
    }

    //Generate keypair and nonce
    const { publicKey, privateKey } = generateKeyPair();
    const nonce = randomUUID();
    const callbackUrl = origin + '/login/discourse/callback';

    //Store private key and nonce in session for later decryption
    ctx.sessTools.set({
        tmpDiscourseNonce: nonce,
        tmpDiscoursePrivateKey: privateKey,
    });

    //Generate auth URL
    const authUrl = getDiscourseAuthUrl(publicKey, nonce, callbackUrl);

    return ctx.send<ApiOauthRedirectResp>({
        authUrl,
    });
}
