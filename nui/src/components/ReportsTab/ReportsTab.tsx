import React, { useCallback, useEffect, useState } from 'react';
import { styled } from '@mui/material/styles';
import {
    Box,
    Button,
    Chip,
    FormControl,
    IconButton,
    InputAdornment,
    InputLabel,
    MenuItem,
    Select,
    TextField,
    Typography,
} from '@mui/material';
import {
    ArrowBack,
    Archive,
    BugReport,
    CheckCircle,
    HelpOutline,
    Inbox,
    Person,
    PlayArrow,
    RadioButtonUnchecked,
    Refresh,
    Search,
    Send,
} from '@mui/icons-material';
import { useNuiEvent } from '../../hooks/useNuiEvent';
import { fetchNui } from '../../utils/fetchNui';
import { txAdminMenuPage, usePageValue } from '../../state/page.state';
import { theme } from '../../styles/theme';

// =============================================
// Types
// =============================================

type ReportType = 'playerReport' | 'bugReport' | 'question';
type ReportStatus = 'open' | 'inReview' | 'resolved';

interface ReportPlayerRef {
    license: string;
    name: string;
    netid: number;
}

interface ReportMessage {
    author: string;
    authorType: 'player' | 'admin';
    content: string;
    ts: number;
}

interface ReportListItem {
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
}

interface ReportDetail {
    id: string;
    type: ReportType;
    status: ReportStatus;
    reporter: ReportPlayerRef;
    targets: ReportPlayerRef[];
    reason: string;
    messages: ReportMessage[];
    tsCreated: number;
    tsResolved: number | null;
    resolvedBy: string | null;
}

// =============================================
// Styles
// =============================================

const RootStyled = styled(Box)({
    backgroundColor: theme.bg,
    color: theme.fg,
    height: '50vh',
    borderRadius: 15,
    flex: 1,
    flexDirection: 'column',
});

const ListContainer = styled(Box)({
    flex: 1,
    overflow: 'auto',
    display: 'flex',
    flexDirection: 'column',
    gap: 6,
});

// =============================================
// Helpers
// =============================================

const TYPE_LABELS: Record<ReportType, string> = {
    playerReport: 'Player Report',
    bugReport: 'Bug Report',
    question: 'Question / Help',
};

const TYPE_COLORS: Record<ReportType, string> = {
    playerReport: theme.destructive,
    bugReport: theme.warning,
    question: theme.info,
};

const STATUS_CHIP_COLORS: Record<ReportStatus, { bg: string; border: string; text: string }> = {
    open: { bg: 'rgba(255, 174, 0, 0.12)', border: theme.warning, text: theme.warning },
    inReview: { bg: 'rgba(43, 155, 197, 0.12)', border: theme.info, text: theme.info },
    resolved: { bg: 'rgba(1, 163, 112, 0.12)', border: theme.success, text: theme.success },
};

const STATUS_LABELS: Record<ReportStatus, string> = {
    open: 'Open',
    inReview: 'In Review',
    resolved: 'Resolved',
};

function formatDate(ts: number): string {
    const d = new Date(ts * 1000);
    return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
}

// =============================================
// Status Chip
// =============================================

const StatusChip: React.FC<{ status: ReportStatus }> = ({ status }) => {
    const colors = STATUS_CHIP_COLORS[status];
    return (
        <Chip
            label={STATUS_LABELS[status]}
            size="small"
            variant="outlined"
            sx={{
                height: 20,
                fontSize: '0.7rem',
                color: colors.text,
                borderColor: colors.border,
                bgcolor: colors.bg,
            }}
        />
    );
};

// =============================================
// Detail View
// =============================================

const ReportDetailView: React.FC<{
    report: ReportDetail;
    onBack: () => void;
    onSendMessage: (content: string) => void;
    onStatusChange: (status: ReportStatus) => void;
    sendingMessage: boolean;
    changingStatus: boolean;
}> = ({ report, onBack, onSendMessage, onStatusChange, sendingMessage, changingStatus }) => {
    const [msgText, setMsgText] = useState('');

    const handleSend = () => {
        if (!msgText.trim()) return;
        onSendMessage(msgText.trim());
        setMsgText('');
    };

    return (
        <Box display="flex" flexDirection="column" height="100%" color={theme.fg}>
            {/* Header */}
            <Box display="flex" alignItems="center" gap={1} mb={1}>
                <IconButton size="small" onClick={onBack} sx={{ color: theme.fg }}>
                    <ArrowBack fontSize="small" />
                </IconButton>
                <Typography variant="subtitle2" fontWeight={600} sx={{ color: theme.fg }}>
                    Report {report.id}
                </Typography>
                <StatusChip status={report.status} />
            </Box>

            {/* Info bar */}
            <Box mb={1} p={1} sx={{ border: `1px solid ${theme.border}`, borderRadius: 1, bgcolor: theme.card }}>
                <Box display="flex" flexWrap="wrap" gap={1} alignItems="center" mb={0.5}>
                    <Typography variant="caption" sx={{ color: TYPE_COLORS[report.type] }}>
                        {TYPE_LABELS[report.type]}
                    </Typography>
                    <Typography variant="caption" sx={{ color: theme.muted }}>·</Typography>
                    <Typography variant="caption" sx={{ color: theme.muted }}>
                        by <strong style={{ color: theme.fg }}>{report.reporter.name}</strong> (#{report.reporter.netid})
                    </Typography>
                    {report.targets.length > 0 && (
                        <>
                            <Typography variant="caption" sx={{ color: theme.muted }}>→</Typography>
                            <Typography variant="caption" sx={{ color: theme.muted }}>
                                {report.targets.map((t) => `${t.name} (#${t.netid})`).join(', ')}
                            </Typography>
                        </>
                    )}
                </Box>
                <Typography variant="body2" sx={{ wordBreak: 'break-word', color: theme.fg }}>
                    {report.reason}
                </Typography>
                <Typography variant="caption" sx={{ color: theme.muted }} mt={0.5} display="block">
                    Created {formatDate(report.tsCreated)}
                    {report.tsResolved ? ` · Resolved ${formatDate(report.tsResolved)}` : ''}
                    {report.resolvedBy ? ` by ${report.resolvedBy}` : ''}
                </Typography>
            </Box>

            {/* Messages */}
            <Box flex={1} overflow="auto" display="flex" flexDirection="column" gap={0.75} mb={1}>
                {/* Initial report as first message */}
                <Box sx={{ p: 1, borderRadius: 1, bgcolor: theme.card }}>
                    <Box display="flex" justifyContent="space-between" alignItems="center" mb={0.25}>
                        <Typography variant="caption" fontWeight={600} sx={{ color: theme.fg }}>
                            {report.reporter.name}
                        </Typography>
                        <Typography variant="caption" sx={{ color: theme.muted }}>
                            {formatDate(report.tsCreated)}
                        </Typography>
                    </Box>
                    <Typography variant="body2" sx={{ wordBreak: 'break-word', color: theme.fg }}>
                        {report.reason}
                    </Typography>
                </Box>

                {report.messages.map((m, i) => (
                    <Box
                        key={i}
                        sx={{
                            p: 1,
                            borderRadius: 1,
                            bgcolor: m.authorType === 'admin' ? `${theme.info}14` : theme.card,
                            borderLeft: m.authorType === 'admin' ? `3px solid ${theme.info}` : '3px solid transparent',
                            ml: m.authorType === 'admin' ? 2 : 0,
                            mr: m.authorType === 'admin' ? 0 : 2,
                        }}
                    >
                        <Box display="flex" justifyContent="space-between" alignItems="center" mb={0.25}>
                            <Typography variant="caption" fontWeight={600} sx={{ color: theme.fg }}>
                                {m.author}
                                {m.authorType === 'admin' && (
                                    <Chip
                                        label="Staff"
                                        size="small"
                                        sx={{
                                            ml: 0.5,
                                            height: 16,
                                            fontSize: '0.65rem',
                                            color: theme.info,
                                            borderColor: theme.info,
                                            bgcolor: `${theme.info}1A`,
                                        }}
                                        variant="outlined"
                                    />
                                )}
                            </Typography>
                            <Typography variant="caption" sx={{ color: theme.muted }}>
                                {formatDate(m.ts)}
                            </Typography>
                        </Box>
                        <Typography variant="body2" sx={{ wordBreak: 'break-word', color: theme.fg }}>
                            {m.content}
                        </Typography>
                    </Box>
                ))}

                {report.messages.length === 0 && (
                    <Typography variant="body2" sx={{ color: theme.muted }} textAlign="center" py={2}>
                        No messages yet. Send a reply below.
                    </Typography>
                )}
            </Box>

            {/* Reply box */}
            {report.status !== 'resolved' && (
                <Box display="flex" gap={1} mb={1}>
                    <TextField
                        size="small"
                        fullWidth
                        placeholder="Type a reply..."
                        value={msgText}
                        onChange={(e) => setMsgText(e.target.value.slice(0, 512))}                        onKeyDown={(e) => {
                            if (e.key === 'Enter' && !e.shiftKey) {
                                e.preventDefault();
                                handleSend();
                            }
                        }}
                        disabled={sendingMessage}
                        sx={{
                            '& .MuiInputBase-input': { color: theme.fg },
                            '& .MuiOutlinedInput-root': {
                                '& fieldset': { borderColor: theme.border },
                                '&:hover fieldset': { borderColor: theme.muted },
                            },
                        }}
                    />
                    <IconButton onClick={handleSend} disabled={sendingMessage || !msgText.trim()} size="small" sx={{ color: theme.info }}>
                        <Send />
                    </IconButton>
                </Box>
            )}

            {/* Status controls */}
            <Box display="flex" alignItems="center" justifyContent="flex-end" gap={1}>
                {report.status === 'open' && (
                    <Button
                        size="small"
                        variant="outlined"
                        startIcon={<PlayArrow />}
                        onClick={() => onStatusChange('inReview')}
                        disabled={changingStatus}
                        sx={{ textTransform: 'none', color: theme.info, borderColor: theme.info }}
                    >
                        Start Review
                    </Button>
                )}
                {report.status !== 'resolved' && (
                    <Button
                        size="small"
                        variant="contained"
                        startIcon={<CheckCircle />}
                        onClick={() => onStatusChange('resolved')}
                        disabled={changingStatus}
                        sx={{ textTransform: 'none', bgcolor: theme.success, color: '#fff', '&:hover': { bgcolor: '#00875c' } }}
                    >
                        Resolve
                    </Button>
                )}
                {report.status === 'resolved' && (
                    <Button
                        size="small"
                        variant="outlined"
                        startIcon={<RadioButtonUnchecked />}
                        onClick={() => onStatusChange('open')}
                        disabled={changingStatus}
                        sx={{ textTransform: 'none', color: theme.muted, borderColor: theme.border }}
                    >
                        Reopen
                    </Button>
                )}
            </Box>
        </Box>
    );
};

// =============================================
// Main Reports Tab (Admin View)
// =============================================

export const ReportsTab: React.FC<{ visible: boolean }> = ({ visible }) => {
    const curPage = usePageValue();

    // List state
    const [reports, setReports] = useState<ReportListItem[]>([]);
    const [loading, setLoading] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const [typeFilter, setTypeFilter] = useState<string>('all');
    const [statusFilter, setStatusFilter] = useState<string>('all');
    const [showArchive, setShowArchive] = useState(false);

    // Detail state
    const [selectedReportId, setSelectedReportId] = useState<string | null>(null);
    const [reportDetail, setReportDetail] = useState<ReportDetail | null>(null);
    const [detailLoading, setDetailLoading] = useState(false);
    const [sendingMessage, setSendingMessage] = useState(false);
    const [changingStatus, setChangingStatus] = useState(false);
    const [reportError, setReportError] = useState<string | null>(null);

    const handleRefresh = useCallback(() => {
        setLoading(true);
        fetchNui('reportAdminList').catch(() => setLoading(false));
    }, []);

    // Fetch all reports when tab becomes visible
    useEffect(() => {
        if (curPage !== txAdminMenuPage.Reports) return;
        handleRefresh();
    }, [curPage, handleRefresh]);

    // Listen for admin report list
    useNuiEvent<{ reports?: ReportListItem[]; error?: string }>('reportAdminListData', (data) => {
        setLoading(false);
        if (data.error) {
            setReportError(data.error);
            return;
        }
        setReportError(null);
        if (data.reports) setReports(data.reports);
    });

    // Listen for admin report detail
    useNuiEvent<{ report?: ReportDetail; error?: string }>('reportAdminDetailData', (data) => {
        setDetailLoading(false);
        if (data.error) {
            setReportError(data.error);
            return;
        }
        setReportError(null);
        if (data.report) setReportDetail(data.report);
    });

    // Listen for admin message result
    useNuiEvent<{ success?: boolean; error?: string }>('reportAdminMessageResult', (data) => {
        setSendingMessage(false);
        if (data.error) {
            setReportError(data.error);
            return;
        }
        setReportError(null);
        if (data.success && selectedReportId) {
            setDetailLoading(true);
            fetchNui('reportAdminDetail', { reportId: selectedReportId }).catch(() => setDetailLoading(false));
        }
    });

    // Listen for admin status result
    useNuiEvent<{ success?: boolean; error?: string }>('reportAdminStatusResult', (data) => {
        setChangingStatus(false);
        if (data.error) {
            setReportError(data.error);
            return;
        }
        setReportError(null);
        if (data.success && selectedReportId) {
            setDetailLoading(true);
            fetchNui('reportAdminDetail', { reportId: selectedReportId }).catch(() => setDetailLoading(false));
            fetchNui('reportAdminList').catch(() => {});
        }
    });

    const handleOpenDetail = (reportId: string) => {
        setSelectedReportId(reportId);
        setReportDetail(null);
        setDetailLoading(true);
        fetchNui('reportAdminDetail', { reportId }).catch(() => setDetailLoading(false));
    };

    const handleBack = () => {
        setSelectedReportId(null);
        setReportDetail(null);
        handleRefresh();
    };

    const handleSendMessage = (content: string) => {
        if (!selectedReportId) return;
        setSendingMessage(true);
        fetchNui('reportAdminMessage', { reportId: selectedReportId, content }).catch(() => setSendingMessage(false));
    };

    const handleStatusChange = (status: ReportStatus) => {
        if (!selectedReportId) return;
        setChangingStatus(true);
        fetchNui('reportAdminStatus', { reportId: selectedReportId, status }).catch(() => setChangingStatus(false));
    };

    // Filter logic
    const activeReports = reports.filter((r) => r.status !== 'resolved');
    const archivedReports = reports.filter((r) => r.status === 'resolved');
    const baseList = showArchive ? archivedReports : activeReports;

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

    return (
        <RootStyled mt={2} mb={10} pt={2} px={2} display={visible ? 'flex' : 'none'}>
            {/* Error banner */}
            {reportError && (
                <Box
                    sx={{
                        backgroundColor: theme.destructive + '22',
                        border: `1px solid ${theme.destructive}`,
                        borderRadius: 1,
                        px: 2,
                        py: 1,
                        mb: 1,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                    }}
                >
                    <Typography variant="body2" sx={{ color: theme.destructive }}>
                        {reportError}
                    </Typography>
                    <IconButton size="small" onClick={() => setReportError(null)} sx={{ color: theme.destructive }}>
                        &times;
                    </IconButton>
                </Box>
            )}
            {/* Detail view */}
            {selectedReportId !== null ? (
                detailLoading || !reportDetail ? (
                    <Box display="flex" justifyContent="center" alignItems="center" flex={1}>
                        <Typography variant="body2" sx={{ color: theme.muted }}>Loading report...</Typography>
                    </Box>
                ) : (
                    <ReportDetailView
                        report={reportDetail}
                        onBack={handleBack}
                        onSendMessage={handleSendMessage}
                        onStatusChange={handleStatusChange}
                        sendingMessage={sendingMessage}
                        changingStatus={changingStatus}
                    />
                )
            ) : (
                /* List view */
                <>
                    {/* Header */}
                    <Box display="flex" alignItems="center" justifyContent="space-between" mb={1}>
                        <Box display="flex" alignItems="center" gap={1}>
                            <Typography variant="subtitle2" fontWeight={600} sx={{ color: theme.fg }}>
                                {showArchive ? 'Archived Reports' : 'Reports'}
                            </Typography>
                            <Chip
                                label={`${showArchive ? archivedReports.length : activeReports.length} ${showArchive ? 'archived' : 'active'}`}
                                size="small"
                                variant="outlined"
                                sx={{ color: theme.muted, borderColor: theme.border }}
                            />
                        </Box>
                        <Box display="flex" gap={0.5}>
                            <IconButton
                                size="small"
                                onClick={() => { setShowArchive(!showArchive); setStatusFilter('all'); }}
                                title={showArchive ? 'Show active' : 'Show archive'}
                                sx={{ color: theme.muted }}
                            >
                                {showArchive ? <Inbox fontSize="small" /> : <Archive fontSize="small" />}
                            </IconButton>
                            <IconButton size="small" onClick={handleRefresh} disabled={loading} title="Refresh" sx={{ color: theme.muted }}>
                                <Refresh fontSize="small" />
                            </IconButton>
                        </Box>
                    </Box>

                    {/* Filters */}
                    <Box display="flex" gap={1} mb={1}>
                        <TextField
                            size="small"
                            placeholder="Search..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            sx={{
                                flex: 1,
                                '& .MuiInputBase-input': { color: theme.fg },
                                '& .MuiInputBase-input::placeholder': { color: theme.muted, opacity: 1 },
                                '& .MuiOutlinedInput-root': {
                                    '& fieldset': { borderColor: theme.border },
                                    '&:hover fieldset': { borderColor: theme.muted },
                                },
                            }}
                            InputProps={{
                                startAdornment: (
                                    <InputAdornment position="start">
                                        <Search fontSize="small" sx={{ color: theme.muted }} />
                                    </InputAdornment>
                                ),
                            }}
                        />
                        <FormControl size="small" sx={{ minWidth: 110 }}>
                            <InputLabel sx={{ color: theme.muted }}>Type</InputLabel>
                            <Select
                                value={typeFilter}
                                label="Type"
                                onChange={(e) => setTypeFilter(e.target.value)}
                                sx={{
                                    color: theme.fg,
                                    '& .MuiOutlinedInput-notchedOutline': { borderColor: theme.border },
                                    '&:hover .MuiOutlinedInput-notchedOutline': { borderColor: theme.muted },
                                    '& .MuiSvgIcon-root': { color: theme.muted },
                                }}
                            >
                                <MenuItem value="all">All Types</MenuItem>
                                <MenuItem value="playerReport">Player Report</MenuItem>
                                <MenuItem value="bugReport">Bug Report</MenuItem>
                                <MenuItem value="question">Question</MenuItem>
                            </Select>
                        </FormControl>
                        {!showArchive && (
                            <FormControl size="small" sx={{ minWidth: 100 }}>
                                <InputLabel sx={{ color: theme.muted }}>Status</InputLabel>
                                <Select
                                    value={statusFilter}
                                    label="Status"
                                    onChange={(e) => setStatusFilter(e.target.value)}
                                    sx={{
                                        color: theme.fg,
                                        '& .MuiOutlinedInput-notchedOutline': { borderColor: theme.border },
                                        '&:hover .MuiOutlinedInput-notchedOutline': { borderColor: theme.muted },
                                        '& .MuiSvgIcon-root': { color: theme.muted },
                                    }}
                                >
                                    <MenuItem value="all">All</MenuItem>
                                    <MenuItem value="open">Open</MenuItem>
                                    <MenuItem value="inReview">In Review</MenuItem>
                                </Select>
                            </FormControl>
                        )}
                    </Box>

                    {/* Report list */}
                    <ListContainer>
                        {loading ? (
                            <Box textAlign="center" py={4}>
                                <Typography variant="body2" sx={{ color: theme.muted }}>Loading reports...</Typography>
                            </Box>
                        ) : filtered.length === 0 ? (
                            <Box textAlign="center" py={4}>
                                <Typography variant="body2" sx={{ color: theme.muted }}>
                                    {baseList.length === 0
                                        ? showArchive ? 'No archived reports.' : 'No reports found.'
                                        : 'No reports match your filters.'}
                                </Typography>
                            </Box>
                        ) : (
                            filtered.map((r) => (
                                <Box
                                    key={r.id}
                                    onClick={() => handleOpenDetail(r.id)}
                                    sx={{
                                        p: 1.5,
                                        borderRadius: 1,
                                        border: `1px solid ${theme.border}`,
                                        bgcolor: theme.card,
                                        cursor: 'pointer',
                                        '&:hover': { bgcolor: '#232738' },
                                    }}
                                >
                                    {/* Row 1: id, status, type, date */}
                                    <Box display="flex" alignItems="center" justifyContent="space-between" mb={0.25}>
                                        <Box display="flex" alignItems="center" gap={1}>
                                            <Typography variant="caption" fontFamily="monospace" fontWeight={600} sx={{ color: theme.fg }}>
                                                {r.id}
                                            </Typography>
                                            <StatusChip status={r.status} />
                                            <Typography variant="caption" sx={{ color: TYPE_COLORS[r.type] }}>
                                                {TYPE_LABELS[r.type]}
                                            </Typography>
                                        </Box>
                                        <Typography variant="caption" sx={{ color: theme.muted }}>
                                            {formatDate(r.tsCreated)}
                                        </Typography>
                                    </Box>
                                    {/* Row 2: reporter → targets */}
                                    <Box display="flex" alignItems="center" justifyContent="space-between">
                                        <Box>
                                            <Typography component="span" variant="body2" sx={{ color: theme.muted }}>by </Typography>
                                            <Typography component="span" variant="body2" fontWeight={600} sx={{ color: theme.fg }}>{r.reporter.name}</Typography>
                                            {r.targets.length > 0 && (
                                                <>
                                                    <Typography component="span" variant="body2" sx={{ color: theme.muted }}> → </Typography>
                                                    <Typography component="span" variant="body2" fontWeight={600} sx={{ color: theme.fg }}>
                                                        {r.targets.map((t) => t.name).join(', ')}
                                                    </Typography>
                                                </>
                                            )}
                                        </Box>
                                        <Box display="flex" gap={1}>
                                            {r.messageCount > 0 && (
                                                <Typography variant="caption" sx={{ color: theme.muted }}>
                                                    {r.messageCount} msg{r.messageCount !== 1 ? 's' : ''}
                                                </Typography>
                                            )}
                                            {r.resolvedBy && (
                                                <Typography variant="caption" sx={{ color: theme.muted }}>
                                                    by {r.resolvedBy}
                                                </Typography>
                                            )}
                                        </Box>
                                    </Box>
                                    {/* Row 3: reason */}
                                    <Typography variant="body2" noWrap mt={0.25} sx={{ color: theme.muted }}>
                                        {r.reason}
                                    </Typography>
                                </Box>
                            ))
                        )}
                    </ListContainer>
                </>
            )}
        </RootStyled>
    );
};
