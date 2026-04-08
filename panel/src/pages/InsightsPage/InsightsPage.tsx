import { useBackendApi } from '@/hooks/fetch';
import useSWR from 'swr';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
    ActivityIcon,
    BarChart3Icon,
    ClockIcon,
    GavelIcon,
    Loader2Icon,
    ServerIcon,
    SignalIcon,
    TrendingUpIcon,
    UserPlusIcon,
    UsersIcon,
    WifiOffIcon,
    CrownIcon,
} from 'lucide-react';
import type {
    InsightsPlayerCountResp,
    InsightsNewPlayersResp,
    InsightsTopPlayersResp,
    InsightsPlaytimeDistResp,
    InsightsRetentionResp,
    InsightsUptimeResp,
    InsightsDisconnectReasonsResp,
    InsightsPeakHoursResp,
    InsightsActionsTimelineResp,
    InsightsPlayerGrowthResp,
    InsightsSessionLengthResp,
    InsightsDailyPlayersResp,
} from '@shared/insightsApiTypes';
import { useOpenPlayerModal } from '@/hooks/playerModal';
import PlayerCountChart from './PlayerCountChart';
import NewPlayersChart from './NewPlayersChart';
import PlaytimeDistChart from './PlaytimeDistChart';
import UptimeTimeline from './UptimeTimeline';
import DisconnectReasonsChart from './DisconnectReasonsChart';
import PeakHoursHeatmap from './PeakHoursHeatmap';
import ActionsTimelineChart from './ActionsTimelineChart';
import PlayerGrowthChart from './PlayerGrowthChart';
import SessionLengthChart from './SessionLengthChart';
import DailyPlayersChart from './DailyPlayersChart';

function CardLoading() {
    return (
        <div className="flex items-center justify-center py-12">
            <Loader2Icon className="text-muted-foreground h-6 w-6 animate-spin" />
        </div>
    );
}

function CardError({ message }: { message: string }) {
    return <div className="text-muted-foreground flex items-center justify-center py-12 text-sm">{message}</div>;
}

const formatPlayTime = (minutes: number) => {
    if (minutes < 60) return `${minutes}m`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}h ${minutes % 60}m`;
    const days = Math.floor(hours / 24);
    return `${days}d ${hours % 24}h`;
};

// ── Player Count + Memory Chart ──

function PlayerCountCard() {
    const api = useBackendApi<InsightsPlayerCountResp>({
        method: 'GET',
        path: '/insights/playerCount',
    });
    const { data, error, isLoading } = useSWR('/insights/playerCount', () => api({}), {
        revalidateOnFocus: false,
        dedupingInterval: 60_000,
    });

    const hasError = error || (data && 'error' in data);
    const errorMsg = hasError ? (data && 'error' in data ? data.error : 'Failed to load') : '';

    return (
        <Card className="col-span-full">
            <CardHeader className="pb-2">
                <CardTitle className="flex items-center gap-2 text-base">
                    <ActivityIcon className="h-4 w-4" />
                    Player Count &amp; Memory
                    {data && !('error' in data) && (
                        <span className="text-muted-foreground ml-auto text-sm font-normal">
                            Peak: <span className="text-foreground font-semibold">{data.peakCount}</span> players
                        </span>
                    )}
                </CardTitle>
            </CardHeader>
            <CardContent>
                {isLoading ? (
                    <CardLoading />
                ) : hasError ? (
                    <CardError message={errorMsg} />
                ) : (
                    <PlayerCountChart series={(data as Exclude<InsightsPlayerCountResp, { error: string }>).series} />
                )}
            </CardContent>
        </Card>
    );
}

// ── New Players Per Day ──

function NewPlayersCard() {
    const api = useBackendApi<InsightsNewPlayersResp>({
        method: 'GET',
        path: '/insights/newPlayers',
    });
    const { data, error, isLoading } = useSWR('/insights/newPlayers', () => api({}), {
        revalidateOnFocus: false,
        dedupingInterval: 60_000,
    });

    const hasError = error || (data && 'error' in data);
    const errorMsg = hasError ? (data && 'error' in data ? data.error : 'Failed to load') : '';
    const successData = data && !('error' in data) ? data : null;

    return (
        <Card className="col-span-full lg:col-span-1">
            <CardHeader className="pb-2">
                <CardTitle className="flex items-center gap-2 text-base">
                    <UserPlusIcon className="h-4 w-4" />
                    New Players Per Day
                    {successData && (
                        <span className="text-muted-foreground ml-auto text-sm font-normal">
                            Total:{' '}
                            <span className="text-foreground font-semibold">
                                {successData.totalPlayers.toLocaleString()}
                            </span>
                        </span>
                    )}
                </CardTitle>
            </CardHeader>
            <CardContent>
                {isLoading ? (
                    <CardLoading />
                ) : hasError ? (
                    <CardError message={errorMsg} />
                ) : (
                    <NewPlayersChart daily={successData!.daily} />
                )}
            </CardContent>
        </Card>
    );
}

// ── Playtime Distribution ──

function PlaytimeDistCard() {
    const api = useBackendApi<InsightsPlaytimeDistResp>({
        method: 'GET',
        path: '/insights/playtimeDist',
    });
    const { data, error, isLoading } = useSWR('/insights/playtimeDist', () => api({}), {
        revalidateOnFocus: false,
        dedupingInterval: 60_000,
    });

    const hasError = error || (data && 'error' in data);
    const errorMsg = hasError ? (data && 'error' in data ? data.error : 'Failed to load') : '';
    const successData = data && !('error' in data) ? data : null;

    return (
        <Card className="col-span-full lg:col-span-1">
            <CardHeader className="pb-2">
                <CardTitle className="flex items-center gap-2 text-base">
                    <BarChart3Icon className="h-4 w-4" />
                    Playtime Distribution
                    {successData && (
                        <span className="text-muted-foreground ml-auto text-sm font-normal">
                            Median:{' '}
                            <span className="text-foreground font-semibold">
                                {formatPlayTime(successData.medianMinutes)}
                            </span>
                            {' · '}Avg:{' '}
                            <span className="text-foreground font-semibold">
                                {formatPlayTime(successData.averageMinutes)}
                            </span>
                        </span>
                    )}
                </CardTitle>
            </CardHeader>
            <CardContent>
                {isLoading ? (
                    <CardLoading />
                ) : hasError ? (
                    <CardError message={errorMsg} />
                ) : (
                    <PlaytimeDistChart buckets={successData!.buckets} />
                )}
            </CardContent>
        </Card>
    );
}

// ── Top Players ──

function TopPlayersCard() {
    const api = useBackendApi<InsightsTopPlayersResp>({
        method: 'GET',
        path: '/insights/topPlayers',
    });
    const { data, error, isLoading } = useSWR('/insights/topPlayers', () => api({}), {
        revalidateOnFocus: false,
        dedupingInterval: 60_000,
    });
    const openPlayerModal = useOpenPlayerModal();

    const hasError = error || (data && 'error' in data);
    const errorMsg = hasError ? (data && 'error' in data ? data.error : 'Failed to load') : '';
    const successData = data && !('error' in data) ? data : null;

    return (
        <Card className="col-span-full lg:col-span-1">
            <CardHeader className="pb-2">
                <CardTitle className="flex items-center gap-2 text-base">
                    <CrownIcon className="h-4 w-4" />
                    Top Players by Playtime
                </CardTitle>
            </CardHeader>
            <CardContent>
                {isLoading ? (
                    <CardLoading />
                ) : hasError ? (
                    <CardError message={errorMsg} />
                ) : (
                    <div className="max-h-84 space-y-1 overflow-y-auto">
                        {successData!.players.map((player, i) => (
                            <div
                                key={player.license}
                                className="hover:bg-muted/50 flex items-center gap-3 rounded-md px-2.5 py-1.5 text-sm transition-colors"
                            >
                                <span className="text-muted-foreground w-6 shrink-0 text-right font-mono">
                                    {i + 1}.
                                </span>
                                <button
                                    onClick={() => openPlayerModal({ license: player.license })}
                                    className="min-w-0 cursor-pointer truncate text-left hover:underline"
                                >
                                    {player.displayName}
                                </button>
                                <span className="text-muted-foreground ml-auto shrink-0 font-mono text-xs">
                                    {formatPlayTime(player.playTime)}
                                </span>
                            </div>
                        ))}
                    </div>
                )}
            </CardContent>
        </Card>
    );
}

// ── Player Retention ──

function RetentionCard() {
    const api = useBackendApi<InsightsRetentionResp>({
        method: 'GET',
        path: '/insights/retention',
    });
    const { data, error, isLoading } = useSWR('/insights/retention', () => api({}), {
        revalidateOnFocus: false,
        dedupingInterval: 60_000,
    });

    const hasError = error || (data && 'error' in data);
    const errorMsg = hasError ? (data && 'error' in data ? data.error : 'Failed to load') : '';
    const successData = data && !('error' in data) ? data : null;

    return (
        <Card className="col-span-full lg:col-span-1">
            <CardHeader className="pb-2">
                <CardTitle className="flex items-center gap-2 text-base">
                    <TrendingUpIcon className="h-4 w-4" />
                    Player Retention
                    {successData && (
                        <span className="text-muted-foreground ml-auto text-sm font-normal">
                            Sample: {successData.sampleSize.toLocaleString()} players
                        </span>
                    )}
                </CardTitle>
            </CardHeader>
            <CardContent>
                {isLoading ? (
                    <CardLoading />
                ) : hasError ? (
                    <CardError message={errorMsg} />
                ) : (
                    <div className="space-y-4">
                        {/* Return rates */}
                        <div>
                            <h4 className="text-muted-foreground mb-2 text-sm font-medium">
                                Return Rate (joined 30+ days ago)
                            </h4>
                            <div className="grid grid-cols-3 gap-3">
                                <RetentionStat label="After 1 day" value={successData!.returnRate1d} />
                                <RetentionStat label="After 7 days" value={successData!.returnRate7d} />
                                <RetentionStat label="After 30 days" value={successData!.returnRate30d} />
                            </div>
                        </div>
                        {/* Activity rates */}
                        <div>
                            <h4 className="text-muted-foreground mb-2 text-sm font-medium">
                                Current Activity (all players)
                            </h4>
                            <div className="grid grid-cols-2 gap-3">
                                <RetentionStat label="Active last 7d" value={successData!.activeLast7d} />
                                <RetentionStat label="Active last 30d" value={successData!.activeLast30d} />
                            </div>
                        </div>
                    </div>
                )}
            </CardContent>
        </Card>
    );
}

function RetentionStat({ label, value }: { label: string; value: number }) {
    const color = value >= 50 ? 'text-green-500' : value >= 25 ? 'text-warning' : 'text-destructive';
    return (
        <div className="bg-muted/50 rounded-lg p-3 text-center">
            <div className={`text-2xl font-bold ${color}`}>{value}%</div>
            <div className="text-muted-foreground text-xs">{label}</div>
        </div>
    );
}

// ── Uptime Timeline ──

function UptimeCard() {
    const api = useBackendApi<InsightsUptimeResp>({
        method: 'GET',
        path: '/insights/uptimeTimeline',
    });
    const { data, error, isLoading } = useSWR('/insights/uptimeTimeline', () => api({}), {
        revalidateOnFocus: false,
        dedupingInterval: 60_000,
    });

    const hasError = error || (data && 'error' in data);
    const errorMsg = hasError ? (data && 'error' in data ? data.error : 'Failed to load') : '';

    return (
        <Card className="col-span-full">
            <CardHeader className="pb-2">
                <CardTitle className="flex items-center gap-2 text-base">
                    <ServerIcon className="h-4 w-4" />
                    Server Uptime
                </CardTitle>
            </CardHeader>
            <CardContent>
                {isLoading ? (
                    <CardLoading />
                ) : hasError ? (
                    <CardError message={errorMsg} />
                ) : (
                    <UptimeTimeline segments={(data as Exclude<InsightsUptimeResp, { error: string }>).segments} />
                )}
            </CardContent>
        </Card>
    );
}

// ── Disconnect Reasons ──

function DisconnectReasonsCard() {
    const api = useBackendApi<InsightsDisconnectReasonsResp>({
        method: 'GET',
        path: '/insights/disconnectReasons',
    });
    const { data, error, isLoading } = useSWR('/insights/disconnectReasons', () => api({}), {
        revalidateOnFocus: false,
        dedupingInterval: 60_000,
    });

    const hasError = error || (data && 'error' in data);
    const errorMsg = hasError ? (data && 'error' in data ? data.error : 'Failed to load') : '';
    const successData = data && !('error' in data) ? data : null;

    return (
        <Card className="col-span-full lg:col-span-1">
            <CardHeader className="pb-2">
                <CardTitle className="flex items-center gap-2 text-base">
                    <WifiOffIcon className="h-4 w-4" />
                    Disconnect Reasons (14d)
                    {successData && (
                        <span className="text-muted-foreground ml-auto text-sm font-normal">
                            Total:{' '}
                            <span className="text-foreground font-semibold">
                                {successData.totalDrops.toLocaleString()}
                            </span>
                        </span>
                    )}
                </CardTitle>
            </CardHeader>
            <CardContent>
                {isLoading ? (
                    <CardLoading />
                ) : hasError ? (
                    <CardError message={errorMsg} />
                ) : (
                    <DisconnectReasonsChart categories={successData!.categories} />
                )}
            </CardContent>
        </Card>
    );
}

// ── Peak Hours Heatmap ──

function PeakHoursCard() {
    const api = useBackendApi<InsightsPeakHoursResp>({
        method: 'GET',
        path: '/insights/peakHours',
    });
    const { data, error, isLoading } = useSWR('/insights/peakHours', () => api({}), {
        revalidateOnFocus: false,
        dedupingInterval: 60_000,
    });

    const hasError = error || (data && 'error' in data);
    const errorMsg = hasError ? (data && 'error' in data ? data.error : 'Failed to load') : '';
    const successData = data && !('error' in data) ? data : null;

    return (
        <Card className="col-span-full lg:col-span-1">
            <CardHeader className="pb-2">
                <CardTitle className="flex items-center gap-2 text-base">
                    <SignalIcon className="h-4 w-4" />
                    Peak Hours
                </CardTitle>
            </CardHeader>
            <CardContent>
                {isLoading ? (
                    <CardLoading />
                ) : hasError ? (
                    <CardError message={errorMsg} />
                ) : (
                    <PeakHoursHeatmap cells={successData!.cells} maxAvg={successData!.maxAvg} />
                )}
            </CardContent>
        </Card>
    );
}

// ── Actions Timeline ──

function ActionsTimelineCard() {
    const api = useBackendApi<InsightsActionsTimelineResp>({
        method: 'GET',
        path: '/insights/actionsTimeline',
    });
    const { data, error, isLoading } = useSWR('/insights/actionsTimeline', () => api({}), {
        revalidateOnFocus: false,
        dedupingInterval: 60_000,
    });

    const hasError = error || (data && 'error' in data);
    const errorMsg = hasError ? (data && 'error' in data ? data.error : 'Failed to load') : '';
    const successData = data && !('error' in data) ? data : null;

    return (
        <Card className="col-span-full">
            <CardHeader className="pb-2">
                <CardTitle className="flex items-center gap-2 text-base">
                    <GavelIcon className="h-4 w-4" />
                    Moderation Activity
                </CardTitle>
            </CardHeader>
            <CardContent>
                {isLoading ? (
                    <CardLoading />
                ) : hasError ? (
                    <CardError message={errorMsg} />
                ) : (
                    <ActionsTimelineChart daily={successData!.daily} />
                )}
            </CardContent>
        </Card>
    );
}

// ── Player Growth ──

function PlayerGrowthCard() {
    const api = useBackendApi<InsightsPlayerGrowthResp>({
        method: 'GET',
        path: '/insights/playerGrowth',
    });
    const { data, error, isLoading } = useSWR('/insights/playerGrowth', () => api({}), {
        revalidateOnFocus: false,
        dedupingInterval: 60_000,
    });

    const hasError = error || (data && 'error' in data);
    const errorMsg = hasError ? (data && 'error' in data ? data.error : 'Failed to load') : '';
    const successData = data && !('error' in data) ? data : null;

    return (
        <Card className="col-span-full lg:col-span-1">
            <CardHeader className="pb-2">
                <CardTitle className="flex items-center gap-2 text-base">
                    <TrendingUpIcon className="h-4 w-4" />
                    Player Growth
                    {successData && (
                        <span className="text-muted-foreground ml-auto text-sm font-normal">
                            Total:{' '}
                            <span className="text-foreground font-semibold">
                                {successData.totalPlayers.toLocaleString()}
                            </span>
                        </span>
                    )}
                </CardTitle>
            </CardHeader>
            <CardContent>
                {isLoading ? (
                    <CardLoading />
                ) : hasError ? (
                    <CardError message={errorMsg} />
                ) : (
                    <PlayerGrowthChart data={successData!.data} />
                )}
            </CardContent>
        </Card>
    );
}

// ── Session Length ──

function SessionLengthCard() {
    const api = useBackendApi<InsightsSessionLengthResp>({
        method: 'GET',
        path: '/insights/sessionLength',
    });
    const { data, error, isLoading } = useSWR('/insights/sessionLength', () => api({}), {
        revalidateOnFocus: false,
        dedupingInterval: 60_000,
    });

    const hasError = error || (data && 'error' in data);
    const errorMsg = hasError ? (data && 'error' in data ? data.error : 'Failed to load') : '';
    const successData = data && !('error' in data) ? data : null;

    return (
        <Card className="col-span-full lg:col-span-1">
            <CardHeader className="pb-2">
                <CardTitle className="flex items-center gap-2 text-base">
                    <ClockIcon className="h-4 w-4" />
                    Session Length
                    {successData && (
                        <span className="text-muted-foreground ml-auto text-sm font-normal">
                            Avg:{' '}
                            <span className="text-foreground font-semibold">
                                {formatPlayTime(successData.avgMinutes)}
                            </span>
                            {' · '}Median:{' '}
                            <span className="text-foreground font-semibold">
                                {formatPlayTime(successData.medianMinutes)}
                            </span>
                            {' · '}
                            {successData.totalSessions} sessions ({successData.hoursAnalyzed}h)
                        </span>
                    )}
                </CardTitle>
            </CardHeader>
            <CardContent>
                {isLoading ? (
                    <CardLoading />
                ) : hasError ? (
                    <CardError message={errorMsg} />
                ) : (
                    <SessionLengthChart buckets={successData!.buckets} />
                )}
            </CardContent>
        </Card>
    );
}

// ── Daily Players (New vs Returning) ──

function DailyPlayersCard() {
    const api = useBackendApi<InsightsDailyPlayersResp>({
        method: 'GET',
        path: '/insights/dailyPlayers',
    });
    const { data, error, isLoading } = useSWR('/insights/dailyPlayers', () => api({}), {
        revalidateOnFocus: false,
        dedupingInterval: 60_000,
    });

    const hasError = error || (data && 'error' in data);
    const errorMsg = hasError ? (data && 'error' in data ? data.error : 'Failed to load') : '';
    const successData = data && !('error' in data) ? data : null;

    return (
        <Card className="col-span-full lg:col-span-1">
            <CardHeader className="pb-2">
                <CardTitle className="flex items-center gap-2 text-base">
                    <UsersIcon className="h-4 w-4" />
                    New vs Returning Players
                    {successData && (
                        <span className="text-muted-foreground ml-auto text-sm font-normal">
                            {successData.daysAnalyzed}d of data
                        </span>
                    )}
                </CardTitle>
            </CardHeader>
            <CardContent>
                {isLoading ? (
                    <CardLoading />
                ) : hasError ? (
                    <CardError message={errorMsg} />
                ) : (
                    <DailyPlayersChart daily={successData!.daily} />
                )}
            </CardContent>
        </Card>
    );
}

// ── Page ──

export default function InsightsPage() {
    return (
        <div className="w-full space-y-4">
            <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                <UptimeCard />
                <PlayerCountCard />
                <PeakHoursCard />
                <DisconnectReasonsCard />
                <DailyPlayersCard />
                <NewPlayersCard />
                <ActionsTimelineCard />
                <PlayerGrowthCard />
                <SessionLengthCard />
                <PlaytimeDistCard />
                <TopPlayersCard />
                <RetentionCard />
            </div>
        </div>
    );
}
