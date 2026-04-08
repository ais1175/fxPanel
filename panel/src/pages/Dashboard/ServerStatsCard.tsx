import { GaugeIcon, Loader2Icon, MemoryStickIcon, TimerIcon, TrendingUpIcon } from 'lucide-react';
import { memo, useMemo } from 'react';
import { useAtomValue } from 'jotai';
import { dashPerfCursorAtom, dashServerStatsAtom, dashSvRuntimeAtom, useGetDashDataAge } from './dashboardHooks';
import { cn } from '@/lib/utils';
import { dateToLocaleDateString, dateToLocaleTimeString, isDateToday } from '@/lib/dateTime';

//NOTE: null and undefined are semantically equal here
type HostStatsDataProps = {
    uptimePct: number | null | undefined;
    medianPlayerCount: number | null | undefined;
    fxsMemory: number | null | undefined;
    nodeMemory:
        | {
              used: number;
              limit: number;
          }
        | null
        | undefined;
};

const HostStatsData = memo(({ uptimePct, medianPlayerCount, fxsMemory, nodeMemory }: HostStatsDataProps) => {
    const uptimePart = uptimePct ? uptimePct.toFixed(2) + '%' : '--';
    const medianPlayerPart = medianPlayerCount ? Math.ceil(medianPlayerCount) : '--';
    const fxsPart = fxsMemory ? fxsMemory.toFixed(2) + 'MB' : '--';

    let nodeCustomClass = null;
    let nodePart: React.ReactNode = '--';
    if (nodeMemory) {
        const nodeMemoryUsage = Math.ceil((nodeMemory.used / nodeMemory.limit) * 100);
        nodePart = nodeMemory.used.toFixed(2) + 'MB' + ' (' + nodeMemoryUsage + '%)';
        if (nodeMemoryUsage > 85) {
            nodeCustomClass = 'text-destructive';
        } else if (nodeMemoryUsage > 70) {
            nodeCustomClass = 'text-warning';
        }
    }

    return (
        <div className="text-muted-foreground grid h-full grid-cols-2 gap-4 pb-2 sm:grid-cols-1">
            <div className="flex items-center">
                <TimerIcon className="mr-2 hidden opacity-75 sm:block sm:size-6 md:size-12" />
                <div className="mr-auto ml-auto flex flex-col sm:mr-0 sm:ml-auto">
                    <span className="text-primary text-center text-xl sm:text-right">{uptimePart}</span>
                    <span className="text-center text-sm sm:text-right">Uptime 24h</span>
                </div>
            </div>
            <div className="flex items-center">
                <TrendingUpIcon className="mr-2 hidden opacity-75 sm:block sm:size-6 md:size-12" />
                <div className="mr-auto ml-auto flex flex-col sm:mr-0 sm:ml-auto">
                    <span className="text-primary text-center text-xl sm:text-right">{medianPlayerPart}</span>
                    <span className="text-center text-sm sm:text-right">Median Players 24h</span>
                </div>
            </div>
            <div className="flex items-center">
                <MemoryStickIcon className="mr-2 hidden opacity-75 sm:block sm:size-6 md:size-12" />
                <div className="mr-auto ml-auto flex flex-col sm:mr-0 sm:ml-auto">
                    <span className="text-primary text-center text-xl sm:text-right">{fxsPart}</span>
                    <span className="text-center text-sm sm:text-right">FXServer Memory</span>
                </div>
            </div>
            <div
                className={cn('flex items-center', nodeCustomClass ?? 'text-muted-foreground')}
                title={nodeMemory ? `${nodeMemory.used.toFixed(2)}MB / ${nodeMemory.limit}MB` : ''}
            >
                <MemoryStickIcon className="mr-2 hidden opacity-75 sm:block sm:size-6 md:size-12" />
                <div className="mr-auto ml-auto flex flex-col sm:mr-0 sm:ml-auto">
                    <span className={cn('text-center text-xl sm:text-right', nodeCustomClass ?? 'text-primary')}>
                        {nodePart}
                    </span>
                    <span className="text-center text-sm sm:text-right">Node.js Memory</span>
                </div>
            </div>
        </div>
    );
});

export default function ServerStatsCard() {
    const pastStatsData = useAtomValue(dashServerStatsAtom);
    const svRuntimeData = useAtomValue(dashSvRuntimeAtom);
    const perfCursorData = useAtomValue(dashPerfCursorAtom);
    const getDashDataAge = useGetDashDataAge();

    const displayData = useMemo(() => {
        //Data availability & age check
        const dataAge = getDashDataAge();
        if (!svRuntimeData || dataAge.isExpired) return null;

        if (perfCursorData && perfCursorData.snap) {
            const timeStr = dateToLocaleTimeString(perfCursorData.snap.end, '2-digit', '2-digit');
            const dateStr = dateToLocaleDateString(perfCursorData.snap.end, 'short');
            const titleTimeIndicator = isDateToday(perfCursorData.snap.end) ? timeStr : `${timeStr} - ${dateStr}`;
            return {
                fxsMemory: perfCursorData.snap.fxsMemory,
                nodeMemory:
                    svRuntimeData.nodeMemory && perfCursorData.snap.nodeMemory
                        ? {
                              used: perfCursorData.snap.nodeMemory,
                              limit: svRuntimeData.nodeMemory.limit,
                          }
                        : null,
                titleTimeIndicator: (
                    <>
                        (<span className="text-warning-inline font-mono text-xs">{titleTimeIndicator}</span>)
                    </>
                ),
            };
        } else {
            return {
                fxsMemory: svRuntimeData.fxsMemory,
                nodeMemory: svRuntimeData.nodeMemory,
                titleTimeIndicator: dataAge.isStale ? '(minutes ago)' : '(live)',
            };
        }
    }, [svRuntimeData, perfCursorData]);

    //Rendering
    let titleNode: React.ReactNode = null;
    let contentNode: React.ReactNode = null;
    if (displayData) {
        titleNode = displayData.titleTimeIndicator;
        contentNode = (
            <HostStatsData
                fxsMemory={displayData.fxsMemory}
                medianPlayerCount={pastStatsData?.medianPlayerCount}
                uptimePct={pastStatsData?.uptimePct}
                nodeMemory={displayData.nodeMemory}
            />
        );
    } else {
        contentNode = (
            <div className="flex size-full flex-col items-center justify-center">
                <Loader2Icon className="text-muted-foreground size-16 animate-spin" />
            </div>
        );
    }

    return (
        <div className="bg-card flex h-80 max-h-80 flex-col border px-4 py-2 shadow-xs md:rounded-xl">
            <div className="text-muted-foreground flex flex-row items-center justify-between space-y-0 pb-2">
                <h3 className="line-clamp-1 text-sm font-medium tracking-tight">Server stats {titleNode}</h3>
                <div className="xs:block hidden">
                    <GaugeIcon />
                </div>
            </div>
            {contentNode}
        </div>
    );
}
