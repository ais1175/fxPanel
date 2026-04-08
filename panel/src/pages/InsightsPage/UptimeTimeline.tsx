import { memo, useMemo } from 'react';
import type { InsightsUptimeSegment } from '@shared/insightsApiTypes';
import { dateToLocaleTimeString, dateToLocaleDateString, isDateToday } from '@/lib/dateTime';

const formatTs = (ts: number) => {
    const d = new Date(ts);
    if (isDateToday(d)) return dateToLocaleTimeString(d, '2-digit', '2-digit');
    return dateToLocaleDateString(d, 'short') + ' ' + dateToLocaleTimeString(d, '2-digit', '2-digit');
};

const formatDuration = (ms: number) => {
    const hours = Math.floor(ms / 3_600_000);
    const minutes = Math.floor((ms % 3_600_000) / 60_000);
    if (hours >= 24) {
        const days = Math.floor(hours / 24);
        return `${days}d ${hours % 24}h`;
    }
    if (hours > 0) return `${hours}h ${minutes}m`;
    return `${minutes}m`;
};

type Props = {
    segments: InsightsUptimeSegment[];
};

function UptimeTimeline({ segments }: Props) {
    const { totalRange, uptimePercent } = useMemo(() => {
        if (!segments.length) return { totalRange: 0, uptimePercent: 0 };
        const start = segments[0].start;
        const end = segments[segments.length - 1].end;
        const range = end - start;
        const onlineMs = segments.filter((s) => s.status === 'online').reduce((sum, s) => sum + (s.end - s.start), 0);
        return { totalRange: range, uptimePercent: range > 0 ? Math.round((onlineMs / range) * 100) : 0 };
    }, [segments]);

    if (!segments.length || totalRange === 0) {
        return (
            <div className="text-muted-foreground flex items-center justify-center py-8 text-sm">
                No uptime data available
            </div>
        );
    }

    const timelineStart = segments[0].start;

    return (
        <div>
            <div className="text-muted-foreground mb-2 flex items-center justify-between px-1 text-xs">
                <span>{formatTs(segments[0].start)}</span>
                <span>{formatTs(segments[segments.length - 1].end)}</span>
            </div>
            <div className="border-border flex h-8 overflow-hidden rounded-md border">
                {segments.map((seg, i) => {
                    const widthPct = ((seg.end - seg.start) / totalRange) * 100;
                    if (widthPct < 0.2) return null;
                    return (
                        <div
                            key={i}
                            className={`group relative ${
                                seg.status === 'online' ? 'bg-green-500/50' : 'bg-red-500/50'
                            }`}
                            style={{ width: `${widthPct}%` }}
                        >
                            <div className="absolute bottom-full left-1/2 z-50 mb-1 hidden -translate-x-1/2 rounded border bg-zinc-900 px-2 py-1 text-xs whitespace-nowrap shadow-md group-hover:block">
                                <span className="font-medium">{seg.status === 'online' ? 'Online' : 'Offline'}</span>
                                {' · '}
                                {formatDuration(seg.end - seg.start)}
                                <br />
                                {formatTs(seg.start)} → {formatTs(seg.end)}
                            </div>
                        </div>
                    );
                })}
            </div>
            <div className="text-muted-foreground mt-1.5 text-center text-xs">
                Uptime: <span className="text-foreground font-semibold">{uptimePercent}%</span>
                {' · '}Total: {formatDuration(totalRange)}
            </div>
        </div>
    );
}

export default memo(UptimeTimeline);
