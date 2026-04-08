/**
 * TOTP Setup - Generate a new TOTP secret for the authenticated admin.
 * Returns the secret + otpauth URI for QR code rendering.
 * Does NOT enable 2FA yet — that happens in totpConfirm.
 */
const modulename = 'WebServer:TotpSetup';
import { AuthedCtx } from '@modules/WebServer/ctxTypes';
import consoleFactory from '@lib/console';
import { generateTotpSecret, getTotpUri } from '@lib/totp';
import { ApiTotpSetupResp } from '@shared/authApiTypes';
const console = consoleFactory(modulename);

export default async function TotpSetup(ctx: AuthedCtx) {
    const sendTypedResp = (data: ApiTotpSetupResp) => ctx.send(data);

    try {
        // Check if already enabled
        if (ctx.admin.totpEnabled) {
            return sendTypedResp({ error: '2FA is already enabled. Disable it first to reconfigure.' });
        }

        const secret = generateTotpSecret();
        const uri = getTotpUri(secret, ctx.admin.name);

        // Store the pending secret in the session so totpConfirm can retrieve it
        const sess = ctx.sessTools.get();
        ctx.sessTools.set({
            ...sess,
            tmpTotpSecret: secret,
        });

        return sendTypedResp({ secret, uri });
    } catch (error) {
        console.warn(`Failed TOTP setup for ${ctx.admin.name}: ${emsg(error)}`);
        return sendTypedResp({ error: 'Failed to generate 2FA secret.' });
    }
}
