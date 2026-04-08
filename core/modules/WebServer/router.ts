import { txDevEnv } from '@core/globalData';
import Router from '@koa/router';
import KoaRateLimit from 'koa-ratelimit';

import * as routes from '@routes/index';
import { apiAuthMw, hostAuthMw, intercomAuthMw, webAuthMw } from './middlewares/authMws';
import { wrapRoute } from '@lib/wrapRoute';

/**
 * Router factory
 */
export default () => {
    const router = new Router();
    const authLimiter = KoaRateLimit({
        driver: 'memory',
        db: new Map(),
        duration: txConfig.webServer.limiterMinutes * 60 * 1000, // 15 minutes
        errorMessage: JSON.stringify({
            //Duplicated to maintain compatibility with all auth api routes
            error: `Too many attempts. Blocked for ${txConfig.webServer.limiterMinutes} minutes.`,
            errorTitle: 'Too many attempts.',
            errorMessage: `Blocked for ${txConfig.webServer.limiterMinutes} minutes.`,
        }),
        max: txConfig.webServer.limiterAttempts,
        disableHeader: true,
        id: (ctx: any) => ctx.txVars.realIP,
    });

    //Legacy Rendered Pages (kept for backwards compatibility, some still used by other routes)
    //router.get('/legacy/adminManager', webAuthMw, routes.adminManager_page);
    //router.get('/legacy/advanced', webAuthMw, routes.advanced_page);
    //router.get('/legacy/cfgEditor', webAuthMw, routes.cfgEditor_page);
    //router.get('/legacy/diagnostics', webAuthMw, routes.diagnostics_page);
    //router.get('/legacy/masterActions', webAuthMw, routes.masterActions_page);
    //router.get('/legacy/resources', webAuthMw, routes.resources);
    //router.get('/legacy/whitelist', webAuthMw, routes.whitelist_page);
    //router.get('/legacy/setup', webAuthMw, routes.setup_get);
    //router.get('/legacy/deployer', webAuthMw, routes.deployer_stepper);

    //Authentication
    router.get('/auth/self', apiAuthMw, wrapRoute('AuthSelf', routes.auth_self));
    router.post('/auth/password', authLimiter, routes.auth_verifyPassword);
    router.post('/auth/logout', authLimiter, wrapRoute('AuthLogout', routes.auth_logout));
    router.post('/auth/addMaster/pin', authLimiter, wrapRoute('AddMasterPin', routes.auth_addMasterPin));
    router.post('/auth/addMaster/callback', authLimiter, routes.auth_addMasterCallback);
    router.post('/auth/addMaster/save', authLimiter, routes.auth_addMasterSave);
    router.get('/auth/discourse/redirect', authLimiter, wrapRoute('DiscourseRedirect', routes.auth_discourseRedirect));
    router.post('/auth/discourse/callback', authLimiter, routes.auth_discourseCallback);
    router.post('/auth/changePassword', apiAuthMw, routes.auth_changePassword);
    router.get('/auth/getIdentifiers', apiAuthMw, wrapRoute('GetIdentifiers', routes.auth_getIdentifiers));
    router.post('/auth/changeIdentifiers', apiAuthMw, routes.auth_changeIdentifiers);

    //TOTP 2FA
    router.post('/auth/totp/setup', apiAuthMw, routes.auth_totpSetup);
    router.post('/auth/totp/confirm', apiAuthMw, routes.auth_totpConfirm);
    router.post('/auth/totp/verify', authLimiter, routes.auth_totpVerify);
    router.post('/auth/totp/disable', apiAuthMw, routes.auth_totpDisable);

    //Admin Manager
    router.get('/adminManager/list', apiAuthMw, routes.adminManager_list);
    router.get('/adminManager/stats', apiAuthMw, routes.adminManager_stats);
    router.get('/adminManager/adminActions', apiAuthMw, routes.adminManager_adminActions);
    router.get('/adminManager/presets', apiAuthMw, routes.adminManager_getPresets);
    router.post('/adminManager/presets', apiAuthMw, routes.adminManager_savePresets);
    router.post(
        '/adminManager/getModal/:modalType',
        webAuthMw,
        wrapRoute('AdminGetModal', routes.adminManager_getModal),
    );
    router.post('/adminManager/:action', apiAuthMw, routes.adminManager_actions);

    //Settings
    router.get('/setup/data', apiAuthMw, routes.setup_get);
    router.post('/setup/:action', apiAuthMw, routes.setup_post);
    router.get('/deployer/data', apiAuthMw, routes.deployer_stepper);
    router.get('/deployer/status', apiAuthMw, routes.deployer_status);
    router.post('/deployer/recipe/:action', apiAuthMw, routes.deployer_actions);
    router.get('/settings/configs', apiAuthMw, wrapRoute('GetConfigs', routes.settings_getConfigs));
    router.post('/settings/configs/:card', apiAuthMw, routes.settings_saveConfigs);
    router.get('/settings/banTemplates', apiAuthMw, routes.settings_getBanTemplates);
    router.post('/settings/banTemplates', apiAuthMw, routes.settings_saveBanTemplates);
    router.post('/settings/resetServerDataPath', apiAuthMw, routes.settings_resetServerDataPath);

    //Master Actions
    router.get('/masterActions/backupDatabase', webAuthMw, routes.masterActions_getBackup);
    router.post('/masterActions/:action', apiAuthMw, routes.masterActions_actions);

    //FXServer
    router.post('/fxserver/controls', apiAuthMw, wrapRoute('FxControls', routes.fxserver_controls));
    router.post('/fxserver/commands', apiAuthMw, wrapRoute('FxCommands', routes.fxserver_commands));
    router.post('/fxserver/schedule', apiAuthMw, routes.fxserver_schedule);
    router.get('/fxserver/artifacts', apiAuthMw, routes.fxserver_updateStatus);
    router.post(
        '/fxserver/artifacts/download',
        apiAuthMw,
        wrapRoute('FxUpdateDownload', routes.fxserver_updateDownload),
    );
    router.post('/fxserver/artifacts/apply', apiAuthMw, wrapRoute('FxUpdateApply', routes.fxserver_updateApply));

    //CFG Editor
    router.get('/cfgEditor/data', apiAuthMw, routes.cfgEditor_page);
    router.get('/cfgEditor/files', apiAuthMw, routes.cfgEditor_listFiles);
    router.post('/cfgEditor/save', apiAuthMw, routes.cfgEditor_save);

    //Resources
    router.get('/resources/list', apiAuthMw, wrapRoute('ResourcesList', routes.resources_list));

    //Control routes
    router.post('/intercom/:scope', intercomAuthMw, routes.intercom);

    //Diagnostic routes
    router.get('/diagnostics/data', apiAuthMw, routes.diagnostics_page);
    router.post('/diagnostics/sendReport', apiAuthMw, routes.diagnostics_sendReport);
    router.get('/advanced/data', apiAuthMw, routes.advanced_page);
    router.post('/advanced', apiAuthMw, routes.advanced_actions);

    //Log routes
    router.get('/logs/server/partial', apiAuthMw, wrapRoute('ServerLogPartial', routes.serverLogPartial));
    router.get('/logs/server/sessions', apiAuthMw, wrapRoute('ServerLogSessions', routes.serverLogSessions));
    router.get('/logs/server/session', apiAuthMw, wrapRoute('ServerLogSession', routes.serverLogSessionFile));
    router.get('/logs/server/download', webAuthMw, wrapRoute('ServerLogDownload', routes.downloadServerLog));
    router.get('/logs/system/partial', apiAuthMw, wrapRoute('SystemLogPartial', routes.systemLogPartial));
    router.get('/logs/system/sessions', apiAuthMw, wrapRoute('SystemLogSessions', routes.systemLogSessions));
    router.get('/logs/system/session', apiAuthMw, wrapRoute('SystemLogSession', routes.systemLogSessionFile));
    router.get('/logs/system/download', webAuthMw, wrapRoute('SystemLogDownload', routes.downloadSystemLog));
    router.get('/logs/system/:scope', apiAuthMw, wrapRoute('SystemLogScoped', routes.systemLogScoped));
    router.get('/logs/fxserver/download', webAuthMw, wrapRoute('FxLogDownload', routes.downloadFxserverLog));

    router.get('/perfChartData/:thread', apiAuthMw, routes.perfChart);
    router.get('/playerDropsData', apiAuthMw, routes.playerDrops);
    router.get('/insights/playerCount', apiAuthMw, routes.insights_playerCount);
    router.get('/insights/newPlayers', apiAuthMw, routes.insights_newPlayers);
    router.get('/insights/topPlayers', apiAuthMw, routes.insights_topPlayers);
    router.get('/insights/playtimeDist', apiAuthMw, routes.insights_playtimeDist);
    router.get('/insights/retention', apiAuthMw, routes.insights_retention);
    router.get('/insights/uptimeTimeline', apiAuthMw, routes.insights_uptimeTimeline);
    router.get('/insights/disconnectReasons', apiAuthMw, routes.insights_disconnectReasons);
    router.get('/insights/peakHours', apiAuthMw, routes.insights_peakHours);
    router.get('/insights/actionsTimeline', apiAuthMw, routes.insights_actionsTimeline);
    router.get('/insights/playerGrowth', apiAuthMw, routes.insights_playerGrowth);
    router.get('/insights/sessionLength', apiAuthMw, routes.insights_sessionLength);
    router.get('/insights/dailyPlayers', apiAuthMw, routes.insights_dailyPlayers);

    //History routes
    router.get('/history/stats', apiAuthMw, routes.history_stats);
    router.get('/history/search', apiAuthMw, wrapRoute('HistorySearch', routes.history_search));
    router.get('/history/action', apiAuthMw, routes.history_actionModal);
    router.post('/history/:action', apiAuthMw, routes.history_actions);

    //Player routes
    router.get('/player', apiAuthMw, routes.player_modal);
    router.get('/player/stats', apiAuthMw, routes.player_stats);
    router.get('/player/search', apiAuthMw, wrapRoute('PlayerSearch', routes.player_search));
    router.post('/player/checkJoin', intercomAuthMw, routes.player_checkJoin);
    router.post('/player/screenshot', apiAuthMw, routes.player_screenshot);
    router.post(
        '/player/liveSpectate/start',
        apiAuthMw,
        wrapRoute('LiveSpectateStart', routes.player_liveSpectate_start),
    );
    router.post('/player/liveSpectate/stop', apiAuthMw, wrapRoute('LiveSpectateStop', routes.player_liveSpectate_stop));
    router.post('/player/:action', apiAuthMw, routes.player_actions);
    router.get('/whitelist/:table', apiAuthMw, wrapRoute('WhitelistList', routes.whitelist_list));
    router.post('/whitelist/:table/:action', apiAuthMw, routes.whitelist_actions);

    //Report routes
    router.get('/reports/list', apiAuthMw, routes.reports_list);
    router.get('/reports/detail', apiAuthMw, routes.reports_detail);
    router.post('/reports/message', apiAuthMw, routes.reports_message);
    router.post('/reports/status', apiAuthMw, routes.reports_status);

    //Host routes
    router.get('/host/status', hostAuthMw, routes.host_status);

    //DevDebug routes - no auth
    if (txDevEnv.ENABLED) {
        router.get('/dev/:scope', routes.dev_get);
        router.post('/dev/:scope', routes.dev_post);
    }

    //Insights page mock
    // router.get('/insights', (ctx) => {
    //     return ctx.utils.render('main/insights', { headerTitle: 'Insights' });
    // });

    //Return router
    return router;
};
