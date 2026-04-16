const modulename = 'WebServer:AuthGetIdentifiers';
import { AuthedCtx } from '@modules/WebServer/ctxTypes';
import consoleFactory from '@lib/console';
const console = consoleFactory(modulename);

/**
 * Returns the identifiers of the current admin
 */
export default async function AuthGetIdentifiers(ctx: AuthedCtx) {
    //Check if self-edit is allowed, otherwise require manage.admins permission
    if (!txConfig.general.allowSelfIdentifierEdit) {
        if (!ctx.admin.testPermission('manage.admins', modulename)) {
            return ctx.send({ error: 'Self identifier editing is disabled.' });
        }
    }

    //Get vault admin
    const vaultAdmin = txCore.adminStore.getAdminByName(ctx.admin.name);
    if (!vaultAdmin) throw new Error('Wait, what? Where is that admin?');

    return ctx.send({
        cfxreId: vaultAdmin.providers.citizenfx ? vaultAdmin.providers.citizenfx.identifier : '',
        discordId: vaultAdmin.providers.discord ? vaultAdmin.providers.discord.identifier : '',
    });
}
