import { useEffect, useState } from 'react';
import { useBackendApi } from '@/hooks/fetch';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
    Loader2Icon,
    SendIcon,
    FileTextIcon,
    MessageSquareIcon,
    ScrollTextIcon,
    CheckCircle2Icon,
    PlayIcon,
    CircleIcon,
} from 'lucide-react';
import { txToast } from '@/components/txToaster';
import { useOpenPlayerModal } from '@/hooks/playerModal';
import type {
    ApiGetReportDetailResp,
    ApiReportMessageResp,
    ApiReportStatusResp,
    DatabaseReportType,
    ReportStatus,
    ReportLogEntry,
} from '@shared/reportApiTypes';

const statusLabels: Record<ReportStatus, string> = {
    open: 'Open',
    inReview: 'In Review',
    resolved: 'Resolved',
};

const typeLabels: Record<string, string> = {
    playerReport: 'Player Report',
    bugReport: 'Bug Report',
    question: 'Question / Help',
};

export default function ReportDetailModal({
    reportId,
    open,
    onOpenChange,
}: {
    reportId: string;
    open: boolean;
    onOpenChange: (open: boolean) => void;
}) {
    const [report, setReport] = useState<DatabaseReportType | null>(null);
    const [loading, setLoading] = useState(true);
    const [messageText, setMessageText] = useState('');
    const [sendingMessage, setSendingMessage] = useState(false);
    const [changingStatus, setChangingStatus] = useState(false);
    const openPlayerModal = useOpenPlayerModal();

    const detailApi = useBackendApi<ApiGetReportDetailResp>({
        method: 'GET',
        path: '/reports/detail',
    });
    const messageApi = useBackendApi<ApiReportMessageResp>({
        method: 'POST',
        path: '/reports/message',
    });
    const statusApi = useBackendApi<ApiReportStatusResp>({
        method: 'POST',
        path: '/reports/status',
    });

    const fetchReport = () => {
        setLoading(true);
        detailApi({
            queryParams: { id: reportId },
            success: (data) => {
                if ('report' in data) setReport(data.report);
            },
            error: (msg) => txToast.error(msg),
            finally: () => setLoading(false),
        });
    };

    useEffect(() => {
        if (open) fetchReport();
    }, [open, reportId]);

    const handleSendMessage = () => {
        if (!messageText.trim()) return;
        setSendingMessage(true);
        messageApi({
            data: { reportId, content: messageText.trim() },
            success: () => {
                setMessageText('');
                fetchReport();
            },
            error: (msg) => txToast.error(msg),
            finally: () => setSendingMessage(false),
        });
    };

    const handleStatusChange = (status: ReportStatus) => {
        setChangingStatus(true);
        statusApi({
            data: { reportId, status },
            success: () => fetchReport(),
            error: (msg) => txToast.error(msg),
            finally: () => setChangingStatus(false),
        });
    };

    const formatDateTime = (ts: number) => {
        const d = new Date(ts * 1000);
        return d.toLocaleString(undefined, {
            month: 'short',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
        });
    };

    const handlePlayerClick = (license: string) => {
        onOpenChange(false);
        openPlayerModal({ license });
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="flex max-h-[85vh] max-w-2xl flex-col">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <FileTextIcon className="h-5 w-5" />
                        Report {reportId}
                    </DialogTitle>
                </DialogHeader>

                {loading ? (
                    <div className="flex justify-center py-8">
                        <Loader2Icon className="text-muted-foreground h-6 w-6 animate-spin" />
                    </div>
                ) : !report ? (
                    <p className="text-destructive py-8 text-center">Report not found.</p>
                ) : (
                    <Tabs defaultValue="conversation" className="flex min-h-0 flex-1 flex-col">
                        <TabsList className="w-full">
                            <TabsTrigger value="conversation" className="flex-1 gap-1">
                                <MessageSquareIcon className="h-3.5 w-3.5" />
                                Conversation
                            </TabsTrigger>
                            <TabsTrigger value="logs" className="flex-1 gap-1">
                                <ScrollTextIcon className="h-3.5 w-3.5" />
                                Logs
                            </TabsTrigger>
                            <TabsTrigger value="info" className="flex-1 gap-1">
                                <FileTextIcon className="h-3.5 w-3.5" />
                                Info
                            </TabsTrigger>
                        </TabsList>

                        {/* Conversation */}
                        <TabsContent value="conversation" className="mt-0 flex min-h-0 flex-1 flex-col">
                            <ScrollArea className="max-h-[400px] flex-1 px-1">
                                <div className="space-y-2 py-2">
                                    {/* Initial report */}
                                    <div className="bg-muted/50 rounded-lg p-3">
                                        <div className="mb-1 flex items-center gap-2">
                                            <span className="text-sm font-medium">{report.reporter.name}</span>
                                            <span className="text-muted-foreground text-xs">
                                                {formatDateTime(report.tsCreated)}
                                            </span>
                                        </div>
                                        <p className="text-sm">{report.reason}</p>
                                    </div>

                                    {/* Messages */}
                                    {report.messages.map((msg, i) => (
                                        <div
                                            key={i}
                                            className={`rounded-lg p-3 ${
                                                msg.authorType === 'admin'
                                                    ? 'bg-primary/10 border-primary/20 ml-4 border'
                                                    : 'bg-muted/50 mr-4'
                                            }`}
                                        >
                                            <div className="mb-1 flex items-center gap-2">
                                                <span className="text-sm font-medium">{msg.author}</span>
                                                <Badge variant="outline" className="px-1 py-0 text-[10px]">
                                                    {msg.authorType}
                                                </Badge>
                                                <span className="text-muted-foreground text-xs">
                                                    {formatDateTime(msg.ts)}
                                                </span>
                                            </div>
                                            <p className="text-sm">{msg.content}</p>
                                        </div>
                                    ))}

                                    {report.messages.length === 0 && (
                                        <p className="text-muted-foreground py-4 text-center text-sm">
                                            No messages yet. Send a reply below.
                                        </p>
                                    )}
                                </div>
                            </ScrollArea>

                            {/* Reply box */}
                            {report.status !== 'resolved' && (
                                <div className="flex gap-2 border-t pt-3">
                                    <Input
                                        placeholder="Type a reply..."
                                        value={messageText}
                                        onChange={(e) => setMessageText(e.target.value)}
                                        onKeyDown={(e) => {
                                            if (e.key === 'Enter' && !e.shiftKey) {
                                                e.preventDefault();
                                                handleSendMessage();
                                            }
                                        }}
                                        maxLength={500}
                                    />
                                    <Button
                                        size="icon"
                                        onClick={handleSendMessage}
                                        disabled={sendingMessage || !messageText.trim()}
                                    >
                                        {sendingMessage ? (
                                            <Loader2Icon className="h-4 w-4 animate-spin" />
                                        ) : (
                                            <SendIcon className="h-4 w-4" />
                                        )}
                                    </Button>
                                </div>
                            )}

                            {/* Status controls */}
                            <div className="flex items-center justify-between pt-3">
                                <div className="flex items-center gap-2">
                                    <span className="text-muted-foreground text-sm">Status:</span>
                                    <Badge>{statusLabels[report.status]}</Badge>
                                </div>
                                <div className="flex gap-1.5">
                                    {report.status === 'open' && (
                                        <Button
                                            size="sm"
                                            variant="outline"
                                            onClick={() => handleStatusChange('inReview')}
                                            disabled={changingStatus}
                                        >
                                            <PlayIcon className="mr-1 h-3.5 w-3.5" />
                                            Start Review
                                        </Button>
                                    )}
                                    {report.status !== 'resolved' && (
                                        <Button
                                            size="sm"
                                            variant="default"
                                            onClick={() => handleStatusChange('resolved')}
                                            disabled={changingStatus}
                                        >
                                            <CheckCircle2Icon className="mr-1 h-3.5 w-3.5" />
                                            Resolve
                                        </Button>
                                    )}
                                    {report.status === 'resolved' && (
                                        <Button
                                            size="sm"
                                            variant="outline"
                                            onClick={() => handleStatusChange('open')}
                                            disabled={changingStatus}
                                        >
                                            <CircleIcon className="mr-1 h-3.5 w-3.5" />
                                            Reopen
                                        </Button>
                                    )}
                                </div>
                            </div>
                        </TabsContent>

                        {/* Logs */}
                        <TabsContent value="logs" className="mt-0 min-h-0 flex-1">
                            <ScrollArea className="max-h-[450px]">
                                <div className="space-y-3 py-2">
                                    {report.logContext.reporter.length > 0 && (
                                        <LogSection title="Reporter Logs" entries={report.logContext.reporter} />
                                    )}
                                    {report.logContext.targets.length > 0 && (
                                        <LogSection title="Target Logs" entries={report.logContext.targets} />
                                    )}
                                    {report.logContext.world.length > 0 && (
                                        <LogSection title="World Events" entries={report.logContext.world} />
                                    )}
                                    {report.logContext.reporter.length === 0 &&
                                        report.logContext.targets.length === 0 &&
                                        report.logContext.world.length === 0 && (
                                            <p className="text-muted-foreground py-4 text-center text-sm">
                                                No log context was captured for this report.
                                            </p>
                                        )}
                                </div>
                            </ScrollArea>
                        </TabsContent>

                        {/* Info */}
                        <TabsContent value="info" className="mt-0">
                            <div className="space-y-3 py-2">
                                <InfoRow label="Type" value={typeLabels[report.type] ?? report.type} />
                                <InfoRow label="Status" value={statusLabels[report.status]} />
                                <InfoRow label="Created" value={formatDateTime(report.tsCreated)} />
                                {report.tsResolved && (
                                    <InfoRow label="Resolved" value={formatDateTime(report.tsResolved)} />
                                )}
                                {report.resolvedBy && <InfoRow label="Resolved By" value={report.resolvedBy} />}

                                <div className="pt-2">
                                    <h4 className="mb-2 text-sm font-medium">Reporter</h4>
                                    <button
                                        className="text-primary cursor-pointer text-sm hover:underline"
                                        onClick={() => handlePlayerClick(report.reporter.license)}
                                    >
                                        {report.reporter.name} (#{report.reporter.netid})
                                    </button>
                                </div>

                                {report.targets.length > 0 && (
                                    <div className="pt-1">
                                        <h4 className="mb-2 text-sm font-medium">Target(s)</h4>
                                        <div className="space-y-1">
                                            {report.targets.map((t, i) => (
                                                <button
                                                    key={i}
                                                    className="text-primary block cursor-pointer text-sm hover:underline"
                                                    onClick={() => handlePlayerClick(t.license)}
                                                >
                                                    {t.name} (#{t.netid})
                                                </button>
                                            ))}
                                        </div>
                                    </div>
                                )}
                            </div>
                        </TabsContent>
                    </Tabs>
                )}
            </DialogContent>
        </Dialog>
    );
}

function LogSection({ title, entries }: { title: string; entries: ReportLogEntry[] }) {
    return (
        <div>
            <h4 className="text-muted-foreground mb-1.5 text-xs font-medium">{title}</h4>
            <div className="bg-muted/30 space-y-0.5 rounded-lg border p-2">
                {entries.map((entry, i) => {
                    const time = new Date(entry.ts * 1000).toLocaleTimeString([], {
                        hour: '2-digit',
                        minute: '2-digit',
                        second: '2-digit',
                    });
                    return (
                        <div key={i} className="flex gap-2 font-mono text-xs">
                            <span className="text-muted-foreground shrink-0">{time}</span>
                            <span className="text-muted-foreground shrink-0">[{entry.type}]</span>
                            {entry.src.id !== false && (
                                <span className="text-muted-foreground shrink-0">#{entry.src.id}</span>
                            )}
                            <span className="break-all">{entry.msg}</span>
                        </div>
                    );
                })}
            </div>
        </div>
    );
}

function InfoRow({ label, value }: { label: string; value: string }) {
    return (
        <div className="flex items-center justify-between">
            <span className="text-muted-foreground text-sm">{label}</span>
            <span className="text-sm font-medium">{value}</span>
        </div>
    );
}
