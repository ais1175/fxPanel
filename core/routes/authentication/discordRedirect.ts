const modulename = 'WebServer:AuthDiscordRedirect';
import { InitializedCtx } from '@modules/WebServer/ctxTypes';
import consoleFactory from '@lib/console';
import { ApiOauthRedirectResp } from '@shared/authApiTypes';
import { discordRedirectQuerySchema as querySchema } from '@shared/authApiSchemas';
import { randomUUID } from 'node:crypto';
const console = consoleFactory(modulename);

const DISCORD_AUTHORIZE_URL = 'https://discord.com/oauth2/authorize';

/**
 * Generates the Discord OAuth2 authorize URL and returns it to the client.
 */
export default async function AuthDiscordRedirect(ctx: InitializedCtx) {
    const query = ctx.getQuery(querySchema);
    if (!query) return;
    const { origin } = query;

    //Check if there are already admins set up
    if (!txCore.adminStore.hasAdmins()) {
        return ctx.send<ApiOauthRedirectResp>({
            error: 'no_admins_setup',
        });
    }

    //Check if Discord OAuth is configured
    const clientId = txConfig.discordBot.oauthClientId;
    if (!clientId || !txConfig.discordBot.oauthClientSecret) {
        return ctx.send<ApiOauthRedirectResp>({
            error: 'Discord OAuth is not configured.',
        });
    }

    //Generate state and store in session along with the exact redirect URI
    //used. The callback MUST reuse this value (not re-derive from request
    //headers, which are attacker-controllable) — Discord requires that the
    //token-exchange redirect_uri match the authorize redirect_uri byte-for-byte.
    const state = randomUUID();
    const redirectUri = origin + '/login/discord/callback';
    ctx.sessTools.set({
        tmpDiscordOAuthState: state,
        tmpDiscordRedirectUri: redirectUri,
    });

    //Build authorize URL
    const params = new URLSearchParams({
        client_id: clientId,
        response_type: 'code',
        redirect_uri: redirectUri,
        scope: 'identify',
        state: state,
    });
    const authUrl = `${DISCORD_AUTHORIZE_URL}?${params.toString()}`;

    return ctx.send<ApiOauthRedirectResp>({
        authUrl,
    });
}
