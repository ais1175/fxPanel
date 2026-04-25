import { useCallback, useEffect, useRef, useState } from 'react';
import { useBackendApi } from '@/hooks/fetch';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
    Loader2Icon,
    SendIcon,
    TicketIcon,
    MessageSquareIcon,
    ScrollTextIcon,
    InfoIcon,
    LockIcon,
    CheckCircle2Icon,
    PlayIcon,
    CircleIcon,
    XCircleIcon,
    UserCheckIcon,
    TrashIcon,
    ImageIcon,
    CopyIcon,
    ExternalLinkIcon,
} from 'lucide-react';
import { txToast } from '@/components/TxToaster';
import { useOpenPlayerModal } from '@/hooks/playerModal';
import type {
    ApiGetTicketDetailResp,
    ApiTicketMessageResp,
    ApiTicketStatusResp,
    ApiTicketNoteResp,
    ApiTicketClaimResp,
    DatabaseTicketType,
    MessageAuthorType,
    TicketStatus,
    TicketLogEntry,
    StaffNote,
    TicketMessage,
} from '@shared/ticketApiTypes';

const statusLabels: Record<TicketStatus, string> = {
    open: 'Open',
    inReview: 'In Review',
    resolved: 'Resolved',
    closed: 'Closed',
};

const statusVariants: Record<TicketStatus, 'default' | 'secondary' | 'outline-solid' | 'destructive'> = {
    open: 'destructive',
    inReview: 'default',
    resolved: 'secondary',
    closed: 'outline-solid',
};

/** Only allow https:// image URLs from trusted sources to prevent XSS/tracking via arbitrary URLs. */
const ALLOWED_IMAGE_ORIGINS = ['https://i.imgur.com', 'https://cdn.discordapp.com', 'https://media.discordapp.net'];
function isAllowedImageUrl(url: string): boolean {
    try {
        const parsed = new URL(url);
        return parsed.protocol === 'https:' && ALLOWED_IMAGE_ORIGINS.some((o) => parsed.origin === o);
    } catch {
        return false;
    }
}

export default function TicketDetailModal({
    ticketId,
    open,
    onOpenChange,
}: {
    ticketId: string;
    open: boolean;
    onOpenChange: (open: boolean) => void;
}) {
    const [ticket, setTicket] = useState<DatabaseTicketType | null>(null);
    const [loading, setLoading] = useState(true);
    const [messageText, setMessageText] = useState('');
    const [imageUrlInput, setImageUrlInput] = useState('');
    const [sendingMessage, setSendingMessage] = useState(false);
    const [changingStatus, setChangingStatus] = useState(false);
    const [claiming, setClaiming] = useState(false);
    const [noteText, setNoteText] = useState('');
    const [addingNote, setAddingNote] = useState(false);
    const [deletingNoteId, setDeletingNoteId] = useState<string | null>(null);
    const [lightboxUrl, setLightboxUrl] = useState<string | null>(null);
    const openPlayerModal = useOpenPlayerModal();

    const detailApi = useBackendApi<ApiGetTicketDetailResp>({ method: 'GET', path: '/reports/detail', abortOnUnmount: true });
    const messageApi = useBackendApi<ApiTicketMessageResp>({ method: 'POST', path: '/reports/message' });
    const statusApi = useBackendApi<ApiTicketStatusResp>({ method: 'POST', path: '/reports/status' });
    const claimApi = useBackendApi<ApiTicketClaimResp>({ method: 'POST', path: '/reports/claim' });
    const noteApi = useBackendApi<ApiTicketNoteResp>({ method: 'POST', path: '/reports/note' });
    const noteDeleteApi = useBackendApi<ApiTicketNoteResp>({ method: 'DELETE', path: '/reports/note' });

    // Tracks the latest in-flight fetchTicket invocation so callbacks from
    // stale requests (e.g. modal closed / ticketId changed) are ignored.
    const fetchSeqRef = useRef(0);

    const fetchTicket = useCallback(() => {
        const seq = ++fetchSeqRef.current;
        setLoading(true);
        detailApi({
            queryParams: { id: ticketId },
            success: (data) => {
                if (seq !== fetchSeqRef.current) return;
                if ('ticket' in data) setTicket(data.ticket);
            },
            error: (msg) => {
                if (seq !== fetchSeqRef.current) return;
                txToast.error(msg);
            },
            finally: () => {
                if (seq !== fetchSeqRef.current) return;
                setLoading(false);
            },
        });
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [ticketId]);

    useEffect(() => {
        if (open) fetchTicket();
        return () => {
            // Invalidate any in-flight request so its callbacks become no-ops
            // when the modal closes or the ticket changes.
            fetchSeqRef.current++;
        };
    }, [open, ticketId]);

    const handleSendMessage = () => {
        const hasContent = messageText.trim().length > 0;
        const hasImage = imageUrlInput.trim().length > 0;
        if (!hasContent && !hasImage) return;
        setSendingMessage(true);
        const imageUrls = imageUrlInput.trim() ? [imageUrlInput.trim()] : undefined;
        messageApi({
            data: { id: ticketId, content: messageText.trim(), imageUrls },
            success: () => {
                setMessageText('');
                setImageUrlInput('');
                fetchTicket();
            },
            error: (msg) => txToast.error(msg),
            finally: () => setSendingMessage(false),
        });
    };

    const handleStatusChange = (status: TicketStatus) => {
        setChangingStatus(true);
        statusApi({
            data: { id: ticketId, status },
            success: () => fetchTicket(),
            error: (msg) => txToast.error(msg),
            finally: () => setChangingStatus(false),
        });
    };

    const handleClaim = () => {
        setClaiming(true);
        claimApi({
            data: { id: ticketId },
            success: () => fetchTicket(),
            error: (msg) => txToast.error(msg),
            finally: () => setClaiming(false),
        });
    };

    const handleAddNote = () => {
        if (!noteText.trim()) return;
        setAddingNote(true);
        noteApi({
            data: { id: ticketId, content: noteText.trim() },
            success: () => {
                setNoteText('');
                fetchTicket();
            },
            error: (msg) => txToast.error(msg),
            finally: () => setAddingNote(false),
        });
    };

    const handleDeleteNote = (noteId: string) => {
        setDeletingNoteId(noteId);
        noteDeleteApi({
            data: { id: ticketId, noteId },
            success: () => fetchTicket(),
            error: (msg) => txToast.error(msg),
            finally: () => setDeletingNoteId(null),
        });
    };

    const formatDateTime = (ts: number) => {
        const d = new Date(ts * 1000);
        return d.toLocaleString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
    };

    const handlePlayerClick = (license: string) => {
        onOpenChange(false);
        openPlayerModal({ license });
    };

    const copyTicketLink = () => {
        const url = `${window.location.origin}/reports?ticket=${ticketId}`;
        navigator.clipboard.writeText(url).then(
            () => txToast.success('Link copied!'),
            (err) => {
                console.error('Failed to copy ticket link:', err);
                txToast.error('Failed to copy link');
            },
        );
    };

    const isResolved = ticket?.status === 'resolved' || ticket?.status === 'closed';

    return <>
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="flex max-h-[88vh] max-w-2xl flex-col">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <TicketIcon className="h-5 w-5" />
                        Ticket {ticketId}
                        {ticket && (
                            <Badge variant={statusVariants[ticket.status]} className="ml-1">
                                {statusLabels[ticket.status]}
                            </Badge>
                        )}
                    </DialogTitle>
                </DialogHeader>

                {/* Action bar */}
                {ticket && (
                    <div className="flex items-center gap-2 border-b pb-3">
                        {/* Claim */}
                        <Button
                            size="sm"
                            variant={ticket.claimedBy ? 'default' : 'outline-solid'}
                            onClick={handleClaim}
                            disabled={claiming}
                        >
                            {claiming ? (
                                <Loader2Icon className="h-3.5 w-3.5 animate-spin" />
                            ) : (
                                <UserCheckIcon className="mr-1 h-3.5 w-3.5" />
                            )}
                            {ticket.claimedBy ? `Claimed by ${ticket.claimedBy}` : 'Claim'}
                        </Button>

                        {/* Status changer */}
                        <Select
                            value={ticket.status}
                            onValueChange={(v) => handleStatusChange(v as TicketStatus)}
                            disabled={changingStatus}
                        >
                            <SelectTrigger className="w-[140px]">
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="open">Open</SelectItem>
                                <SelectItem value="inReview">In Review</SelectItem>
                                <SelectItem value="resolved">Resolved</SelectItem>
                                <SelectItem value="closed">Closed</SelectItem>
                            </SelectContent>
                        </Select>

                        <div className="flex-1" />

                        <Button size="sm" variant="ghost" onClick={copyTicketLink} title="Copy link">
                            <CopyIcon className="h-3.5 w-3.5" />
                        </Button>
                    </div>
                )}

                {loading ? (
                    <div className="flex justify-center py-8">
                        <Loader2Icon className="text-muted-foreground h-6 w-6 animate-spin" />
                    </div>
                ) : !ticket ? (
                    <p className="text-destructive py-8 text-center">Ticket not found.</p>
                ) : (
                    <Tabs defaultValue="conversation" className="flex min-h-0 flex-1 flex-col">
                        <TabsList className="w-full">
                            <TabsTrigger value="conversation" className="flex-1 gap-1">
                                <MessageSquareIcon className="h-3.5 w-3.5" />
                                Conversation
                            </TabsTrigger>
                            <TabsTrigger value="notes" className="flex-1 gap-1">
                                <LockIcon className="h-3.5 w-3.5" />
                                Staff Notes
                                {ticket.staffNotes?.length > 0 && (
                                    <Badge variant="secondary" className="ml-1 px-1 text-[10px]">
                                        {ticket.staffNotes.length}
                                    </Badge>
                                )}
                            </TabsTrigger>
                            <TabsTrigger value="logs" className="flex-1 gap-1">
                                <ScrollTextIcon className="h-3.5 w-3.5" />
                                Logs
                            </TabsTrigger>
                            <TabsTrigger value="info" className="flex-1 gap-1">
                                <InfoIcon className="h-3.5 w-3.5" />
                                Info
                            </TabsTrigger>
                        </TabsList>

                        {/* â”€â”€ Conversation â”€â”€ */}
                        <TabsContent value="conversation" className="mt-0 flex min-h-0 flex-1 flex-col">
                            <ScrollArea className="max-h-[380px] flex-1 px-1">
                                <div className="space-y-2 py-2">
                                    {/* Screenshot preview */}
                                    {ticket.screenshotUrl && (
                                        <div className="bg-muted/30 rounded-lg border p-2">
                                            <p className="text-muted-foreground mb-1 text-xs">In-game Screenshot</p>
                                            <img
                                                src={ticket.screenshotUrl}
                                                alt="ticket screenshot"
                                                className="max-h-48 w-full cursor-zoom-in rounded object-contain"
                                                onClick={() => setLightboxUrl(ticket.screenshotUrl!)}
                                            />
                                        </div>
                                    )}

                                    {/* Initial description */}
                                    <MessageBubble
                                        author={ticket.reporter.name}
                                        authorType="player"
                                        content={ticket.description}
                                        ts={ticket.tsCreated}
                                        formatDateTime={formatDateTime}
                                        isInitial
                                    />

                                    {/* Messages */}
                                    {ticket.messages.map((msg) => (
                                        <MessageBubble
                                            key={msg.id}
                                            author={msg.author}
                                            authorType={msg.authorType}
                                            content={msg.content}
                                            imageUrls={msg.imageUrls}
                                            ts={msg.ts}
                                            formatDateTime={formatDateTime}
                                            onImageClick={setLightboxUrl}
                                        />
                                    ))}

                                    {ticket.messages.length === 0 && (
                                        <p className="text-muted-foreground py-4 text-center text-sm">
                                            No replies yet.
                                        </p>
                                    )}
                                </div>
                            </ScrollArea>

                            {/* Reply box */}
                            {!isResolved && (
                                <div className="space-y-2 border-t pt-3">
                                    <div className="flex gap-2">
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
                                            maxLength={2048}
                                        />
                                        <Button
                                            size="icon"
                                            onClick={handleSendMessage}
                                            disabled={sendingMessage || (!messageText.trim() && !imageUrlInput.trim())}
                                        >
                                            {sendingMessage ? (
                                                <Loader2Icon className="h-4 w-4 animate-spin" />
                                            ) : (
                                                <SendIcon className="h-4 w-4" />
                                            )}
                                        </Button>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <ImageIcon className="text-muted-foreground h-3.5 w-3.5" />
                                        <Input
                                            placeholder="Image URL (optional)"
                                            value={imageUrlInput}
                                            onChange={(e) => setImageUrlInput(e.target.value)}
                                            className="text-xs"
                                        />
                                    </div>
                                </div>
                            )}
                        </TabsContent>

                        {/* â”€â”€ Staff Notes â”€â”€ */}
                        <TabsContent value="notes" className="mt-0 flex min-h-0 flex-1 flex-col">
                            <ScrollArea className="max-h-[340px] flex-1 px-1">
                                <div className="space-y-2 py-2">
                                    {(ticket.staffNotes?.length ?? 0) === 0 && (
                                        <p className="text-muted-foreground py-4 text-center text-sm">
                                            No staff notes yet.
                                        </p>
                                    )}
                                    {(ticket.staffNotes ?? []).map((note) => (
                                        <StaffNoteCard
                                            key={note.id}
                                            note={note}
                                            formatDateTime={formatDateTime}
                                            onDelete={() => handleDeleteNote(note.id)}
                                            deleting={deletingNoteId === note.id}
                                        />
                                    ))}
                                </div>
                            </ScrollArea>

                            <div className="flex gap-2 border-t pt-3">
                                <Textarea
                                    placeholder="Add a private staff note..."
                                    value={noteText}
                                    onChange={(e) => setNoteText(e.target.value)}
                                    rows={2}
                                    maxLength={2048}
                                    className="flex-1 resize-none text-sm"
                                />
                                <Button
                                    size="icon"
                                    onClick={handleAddNote}
                                    disabled={addingNote || !noteText.trim()}
                                    className="self-end"
                                >
                                    {addingNote ? (
                                        <Loader2Icon className="h-4 w-4 animate-spin" />
                                    ) : (
                                        <SendIcon className="h-4 w-4" />
                                    )}
                                </Button>
                            </div>
                        </TabsContent>

                        {/* â”€â”€ Logs â”€â”€ */}
                        <TabsContent value="logs" className="mt-0 min-h-0 flex-1">
                            <ScrollArea className="max-h-[450px]">
                                <div className="space-y-3 py-2">
                                    {ticket.logContext.reporter.length > 0 && (
                                        <LogSection title="Reporter Logs" entries={ticket.logContext.reporter} />
                                    )}
                                    {ticket.logContext.targets.length > 0 && (
                                        <LogSection title="Target Logs" entries={ticket.logContext.targets} />
                                    )}
                                    {ticket.logContext.world.length > 0 && (
                                        <LogSection title="World Events" entries={ticket.logContext.world} />
                                    )}
                                    {ticket.logContext.reporter.length === 0 &&
                                        ticket.logContext.targets.length === 0 &&
                                        ticket.logContext.world.length === 0 && (
                                            <p className="text-muted-foreground py-4 text-center text-sm">
                                                No log context was captured.
                                            </p>
                                        )}
                                </div>
                            </ScrollArea>
                        </TabsContent>

                        {/* â”€â”€ Info â”€â”€ */}
                        <TabsContent value="info" className="mt-0">
                            <div className="space-y-3 py-2">
                                <InfoRow label="Category" value={ticket.category} />
                                {ticket.priority && (
                                    <InfoRow label="Priority" value={ticket.priority.toUpperCase()} />
                                )}
                                <InfoRow label="Status" value={statusLabels[ticket.status]} />
                                <InfoRow label="Created" value={formatDateTime(ticket.tsCreated)} />
                                <InfoRow label="Last Activity" value={formatDateTime(ticket.tsLastActivity)} />
                                {ticket.tsResolved && (
                                    <InfoRow label="Resolved" value={formatDateTime(ticket.tsResolved)} />
                                )}
                                {ticket.resolvedBy && <InfoRow label="Resolved By" value={ticket.resolvedBy} />}
                                {ticket.claimedBy && <InfoRow label="Claimed By" value={ticket.claimedBy} />}
                                {ticket.feedback && (
                                    <InfoRow
                                        label="Feedback"
                                        value={`${'â˜…'.repeat(ticket.feedback.rating)}${'â˜†'.repeat(5 - ticket.feedback.rating)}${ticket.feedback.comment ? ` â€” ${ticket.feedback.comment}` : ''}`}
                                    />
                                )}

                                <div className="pt-2">
                                    <h4 className="mb-2 text-sm font-medium">Reporter</h4>
                                    <button
                                        className="text-primary cursor-pointer text-sm hover:underline"
                                        onClick={() => handlePlayerClick(ticket.reporter.license)}
                                    >
                                        {ticket.reporter.name}
                                        {ticket.reporter.netid && ` (#${ticket.reporter.netid})`}
                                    </button>
                                </div>

                                {ticket.targets.length > 0 && (
                                    <div className="pt-1">
                                        <h4 className="mb-2 text-sm font-medium">Target(s)</h4>
                                        <div className="space-y-1">
                                            {ticket.targets.map((t, i) => (
                                                <button
                                                    key={i}
                                                    className="text-primary block cursor-pointer text-sm hover:underline"
                                                    onClick={() => handlePlayerClick(t.license)}
                                                >
                                                    {t.name}
                                                    {t.netid && ` (#${t.netid})`}
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

        {/* Lightbox */}
        {lightboxUrl && (
            <Dialog open onOpenChange={() => setLightboxUrl(null)}>
                <DialogContent className="flex max-h-[95vh] max-w-5xl items-center justify-center bg-black/90 p-2">
                    <img
                        src={lightboxUrl}
                        alt="enlarged attachment"
                        referrerPolicy="no-referrer"
                        className="max-h-[90vh] max-w-full rounded object-contain"
                        onError={() => setLightboxUrl(null)}
                    />
                </DialogContent>
            </Dialog>
        )}
    </>;
}

// â”€â”€ Sub-components â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

function MessageBubble({
    author,
    authorType,
    content,
    imageUrls,
    ts,
    formatDateTime,
    isInitial = false,
    onImageClick,
}: {
    author: string;
    authorType: MessageAuthorType;
    content: string;
    imageUrls?: string[];
    ts: number;
    formatDateTime: (ts: number) => string;
    isInitial?: boolean;
    onImageClick?: (url: string) => void;
}) {
    return (
        <div
            className={`rounded-lg p-3 ${
                authorType === 'admin'
                    ? 'bg-primary/10 border-primary/20 ml-4 border'
                    : 'bg-muted/50 mr-4'
            } ${isInitial ? 'border-2' : ''}`}
        >
            <div className="mb-1 flex items-center gap-2">
                <span className="text-sm font-medium">{author}</span>
                <Badge variant="outline" className="px-1 py-0 text-[10px]">
                    {isInitial ? 'original' : authorType}
                </Badge>
                <span className="text-muted-foreground text-xs">{formatDateTime(ts)}</span>
            </div>
            {content && content.trim().length > 0 && (
                <p className="text-sm whitespace-pre-wrap">{content}</p>
            )}
            {imageUrls && imageUrls.length > 0 && (
                <div className="mt-2 flex flex-wrap gap-2">
                    {imageUrls.filter(isAllowedImageUrl).map((url, i) => (
                        <img
                            key={i}
                            src={url}
                            alt={`attachment ${i + 1}`}
                            referrerPolicy="no-referrer"
                            className="max-h-32 cursor-zoom-in rounded border object-contain"
                            onClick={() => onImageClick?.(url)}
                            onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                        />
                    ))}
                </div>
            )}
        </div>
    );
}

function StaffNoteCard({
    note,
    formatDateTime,
    onDelete,
    deleting,
}: {
    note: StaffNote;
    formatDateTime: (ts: number) => string;
    onDelete: () => void;
    deleting: boolean;
}) {
    return (
        <div className="bg-yellow-500/5 border-yellow-500/20 rounded-lg border p-3">
            <div className="mb-1 flex items-center justify-between">
                <div className="flex items-center gap-2">
                    <LockIcon className="h-3 w-3 text-yellow-500" />
                    <span className="text-sm font-medium">{note.authorName}</span>
                    <span className="text-muted-foreground text-xs">{formatDateTime(note.ts)}</span>
                </div>
                <Button
                    size="icon"
                    variant="ghost"
                    className="text-destructive h-6 w-6"
                    onClick={onDelete}
                    disabled={deleting}
                >
                    {deleting ? (
                        <Loader2Icon className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                        <TrashIcon className="h-3.5 w-3.5" />
                    )}
                </Button>
            </div>
            <p className="text-sm whitespace-pre-wrap">{note.content}</p>
        </div>
    );
}

function LogSection({ title, entries }: { title: string; entries: TicketLogEntry[] }) {
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
                            {entry.src.name && (
                                <span className="text-foreground/70 shrink-0">{entry.src.name}</span>
                            )}
                            <span className="truncate">{entry.msg}</span>
                        </div>
                    );
                })}
            </div>
        </div>
    );
}

function InfoRow({ label, value }: { label: string; value: string }) {
    return (
        <div className="flex items-center gap-2">
            <span className="text-muted-foreground min-w-[120px] text-sm">{label}:</span>
            <span className="text-sm">{value}</span>
        </div>
    );
}
