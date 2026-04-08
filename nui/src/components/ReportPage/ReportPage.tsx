import React, { useCallback, useEffect, useState } from 'react';
import { styled } from '@mui/material/styles';
import {
    Box,
    Button,
    Chip,
    FormControl,
    IconButton,
    InputLabel,
    MenuItem,
    Select,
    TextField,
    Typography,
} from '@mui/material';
import {
    BugReport,
    Chat,
    Close,
    HelpOutline,
    Person,
    Send,
} from '@mui/icons-material';
import { useNuiEvent } from '../../hooks/useNuiEvent';
import { fetchNui } from '../../utils/fetchNui';
import { useSetListenForExit } from '../../state/keys.state';

// =============================================
// Types
// =============================================

type ReportType = 'playerReport' | 'bugReport' | 'question';
type ReportStatus = 'open' | 'inReview' | 'resolved';

interface ReportMessage {
    author: string;
    authorType: 'player' | 'admin';
    content: string;
    ts: number;
}

interface PlayerReportSummary {
    id: string;
    type: ReportType;
    status: ReportStatus;
    reason: string;
    messages: ReportMessage[];
    tsCreated: number;
}

interface PlayerTarget {
    id: number;
    name: string;
}

type View = 'menu' | 'create' | 'list' | 'detail';

// =============================================
// Styles
// =============================================

const Overlay = styled(Box)({
    position: 'fixed',
    top: 0,
    left: 0,
    width: '100vw',
    height: '100vh',
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.85)',
    zIndex: 9999,
});

const Panel = styled(Box)(({ theme }) => ({
    width: 480,
    maxHeight: '80vh',
    background: theme.palette.background.default,
    borderRadius: 12,
    border: `1px solid ${theme.palette.divider}`,
    display: 'flex',
    flexDirection: 'column',
    overflow: 'hidden',
}));

const Header = styled(Box)(({ theme }) => ({
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '14px 18px',
    borderBottom: `1px solid ${theme.palette.divider}`,
}));

const Content = styled(Box)({
    flex: 1,
    overflow: 'auto',
    padding: '16px 18px',
});

const Footer = styled(Box)(({ theme }) => ({
    padding: '12px 18px',
    borderTop: `1px solid ${theme.palette.divider}`,
    display: 'flex',
    gap: 8,
}));

// =============================================
// Helpers
// =============================================

const TYPE_LABELS: Record<ReportType, string> = {
    playerReport: 'Player Report',
    bugReport: 'Bug Report',
    question: 'Question / Help',
};

const TYPE_ICONS: Record<ReportType, React.ReactNode> = {
    playerReport: <Person fontSize="small" />,
    bugReport: <BugReport fontSize="small" />,
    question: <HelpOutline fontSize="small" />,
};

const STATUS_COLORS: Record<ReportStatus, 'warning' | 'info' | 'success'> = {
    open: 'warning',
    inReview: 'info',
    resolved: 'success',
};

const STATUS_LABELS: Record<ReportStatus, string> = {
    open: 'Open',
    inReview: 'In Review',
    resolved: 'Resolved',
};

function timeAgo(ts: number): string {
    const diff = Math.floor((Date.now() - ts) / 1000);
    if (diff < 60) return 'just now';
    if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
    if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
    return `${Math.floor(diff / 86400)}d ago`;
}

// =============================================
// Sub-components
// =============================================

const MenuView: React.FC<{
    onSelect: (view: View) => void;
    reportCount: number;
}> = ({ onSelect, reportCount }) => (
    <Box display="flex" flexDirection="column" gap={1.5}>
        <Typography variant="body2" color="textSecondary" mb={1}>
            What would you like to do?
        </Typography>
        <Button
            variant="outlined"
            startIcon={<Person />}
            onClick={() => onSelect('create')}
            sx={{ justifyContent: 'flex-start', textTransform: 'none', py: 1.2 }}
        >
            File a New Report
        </Button>
        <Button
            variant="outlined"
            startIcon={<Chat />}
            onClick={() => onSelect('list')}
            sx={{ justifyContent: 'flex-start', textTransform: 'none', py: 1.2 }}
        >
            My Reports {reportCount > 0 && `(${reportCount})`}
        </Button>
    </Box>
);

const CreateView: React.FC<{
    players: PlayerTarget[];
    onSubmit: (type: ReportType, reason: string, targetIds: number[]) => void;
    submitting: boolean;
}> = ({ players, onSubmit, submitting }) => {
    const [type, setType] = useState<ReportType>('playerReport');
    const [reason, setReason] = useState('');
    const [selectedTargets, setSelectedTargets] = useState<number[]>([]);

    const handleSubmit = () => {
        if (!reason.trim()) return;
        onSubmit(type, reason.trim(), selectedTargets);
    };

    return (
        <Box display="flex" flexDirection="column" gap={2}>
            <FormControl size="small" fullWidth>
                <InputLabel>Report Type</InputLabel>
                <Select
                    value={type}
                    label="Report Type"
                    onChange={(e) => {
                        setType(e.target.value as ReportType);
                        if (e.target.value !== 'playerReport') setSelectedTargets([]);
                    }}
                >
                    <MenuItem value="playerReport">
                        <Box display="flex" alignItems="center" gap={1}>
                            <Person fontSize="small" /> Player Report
                        </Box>
                    </MenuItem>
                    <MenuItem value="bugReport">
                        <Box display="flex" alignItems="center" gap={1}>
                            <BugReport fontSize="small" /> Bug Report
                        </Box>
                    </MenuItem>
                    <MenuItem value="question">
                        <Box display="flex" alignItems="center" gap={1}>
                            <HelpOutline fontSize="small" /> Question / Help
                        </Box>
                    </MenuItem>
                </Select>
            </FormControl>

            {type === 'playerReport' && players.length > 0 && (
                <FormControl size="small" fullWidth>
                    <InputLabel>Target Player(s)</InputLabel>
                    <Select
                        multiple
                        value={selectedTargets}
                        label="Target Player(s)"
                        onChange={(e) => setSelectedTargets(e.target.value as number[])}
                        renderValue={(selected) =>
                            selected.map((id) => {
                                const p = players.find((p) => p.id === id);
                                return p ? p.name : `#${id}`;
                            }).join(', ')
                        }
                    >
                        {players.map((p) => (
                            <MenuItem key={p.id} value={p.id}>
                                [{p.id}] {p.name}
                            </MenuItem>
                        ))}
                    </Select>
                </FormControl>
            )}

            <TextField
                label="Description"
                multiline
                minRows={3}
                maxRows={6}
                value={reason}
                onChange={(e) => setReason(e.target.value.slice(0, 512))}
                placeholder="Describe your report..."
                size="small"
                fullWidth
                helperText={`${reason.length}/512`}
            />

            <Button
                variant="contained"
                onClick={handleSubmit}
                disabled={submitting || !reason.trim()}
                sx={{ textTransform: 'none' }}
            >
                {submitting ? 'Submitting...' : 'Submit Report'}
            </Button>
        </Box>
    );
};

const ListView: React.FC<{
    reports: PlayerReportSummary[];
    onSelect: (report: PlayerReportSummary) => void;
}> = ({ reports, onSelect }) => {
    if (reports.length === 0) {
        return (
            <Box textAlign="center" py={4}>
                <Typography variant="body2" color="textSecondary">
                    You have no reports.
                </Typography>
            </Box>
        );
    }

    return (
        <Box display="flex" flexDirection="column" gap={1}>
            {reports.map((r) => (
                <Box
                    key={r.id}
                    onClick={() => onSelect(r)}
                    sx={{
                        p: 1.5,
                        borderRadius: 1,
                        border: '1px solid',
                        borderColor: 'divider',
                        cursor: 'pointer',
                        '&:hover': { bgcolor: 'action.hover' },
                        display: 'flex',
                        flexDirection: 'column',
                        gap: 0.5,
                    }}
                >
                    <Box display="flex" alignItems="center" justifyContent="space-between">
                        <Box display="flex" alignItems="center" gap={1}>
                            {TYPE_ICONS[r.type]}
                            <Typography variant="body2" fontWeight={600}>
                                {TYPE_LABELS[r.type]}
                            </Typography>
                        </Box>
                        <Chip
                            label={STATUS_LABELS[r.status]}
                            color={STATUS_COLORS[r.status]}
                            size="small"
                            variant="outlined"
                        />
                    </Box>
                    <Typography variant="body2" color="textSecondary" noWrap>
                        {r.reason}
                    </Typography>
                    <Typography variant="caption" color="textSecondary">
                        {timeAgo(r.tsCreated)} · {r.messages.length} message{r.messages.length !== 1 ? 's' : ''}
                    </Typography>
                </Box>
            ))}
        </Box>
    );
};

const DetailView: React.FC<{
    report: PlayerReportSummary;
    onSendMessage: (reportId: string, content: string) => void;
    sending: boolean;
}> = ({ report, onSendMessage, sending }) => {
    const [msg, setMsg] = useState('');

    const handleSend = () => {
        if (!msg.trim()) return;
        onSendMessage(report.id, msg.trim());
        setMsg('');
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleSend();
        }
    };

    return (
        <Box display="flex" flexDirection="column" height="100%">
            {/* Report header info */}
            <Box mb={2}>
                <Box display="flex" alignItems="center" gap={1} mb={0.5}>
                    {TYPE_ICONS[report.type]}
                    <Typography variant="body2" fontWeight={600}>
                        {TYPE_LABELS[report.type]}
                    </Typography>
                    <Chip
                        label={STATUS_LABELS[report.status]}
                        color={STATUS_COLORS[report.status]}
                        size="small"
                        variant="outlined"
                    />
                </Box>
                <Typography variant="body2" color="textSecondary" sx={{ wordBreak: 'break-word' }}>
                    {report.reason}
                </Typography>
            </Box>

            {/* Messages */}
            <Box
                flex={1}
                overflow="auto"
                display="flex"
                flexDirection="column"
                gap={1}
                mb={2}
                sx={{ maxHeight: 300 }}
            >
                {report.messages.length === 0 ? (
                    <Typography variant="body2" color="textSecondary" textAlign="center" py={2}>
                        No messages yet. An admin will respond to your report.
                    </Typography>
                ) : (
                    report.messages.map((m, i) => (
                        <Box
                            key={i}
                            sx={{
                                p: 1,
                                borderRadius: 1,
                                bgcolor: m.authorType === 'admin' ? 'rgba(38, 175, 217, 0.1)' : 'action.hover',
                                borderLeft: m.authorType === 'admin' ? '3px solid #26afd9' : '3px solid transparent',
                            }}
                        >
                            <Box display="flex" justifyContent="space-between" alignItems="center" mb={0.25}>
                                <Typography variant="caption" fontWeight={600}>
                                    {m.author}
                                    {m.authorType === 'admin' && (
                                        <Chip
                                            label="Staff"
                                            size="small"
                                            color="info"
                                            sx={{ ml: 0.5, height: 16, fontSize: '0.65rem' }}
                                        />
                                    )}
                                </Typography>
                                <Typography variant="caption" color="textSecondary">
                                    {timeAgo(m.ts)}
                                </Typography>
                            </Box>
                            <Typography variant="body2" sx={{ wordBreak: 'break-word' }}>
                                {m.content}
                            </Typography>
                        </Box>
                    ))
                )}
            </Box>

            {/* Message input */}
            {report.status !== 'resolved' && (
                <Box display="flex" gap={1}>
                    <TextField
                        size="small"
                        fullWidth
                        placeholder="Type a message..."
                        value={msg}
                        onChange={(e) => setMsg(e.target.value.slice(0, 512))}
                        onKeyDown={handleKeyDown}
                        disabled={sending}
                    />
                    <IconButton
                        color="primary"
                        onClick={handleSend}
                        disabled={sending || !msg.trim()}
                        size="small"
                    >
                        <Send />
                    </IconButton>
                </Box>
            )}
            {report.status === 'resolved' && (
                <Typography variant="body2" color="success.main" textAlign="center">
                    This report has been resolved.
                </Typography>
            )}
        </Box>
    );
};

// =============================================
// Main Report Page
// =============================================

export const ReportPage: React.FC = () => {
    const [isOpen, setIsOpen] = useState(false);
    const [view, setView] = useState<View>('menu');
    const [players, setPlayers] = useState<PlayerTarget[]>([]);
    const [reports, setReports] = useState<PlayerReportSummary[]>([]);
    const [selectedReport, setSelectedReport] = useState<PlayerReportSummary | null>(null);
    const [submitting, setSubmitting] = useState(false);
    const [sendingMessage, setSendingMessage] = useState(false);
    const setListenForExit = useSetListenForExit();

    const handleClose = useCallback(() => {
        setIsOpen(false);
        setView('menu');
        setSelectedReport(null);
        setListenForExit(true);
        fetchNui('reportClose').catch(() => {});
    }, [setListenForExit]);

    // Listen for open event from Lua
    useNuiEvent<{ players: PlayerTarget[] }>('openReportUI', (data) => {
        setPlayers(data.players || []);
        setIsOpen(true);
        setView('menu');
        setListenForExit(false);
    });

    // Listen for report list updates
    useNuiEvent<{ reports: PlayerReportSummary[] }>('reportMyList', (data) => {
        setReports(data.reports || []);
        // If we're viewing a report, update its data
        if (selectedReport) {
            const updated = (data.reports || []).find((r) => r.id === selectedReport.id);
            if (updated) setSelectedReport(updated);
        }
    });

    // Listen for report creation result
    useNuiEvent<{ success?: boolean; reportId?: string; error?: string }>('reportCreateResult', (data) => {
        setSubmitting(false);
        if (data.success) {
            // Go to list view and refresh
            fetchNui('reportFetchMine').catch(() => {});
            setView('list');
        }
    });

    // Listen for message send result
    useNuiEvent<{ success?: boolean; error?: string }>('reportMessageResult', (data) => {
        setSendingMessage(false);
        if (data.success) {
            fetchNui('reportFetchMine').catch(() => {});
        }
    });

    // ESC to close (when not in a sub-view)
    useEffect(() => {
        if (!isOpen) return;
        const handler = (e: KeyboardEvent) => {
            if (e.key === 'Escape') {
                if (view === 'detail') {
                    setView('list');
                    setSelectedReport(null);
                } else if (view === 'create' || view === 'list') {
                    setView('menu');
                } else {
                    handleClose();
                }
            }
        };
        window.addEventListener('keydown', handler);
        return () => window.removeEventListener('keydown', handler);
    }, [isOpen, view, handleClose]);

    const handleSubmit = (type: ReportType, reason: string, targetIds: number[]) => {
        setSubmitting(true);
        fetchNui('reportSubmit', { type, reason, targetIds }).catch(() => {
            setSubmitting(false);
        });
    };

    const handleSendMessage = (reportId: string, content: string) => {
        setSendingMessage(true);
        fetchNui('reportSendMessage', { reportId, content }).catch(() => {
            setSendingMessage(false);
        });
    };

    const handleViewList = () => {
        setView('list');
        fetchNui('reportFetchMine').catch(() => {});
    };

    const handleSelectReport = (report: PlayerReportSummary) => {
        setSelectedReport(report);
        setView('detail');
    };

    const getTitle = (): string => {
        switch (view) {
            case 'menu': return 'Reports';
            case 'create': return 'New Report';
            case 'list': return 'My Reports';
            case 'detail': return 'Report Detail';
        }
    };

    const handleBack = () => {
        if (view === 'detail') {
            setView('list');
            setSelectedReport(null);
        } else if (view === 'create' || view === 'list') {
            setView('menu');
        }
    };

    return isOpen ? (
        <Overlay>
            <Panel>
                    <Header>
                        <Box display="flex" alignItems="center" gap={1}>
                            {view !== 'menu' && (
                                <Button
                                    size="small"
                                    onClick={handleBack}
                                    sx={{ minWidth: 0, textTransform: 'none', mr: 0.5 }}
                                >
                                    Back
                                </Button>
                            )}
                            <Typography variant="subtitle1" fontWeight={600}>
                                {getTitle()}
                            </Typography>
                        </Box>
                        <IconButton size="small" onClick={handleClose}>
                            <Close fontSize="small" />
                        </IconButton>
                    </Header>

                    <Content>
                        {view === 'menu' && (
                            <MenuView
                                onSelect={(v) => {
                                    if (v === 'list') handleViewList();
                                    else setView(v);
                                }}
                                reportCount={reports.length}
                            />
                        )}
                        {view === 'create' && (
                            <CreateView
                                players={players}
                                onSubmit={handleSubmit}
                                submitting={submitting}
                            />
                        )}
                        {view === 'list' && (
                            <ListView
                                reports={reports}
                                onSelect={handleSelectReport}
                            />
                        )}
                        {view === 'detail' && selectedReport && (
                            <DetailView
                                report={selectedReport}
                                onSendMessage={handleSendMessage}
                                sending={sendingMessage}
                            />
                        )}
                    </Content>
                </Panel>
            </Overlay>
        ) : null;
};
