/**
 * Shared types for the Reports system.
 */

// ── Report categories ──
export const reportTypes = ['playerReport', 'bugReport', 'question'] as const;
export type ReportType = (typeof reportTypes)[number];

export const reportTypeLabels: Record<ReportType, string> = {
    playerReport: 'Player Report',
    bugReport: 'Bug Report',
    question: 'Question / Help',
};

// ── Report statuses ──
export const reportStatuses = ['open', 'inReview', 'resolved'] as const;
export type ReportStatus = (typeof reportStatuses)[number];

export const reportStatusLabels: Record<ReportStatus, string> = {
    open: 'Open',
    inReview: 'In Review',
    resolved: 'Resolved',
};

// ── Database types ──
export type ReportPlayerRef = {
    license: string;
    name: string;
    netid: number;
};

export type ReportMessage = {
    author: string;
    authorType: 'player' | 'admin';
    content: string;
    ts: number;
};

export type ReportLogEntry = {
    ts: number;
    type: string;
    src: { id: string | false; name: string };
    msg: string;
};

export type DatabaseReportType = {
    id: string;
    type: ReportType;
    status: ReportStatus;
    reporter: ReportPlayerRef;
    targets: ReportPlayerRef[];
    reason: string;
    messages: ReportMessage[];
    logContext: {
        reporter: ReportLogEntry[];
        targets: ReportLogEntry[];
        world: ReportLogEntry[];
    };
    tsCreated: number;
    tsResolved: number | null;
    resolvedBy: string | null;
};

// ── API types ──

// GET /reports/list
export type ReportListItem = {
    id: string;
    type: ReportType;
    status: ReportStatus;
    reporter: ReportPlayerRef;
    targets: ReportPlayerRef[];
    reason: string;
    messageCount: number;
    tsCreated: number;
    tsResolved: number | null;
    resolvedBy: string | null;
};
export type ApiGetReportsListResp = { reports: ReportListItem[] } | { error: string };

// GET /reports/detail?id=xxx
export type ApiGetReportDetailResp = { report: DatabaseReportType } | { error: string };

// POST /reports/create (from intercom)
export type ApiCreateReportReq = {
    type: ReportType;
    reporter: ReportPlayerRef;
    targets: ReportPlayerRef[];
    reason: string;
};
export type ApiCreateReportResp = { reportId: string } | { error: string };

// POST /reports/message
export type ApiReportMessageReq = {
    reportId: string;
    content: string;
};
export type ApiReportMessageResp = { success: true } | { error: string };

// POST /reports/status
export type ApiReportStatusReq = {
    reportId: string;
    status: ReportStatus;
};
export type ApiReportStatusResp = { success: true } | { error: string };

// GET /reports/playerReports?license=xxx (for NUI - player's own reports)
export type PlayerReportSummary = {
    id: string;
    type: ReportType;
    status: ReportStatus;
    reason: string;
    messages: ReportMessage[];
    tsCreated: number;
};
export type ApiGetPlayerReportsResp = { reports: PlayerReportSummary[] } | { error: string };

// POST /reports/playerMessage (from intercom - player sends a message)
export type ApiPlayerReportMessageReq = {
    reportId: string;
    playerLicense: string;
    content: string;
};
