const modulename = 'WebServer:Reports';
import consoleFactory from '@lib/console';
import { AuthedCtx } from '@modules/WebServer/ctxTypes';
import { InitializedCtx } from '@modules/WebServer/ctxTypes';
import { now } from '@lib/misc';
import type {
    ApiGetReportsListResp,
    ApiGetReportDetailResp,
    ApiCreateReportReq,
    ApiCreateReportResp,
    ApiReportMessageResp,
    ApiReportStatusResp,
    ApiGetPlayerReportsResp,
    ReportListItem,
    ReportLogEntry,
    ReportStatus,
    reportStatuses,
    reportTypes,
} from '@shared/reportApiTypes';
const console = consoleFactory(modulename);

//Consts
const LOG_CONTEXT_WINDOW = 5 * 60; //5 minutes in seconds

/**
 * Pulls server log entries from the recent buffer within the time window
 */
const pullLogContext = (reporterNetid: number, targetNetids: number[], tsReport: number) => {
    const windowStart = tsReport - LOG_CONTEXT_WINDOW;
    const allLogs: any[] = txCore.logger.server.getRecentBuffer();

    const reporterLogs: ReportLogEntry[] = [];
    const targetLogs: ReportLogEntry[] = [];
    const worldLogs: ReportLogEntry[] = [];

    for (const entry of allLogs) {
        if (entry.ts < windowStart || entry.ts > tsReport) continue;

        const srcId = entry.src?.id;
        if (srcId !== false && String(srcId) === String(reporterNetid)) {
            reporterLogs.push(entry);
        } else if (srcId !== false && targetNetids.includes(Number(srcId))) {
            targetLogs.push(entry);
        } else if (entry.type === 'DeathNotice' || entry.type === 'explosionEvent' || entry.type === 'ChatMessage') {
            worldLogs.push(entry);
        }
    }

    return { reporter: reporterLogs, targets: targetLogs, world: worldLogs };
};

/**
 * GET /reports/list — Returns all reports (for web panel)
 */
export const reportsList = async (ctx: AuthedCtx) => {
    if (!txConfig.gameFeatures.reportsEnabled) {
        return ctx.send<ApiGetReportsListResp>({ error: 'Reports are disabled.' });
    }
    if (!ctx.admin.testPermission('players.reports', modulename)) {
        return ctx.send<ApiGetReportsListResp>({ error: 'Unauthorized' });
    }

    try {
        const allReports = txCore.database.reports.findAll();
        const reports: ReportListItem[] = allReports.map((r) => ({
            id: r.id,
            type: r.type,
            status: r.status,
            reporter: r.reporter,
            targets: r.targets,
            reason: r.reason,
            messageCount: r.messages.length,
            tsCreated: r.tsCreated,
            tsResolved: r.tsResolved,
            resolvedBy: r.resolvedBy,
        }));
        // newest first
        reports.sort((a, b) => b.tsCreated - a.tsCreated);
        return ctx.send<ApiGetReportsListResp>({ reports });
    } catch (error) {
        console.error(`Failed to list reports: ${emsg(error)}`);
        return ctx.send<ApiGetReportsListResp>({ error: 'Failed to list reports.' });
    }
};

/**
 * GET /reports/detail?id=xxx — Returns full report detail
 */
export const reportsDetail = async (ctx: AuthedCtx) => {
    if (!txConfig.gameFeatures.reportsEnabled) {
        return ctx.send<ApiGetReportDetailResp>({ error: 'Reports are disabled.' });
    }
    if (!ctx.admin.testPermission('players.reports', modulename)) {
        return ctx.send<ApiGetReportDetailResp>({ error: 'Unauthorized' });
    }

    const reportId = ctx.query?.id;
    if (typeof reportId !== 'string' || !reportId.length) {
        return ctx.send<ApiGetReportDetailResp>({ error: 'Invalid report ID.' });
    }

    try {
        const report = txCore.database.reports.findOne(reportId);
        if (!report) {
            return ctx.send<ApiGetReportDetailResp>({ error: 'Report not found.' });
        }
        return ctx.send<ApiGetReportDetailResp>({ report });
    } catch (error) {
        console.error(`Failed to get report detail: ${emsg(error)}`);
        return ctx.send<ApiGetReportDetailResp>({ error: 'Failed to get report.' });
    }
};

/**
 * POST /reports/message — Admin adds a message to a report
 */
export const reportsMessage = async (ctx: AuthedCtx) => {
    if (!txConfig.gameFeatures.reportsEnabled) {
        return ctx.send<ApiReportMessageResp>({ error: 'Reports are disabled.' });
    }
    if (!ctx.admin.testPermission('players.reports', modulename)) {
        return ctx.send<ApiReportMessageResp>({ error: 'Unauthorized' });
    }

    const { reportId, content } = ctx.request.body ?? {};
    if (typeof reportId !== 'string' || typeof content !== 'string' || !content.trim().length) {
        return ctx.send<ApiReportMessageResp>({ error: 'Invalid request.' });
    }

    try {
        const report = txCore.database.reports.findOne(reportId);
        if (!report) {
            return ctx.send<ApiReportMessageResp>({ error: 'Report not found.' });
        }

        const success = txCore.database.reports.addMessage(reportId, {
            author: ctx.admin.name,
            authorType: 'admin',
            content: content.trim(),
            ts: now(),
        });

        if (!success) {
            return ctx.send<ApiReportMessageResp>({ error: 'Failed to add message.' });
        }

        // If the report was open, move it to inReview
        if (report.status === 'open') {
            txCore.database.reports.updateStatus(reportId, 'inReview');
        }

        return ctx.send<ApiReportMessageResp>({ success: true });
    } catch (error) {
        console.error(`Failed to add report message: ${emsg(error)}`);
        return ctx.send<ApiReportMessageResp>({ error: 'Failed to add message.' });
    }
};

/**
 * POST /reports/status — Admin changes report status
 */
export const reportsStatus = async (ctx: AuthedCtx) => {
    if (!txConfig.gameFeatures.reportsEnabled) {
        return ctx.send<ApiReportStatusResp>({ error: 'Reports are disabled.' });
    }
    if (!ctx.admin.testPermission('players.reports', modulename)) {
        return ctx.send<ApiReportStatusResp>({ error: 'Unauthorized' });
    }

    const { reportId, status } = ctx.request.body ?? {};
    const validStatuses: ReportStatus[] = ['open', 'inReview', 'resolved'];
    if (typeof reportId !== 'string' || typeof status !== 'string' || !validStatuses.includes(status as ReportStatus)) {
        return ctx.send<ApiReportStatusResp>({ error: 'Invalid request.' });
    }

    try {
        const success = txCore.database.reports.updateStatus(
            reportId,
            status as ReportStatus,
            status === 'resolved' ? ctx.admin.name : undefined,
        );
        if (!success) {
            return ctx.send<ApiReportStatusResp>({ error: 'Report not found.' });
        }

        // Discord notification on resolve
        if (status === 'resolved') {
            const report = txCore.database.reports.findOne(reportId);
            if (report) {
                txCore.discordBot.sendAnnouncement({
                    type: 'success',
                    title: `Report ${reportId} Resolved`,
                    description: `**${report.reporter.name}**'s ${report.type === 'playerReport' ? 'player report' : report.type === 'bugReport' ? 'bug report' : 'question'} was resolved by **${ctx.admin.name}**.`,
                });
            }
        }

        return ctx.send<ApiReportStatusResp>({ success: true });
    } catch (error) {
        console.error(`Failed to update report status: ${emsg(error)}`);
        return ctx.send<ApiReportStatusResp>({ error: 'Failed to update status.' });
    }
};

/**
 * POST /intercom report handler — Called from the Lua resource when a player files a report
 */
export const reportsCreate = (reqBody: ApiCreateReportReq): ApiCreateReportResp => {
    if (!txConfig.gameFeatures.reportsEnabled) {
        return { error: 'Reports are disabled.' };
    }

    const { type, reporter, targets, reason } = reqBody;

    // Validate type
    const validTypes = ['playerReport', 'bugReport', 'question'];
    if (!validTypes.includes(type)) {
        return { error: 'Invalid report type.' };
    }
    if (typeof reporter?.license !== 'string' || typeof reporter?.name !== 'string') {
        return { error: 'Invalid reporter data.' };
    }
    if (typeof reason !== 'string' || !reason.trim().length) {
        return { error: 'Reason is required.' };
    }
    try {
        const tsNow = now();
        const targetNetids = (targets ?? []).map((t) => t.netid);
        const logContext = pullLogContext(reporter.netid, targetNetids, tsNow);

        const reportId = txCore.database.reports.create(type, reporter, targets ?? [], reason.trim(), logContext);

        // Discord notification
        const typeLabel =
            type === 'playerReport' ? 'Player Report' : type === 'bugReport' ? 'Bug Report' : 'Question / Help';
        const targetText = targets?.length ? `\n**Target(s):** ${targets.map((t) => t.name).join(', ')}` : '';
        txCore.discordBot.sendAnnouncement({
            type: 'warning',
            title: `New Report: ${reportId}`,
            description: `**Type:** ${typeLabel}\n**Reporter:** ${reporter.name}${targetText}\n**Reason:** ${reason.trim()}`,
        });

        // Notify online admins
        txCore.fxRunner.sendEvent('reportCreated', {
            reportId,
            type: typeLabel,
            reporterName: reporter.name,
            reason: reason.trim(),
        });

        return { reportId };
    } catch (error) {
        console.error(`Failed to create report: ${emsg(error)}`);
        return { error: 'Failed to create report.' };
    }
};

/**
 * GET /intercom playerReports handler — Returns player's own reports
 */
export const reportsPlayerList = (playerLicense: string): ApiGetPlayerReportsResp => {
    if (!txConfig.gameFeatures.reportsEnabled) {
        return { error: 'Reports are disabled.' };
    }
    if (typeof playerLicense !== 'string' || !playerLicense.length) {
        return { error: 'Invalid license.' };
    }

    try {
        const allReports = txCore.database.reports.findByReporter(playerLicense);
        const mapReport = (r: any) => ({
            id: r.id,
            type: r.type,
            status: r.status,
            reason: r.reason,
            messages: r.messages,
            tsCreated: r.tsCreated,
        });
        const reports = allReports.filter((r) => r.status !== 'resolved').map(mapReport);
        reports.sort((a, b) => b.tsCreated - a.tsCreated);
        const archivedReports = allReports.filter((r) => r.status === 'resolved').map(mapReport);
        archivedReports.sort((a, b) => b.tsCreated - a.tsCreated);
        return { reports, archivedReports };
    } catch (error) {
        console.error(`Failed to get player reports: ${emsg(error)}`);
        return { error: 'Failed to get reports.' };
    }
};

/**
 * POST /intercom playerMessage handler — Player sends a message on their report
 */
export const reportsPlayerMessage = (
    reportId: string,
    playerLicense: string,
    content: string,
): ApiReportMessageResp => {
    if (!txConfig.gameFeatures.reportsEnabled) {
        return { error: 'Reports are disabled.' };
    }
    if (typeof reportId !== 'string' || typeof content !== 'string' || !content.trim().length) {
        return { error: 'Invalid request.' };
    }

    try {
        const report = txCore.database.reports.findOne(reportId);
        if (!report) {
            return { error: 'Report not found.' };
        }

        // Ensure the player owns this report
        if (report.reporter.license !== playerLicense) {
            return { error: 'Not your report.' };
        }

        const success = txCore.database.reports.addMessage(reportId, {
            author: report.reporter.name,
            authorType: 'player',
            content: content.trim(),
            ts: now(),
        });

        if (!success) {
            return { error: 'Failed to add message.' };
        }

        return { success: true };
    } catch (error) {
        console.error(`Failed to add player message: ${emsg(error)}`);
        return { error: 'Failed to add message.' };
    }
};

// =============================================
// Admin intercom-callable functions (for NUI)
// =============================================

/**
 * Returns all reports (admin list) — called from intercom
 */
export const reportsAdminList = (): ApiGetReportsListResp => {
    if (!txConfig.gameFeatures.reportsEnabled) {
        return { error: 'Reports are disabled.' };
    }
    try {
        const allReports = txCore.database.reports.findAll();
        const reports: ReportListItem[] = allReports.map((r) => ({
            id: r.id,
            type: r.type,
            status: r.status,
            reporter: r.reporter,
            targets: r.targets,
            reason: r.reason,
            messageCount: r.messages.length,
            tsCreated: r.tsCreated,
            tsResolved: r.tsResolved,
            resolvedBy: r.resolvedBy,
        }));
        reports.sort((a, b) => b.tsCreated - a.tsCreated);
        return { reports };
    } catch (error) {
        console.error(`Failed to list reports (admin intercom): ${emsg(error)}`);
        return { error: 'Failed to list reports.' };
    }
};

/**
 * Returns full report detail — called from intercom
 */
export const reportsAdminDetail = (reportId: string): ApiGetReportDetailResp => {
    if (!txConfig.gameFeatures.reportsEnabled) {
        return { error: 'Reports are disabled.' };
    }
    if (typeof reportId !== 'string' || !reportId.length) {
        return { error: 'Invalid report ID.' };
    }
    try {
        const report = txCore.database.reports.findOne(reportId);
        if (!report) {
            return { error: 'Report not found.' };
        }
        return { report };
    } catch (error) {
        console.error(`Failed to get report detail (admin intercom): ${emsg(error)}`);
        return { error: 'Failed to get report.' };
    }
};

/**
 * Admin sends a message to a report — called from intercom
 */
export const reportsAdminMessage = (
    reportId: string,
    adminName: string,
    content: string,
): ApiReportMessageResp => {
    if (!txConfig.gameFeatures.reportsEnabled) {
        return { error: 'Reports are disabled.' };
    }
    if (typeof reportId !== 'string' || typeof content !== 'string' || !content.trim().length) {
        return { error: 'Invalid request.' };
    }
    try {
        const report = txCore.database.reports.findOne(reportId);
        if (!report) {
            return { error: 'Report not found.' };
        }
        const success = txCore.database.reports.addMessage(reportId, {
            author: adminName,
            authorType: 'admin',
            content: content.trim(),
            ts: now(),
        });
        if (!success) {
            return { error: 'Failed to add message.' };
        }
        if (report.status === 'open') {
            txCore.database.reports.updateStatus(reportId, 'inReview');
        }
        return { success: true };
    } catch (error) {
        console.error(`Failed to add admin message (intercom): ${emsg(error)}`);
        return { error: 'Failed to add message.' };
    }
};

/**
 * Admin changes report status — called from intercom
 */
export const reportsAdminStatus = (
    reportId: string,
    status: string,
    adminName: string,
): ApiReportStatusResp => {
    if (!txConfig.gameFeatures.reportsEnabled) {
        return { error: 'Reports are disabled.' };
    }
    const validStatuses: ReportStatus[] = ['open', 'inReview', 'resolved'];
    if (typeof reportId !== 'string' || !reportId.length || !validStatuses.includes(status as ReportStatus)) {
        return { error: 'Invalid request.' };
    }    try {
        const success = txCore.database.reports.updateStatus(
            reportId,
            status as ReportStatus,
            status === 'resolved' ? adminName : undefined,
        );
        if (!success) {
            return { error: 'Report not found.' };
        }
        if (status === 'resolved') {
            const report = txCore.database.reports.findOne(reportId);
            if (report) {
                txCore.discordBot.sendAnnouncement({
                    type: 'success',
                    title: `Report ${reportId} Resolved`,
                    description: `**${report.reporter.name}**'s ${report.type === 'playerReport' ? 'player report' : report.type === 'bugReport' ? 'bug report' : 'question'} was resolved by **${adminName}**.`,
                });
            }
        }
        return { success: true };
    } catch (error) {
        console.error(`Failed to update report status (intercom): ${emsg(error)}`);
        return { error: 'Failed to update status.' };
    }
};
