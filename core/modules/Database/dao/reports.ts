import { DbInstance, SavePriority } from '../instance';
import { genReportID } from '../dbUtils';
import { now } from '@lib/misc';
import consoleFactory from '@lib/console';
import type {
    DatabaseReportType,
    ReportType,
    ReportStatus,
    ReportPlayerRef,
    ReportMessage,
    ReportLogEntry,
} from '@shared/reportApiTypes';
const console = consoleFactory('DatabaseDao');

/**
 * Data access object for the database "reports" collection.
 */
export default class ReportsDao {
    constructor(private readonly db: DbInstance) {}

    private get dbo() {
        if (!this.db.obj || !this.db.isReady) throw new Error(`database not ready yet`);
        return this.db.obj;
    }

    private get chain() {
        if (!this.db.obj || !this.db.isReady) throw new Error(`database not ready yet`);
        return this.db.obj.chain;
    }

    /**
     * Finds a report by its ID
     */
    findOne(reportId: string): DatabaseReportType | null {
        if (typeof reportId !== 'string' || !reportId.length) throw new Error('Invalid reportId.');
        const r = this.chain.get('reports').find({ id: reportId }).cloneDeep().value();
        return typeof r === 'undefined' ? null : r;
    }

    /**
     * Returns all reports, optionally filtered by status
     */
    findAll(statusFilter?: ReportStatus): DatabaseReportType[] {
        let query = this.chain.get('reports');
        if (statusFilter) {
            return query
                .filter((r: DatabaseReportType) => r.status === statusFilter)
                .cloneDeep()
                .value();
        }
        return query.cloneDeep().value();
    }

    /**
     * Returns all reports for a given player license
     */
    findByReporter(license: string): DatabaseReportType[] {
        return this.chain
            .get('reports')
            .filter((r: DatabaseReportType) => r.reporter.license === license)
            .cloneDeep()
            .value();
    }

    /**
     * Creates a new report and returns its ID
     */
    create(
        type: ReportType,
        reporter: ReportPlayerRef,
        targets: ReportPlayerRef[],
        reason: string,
        logContext: { reporter: ReportLogEntry[]; targets: ReportLogEntry[]; world: ReportLogEntry[] },
    ): string {
        if (typeof reason !== 'string' || !reason.length) throw new Error('Invalid reason.');

        const reportId = genReportID(this.dbo);
        const toDB: DatabaseReportType = {
            id: reportId,
            type,
            status: 'open',
            reporter,
            targets,
            reason,
            messages: [],
            logContext,
            tsCreated: now(),
            tsResolved: null,
            resolvedBy: null,
        };
        this.chain.get('reports').push(toDB).value();
        this.db.writeFlag(SavePriority.HIGH);
        return reportId;
    }

    /**
     * Updates the status of a report
     */
    updateStatus(reportId: string, status: ReportStatus, resolvedBy?: string): boolean {
        const report = this.chain.get('reports').find({ id: reportId }).value();
        if (!report) return false;

        report.status = status;
        if (status === 'resolved') {
            report.tsResolved = now();
            report.resolvedBy = resolvedBy ?? null;
        }
        this.db.writeFlag(SavePriority.MEDIUM);
        return true;
    }

    /**
     * Adds a message to a report
     */
    addMessage(reportId: string, message: ReportMessage): boolean {
        const report = this.chain.get('reports').find({ id: reportId }).value();
        if (!report) return false;

        report.messages.push(message);
        this.db.writeFlag(SavePriority.MEDIUM);
        return true;
    }

    /**
     * Removes resolved reports older than the retention period
     * @returns number of removed reports
     */
    removeExpiredResolved(retentionDays: number): number {
        const cutoff = now() - retentionDays * 24 * 60 * 60;
        const removed = this.chain
            .get('reports')
            .remove(
                (r: DatabaseReportType) => r.status === 'resolved' && r.tsResolved !== null && r.tsResolved < cutoff,
            )
            .value();
        if (removed.length > 0) {
            this.db.writeFlag(SavePriority.LOW);
        }
        return removed.length;
    }
}
