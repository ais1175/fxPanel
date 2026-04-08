import { useState } from 'react';
import useSWR from 'swr';
import { useBackendApi } from '@/hooks/fetch';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { FileTextIcon, Loader2Icon, SearchIcon, FilterIcon, ArchiveIcon, InboxIcon } from 'lucide-react';
import type { ApiGetReportsListResp, ReportListItem, ReportType, ReportStatus } from '@shared/reportApiTypes';
import ReportDetailModal from './ReportDetailModal';

const typeLabels: Record<ReportType, string> = {
    playerReport: 'Player Report',
    bugReport: 'Bug Report',
    question: 'Question / Help',
};

const statusLabels: Record<ReportStatus, string> = {
    open: 'Open',
    inReview: 'In Review',
    resolved: 'Resolved',
};

const statusVariants: Record<ReportStatus, 'default' | 'secondary' | 'outline-solid' | 'destructive'> = {
    open: 'destructive',
    inReview: 'default',
    resolved: 'secondary',
};

const typeColors: Record<ReportType, string> = {
    playerReport: 'text-red-400',
    bugReport: 'text-amber-400',
    question: 'text-blue-400',
};

export default function ReportsPage() {
    const [searchQuery, setSearchQuery] = useState('');
    const [typeFilter, setTypeFilter] = useState<string>('all');
    const [statusFilter, setStatusFilter] = useState<string>('all');
    const [selectedReportId, setSelectedReportId] = useState<string | null>(null);
    const [showArchive, setShowArchive] = useState(false);

    const listApi = useBackendApi<ApiGetReportsListResp>({
        method: 'GET',
        path: '/reports/list',
        throwGenericErrors: true,
    });

    const reportsSwr = useSWR(
        '/reports/list',
        async () => {
            const data = await listApi({});
            if (!data || 'error' in data) throw new Error('error' in data ? data.error : 'Failed to load');
            return data.reports;
        },
        { dedupingInterval: 5_000 },
    );

    const reports = reportsSwr.data ?? [];

    // Split into active and archived
    const activeReports = reports.filter((r) => r.status !== 'resolved');
    const archivedReports = reports.filter((r) => r.status === 'resolved');
    const baseList = showArchive ? archivedReports : activeReports;

    // Filter reports
    const filtered = baseList.filter((r) => {
        if (typeFilter !== 'all' && r.type !== typeFilter) return false;
        if (!showArchive && statusFilter !== 'all' && r.status !== statusFilter) return false;
        if (searchQuery) {
            const q = searchQuery.toLowerCase();
            return (
                r.id.toLowerCase().includes(q) ||
                r.reporter.name.toLowerCase().includes(q) ||
                r.reason.toLowerCase().includes(q) ||
                r.targets.some((t) => t.name.toLowerCase().includes(q))
            );
        }
        return true;
    });

    const formatDate = (ts: number) => {
        const d = new Date(ts * 1000);
        return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
    };

    return (
        <div className="flex w-full flex-col gap-4">
            <Card>
                <CardHeader className="pb-3">
                    <div className="flex items-center justify-between">
                        <CardTitle className="flex items-center gap-2">
                            <FileTextIcon className="h-5 w-5" />
                            {showArchive ? 'Archived Reports' : 'Reports'}
                            {!showArchive && activeReports.length > 0 && (
                                <Badge variant="secondary" className="ml-1">
                                    {activeReports.length} active
                                </Badge>
                            )}
                            {showArchive && archivedReports.length > 0 && (
                                <Badge variant="secondary" className="ml-1">
                                    {archivedReports.length} archived
                                </Badge>
                            )}
                        </CardTitle>
                        <div className="flex items-center gap-2">
                            <Button
                                variant={showArchive ? 'default' : 'outline-solid'}
                                size="sm"
                                onClick={() => {
                                    setShowArchive(!showArchive);
                                    setStatusFilter('all');
                                }}
                            >
                                {showArchive ? (
                                    <>
                                        <InboxIcon className="mr-1 h-4 w-4" /> Active
                                    </>
                                ) : (
                                    <>
                                        <ArchiveIcon className="mr-1 h-4 w-4" /> Archive
                                    </>
                                )}
                            </Button>
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={() => reportsSwr.mutate()}
                                disabled={reportsSwr.isLoading}
                            >
                                {reportsSwr.isLoading ? <Loader2Icon className="h-4 w-4 animate-spin" /> : 'Refresh'}
                            </Button>
                        </div>
                    </div>
                </CardHeader>
                <CardContent>
                    {/* Filters */}
                    <div className="mb-4 flex gap-2">
                        <div className="relative flex-1">
                            <SearchIcon className="text-muted-foreground absolute top-2.5 left-2.5 h-4 w-4" />
                            <Input
                                placeholder="Search reports..."
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                className="pl-8"
                            />
                        </div>
                        <Select value={typeFilter} onValueChange={setTypeFilter}>
                            <SelectTrigger className="w-[160px]">
                                <SelectValue placeholder="Type" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all">All Types</SelectItem>
                                <SelectItem value="playerReport">Player Report</SelectItem>
                                <SelectItem value="bugReport">Bug Report</SelectItem>
                                <SelectItem value="question">Question / Help</SelectItem>
                            </SelectContent>
                        </Select>
                        {!showArchive && (
                            <Select value={statusFilter} onValueChange={setStatusFilter}>
                                <SelectTrigger className="w-[140px]">
                                    <SelectValue placeholder="Status" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="all">All Status</SelectItem>
                                    <SelectItem value="open">Open</SelectItem>
                                    <SelectItem value="inReview">In Review</SelectItem>
                                </SelectContent>
                            </Select>
                        )}
                    </div>

                    {/* Reports list */}
                    {reportsSwr.isLoading ? (
                        <div className="flex justify-center py-8">
                            <Loader2Icon className="text-muted-foreground h-6 w-6 animate-spin" />
                        </div>
                    ) : reportsSwr.error ? (
                        <p className="text-destructive py-8 text-center">Reports route not available.</p>
                    ) : filtered.length === 0 ? (
                        <p className="text-muted-foreground py-8 text-center">
                            {baseList.length === 0
                                ? showArchive
                                    ? 'No archived reports.'
                                    : 'No reports found.'
                                : 'No reports match your filters.'}
                        </p>
                    ) : (
                        <div className="space-y-2">
                            {filtered.map((report) => (
                                <ReportRow
                                    key={report.id}
                                    report={report}
                                    formatDate={formatDate}
                                    onClick={() => setSelectedReportId(report.id)}
                                />
                            ))}
                        </div>
                    )}
                </CardContent>
            </Card>

            {/* Detail modal */}
            {selectedReportId && (
                <ReportDetailModal
                    reportId={selectedReportId}
                    open={!!selectedReportId}
                    onOpenChange={(open) => {
                        if (!open) {
                            setSelectedReportId(null);
                            reportsSwr.mutate();
                        }
                    }}
                />
            )}
        </div>
    );
}

function ReportRow({
    report,
    formatDate,
    onClick,
}: {
    report: ReportListItem;
    formatDate: (ts: number) => string;
    onClick: () => void;
}) {
    return (
        <button
            className="bg-card hover:bg-muted/50 w-full cursor-pointer rounded-lg border p-3 text-left transition-colors"
            onClick={onClick}
        >
            <div className="mb-1 flex items-center justify-between">
                <div className="flex items-center gap-2">
                    <span className="font-mono text-sm font-medium">{report.id}</span>
                    <Badge variant={statusVariants[report.status]}>{statusLabels[report.status]}</Badge>
                    <span className={`text-xs ${typeColors[report.type]}`}>{typeLabels[report.type]}</span>
                </div>
                <span className="text-muted-foreground text-xs">{formatDate(report.tsCreated)}</span>
            </div>
            <div className="flex items-center justify-between">
                <div className="text-sm">
                    <span className="text-muted-foreground">by </span>
                    <span className="font-medium">{report.reporter.name}</span>
                    {report.targets.length > 0 && (
                        <>
                            <span className="text-muted-foreground"> → </span>
                            <span className="font-medium">{report.targets.map((t) => t.name).join(', ')}</span>
                        </>
                    )}
                </div>
                <div className="text-muted-foreground flex items-center gap-2 text-xs">
                    {report.messageCount > 0 && (
                        <span>
                            {report.messageCount} message{report.messageCount !== 1 ? 's' : ''}
                        </span>
                    )}
                    {report.resolvedBy && <span>Resolved by {report.resolvedBy}</span>}
                </div>
            </div>
            <p className="text-muted-foreground mt-1 line-clamp-1 text-sm">{report.reason}</p>
        </button>
    );
}
