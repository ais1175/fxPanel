import { useBackendApi } from '@/hooks/fetch';
import type { PlayerDropsApiResp, PlayerDropsApiSuccessResp } from '@shared/otherTypes';
import useSWR from 'swr';
import DrilldownCard, { DrilldownCardLoading } from './DrilldownCard';
import TimelineCard from './TimelineCard';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

export type DrilldownRangeSelectionType = {
    startDate: Date;
    endDate: Date;
} | null;
export type DisplayLodType = 'hour' | 'day';

/**
 * Get the query params for the player drops api
 * Modifies the end date to include the whole day/hour depending on the display LOD
 */
const getQueryParams = (rangeState: DrilldownRangeSelectionType, displayLod: DisplayLodType) => {
    if (!rangeState) {
        const detailedDaysAgo = displayLod === 'day' ? 14 : 7;
        return {
            queryKey: 'detailedDaysAgo=' + detailedDaysAgo,
            queryParams: { detailedDaysAgo },
        };
    }

    const newEndDate = new Date(rangeState.endDate);
    if (displayLod === 'day') {
        newEndDate.setHours(23, 59, 59, 999);
    } else {
        newEndDate.setMinutes(59, 59, 999);
    }
    const detailedWindow = `${rangeState.startDate.toISOString()},${newEndDate.toISOString()}`;
    return {
        queryKey: 'detailedWindow=' + detailedWindow,
        queryParams: { detailedWindow },
    };
};

const drilldownIntervals = [
    { label: '24h', days: 1 },
    { label: '3d', days: 3 },
    { label: '7d', days: 7 },
    { label: '14d', days: 14 },
] as const;

/**
 * The player drops page
 */
export default function PlayerDropsPage() {
    const [displayLod, setDisplayLod] = useState<DisplayLodType>('hour');
    const [drilldownRange, setDrilldownRange] = useState<DrilldownRangeSelectionType>(null);
    const { queryKey, queryParams } = getQueryParams(drilldownRange, displayLod);

    const playerDropsApi = useBackendApi<PlayerDropsApiResp>({
        method: 'GET',
        path: `/playerDropsData`,
    });
    const swrDataApiResp = useSWR(
        `/playerDropsData?${queryKey}`,
        async () => {
            const data = await playerDropsApi({ queryParams });
            if (!data) throw new Error('empty_response');
            if ('fail_reason' in data) {
                throw new Error(data.fail_reason);
            }
            return data as PlayerDropsApiSuccessResp;
        },
        {
            revalidateOnFocus: false,
        },
    );
    const displayLodSetter = (lod: DisplayLodType) => {
        setDisplayLod(lod);
        setDrilldownRange(null);
    };

    const setIntervalRange = (days: number) => {
        const now = new Date();
        const start = new Date(now);
        start.setDate(start.getDate() - days);
        setDrilldownRange({ startDate: start, endDate: now });
    };

    //Check which interval button matches current range (if any)
    const activeInterval = (() => {
        if (!drilldownRange) return null;
        const rangeDurationMs = drilldownRange.endDate.getTime() - drilldownRange.startDate.getTime();
        const rangeDays = rangeDurationMs / (1000 * 60 * 60 * 24);
        for (const interval of drilldownIntervals) {
            if (Math.abs(rangeDays - interval.days) < 0.1) return interval.days;
        }
        return null;
    })();

    return (
        <div className="w-full space-y-8">
            <TimelineCard
                isError={!!swrDataApiResp.error}
                dataTs={swrDataApiResp.data?.ts}
                summaryData={swrDataApiResp.data?.summary}
                rangeSelected={drilldownRange}
                rangeSetter={setDrilldownRange}
                displayLod={displayLod}
                setDisplayLod={displayLodSetter}
            />

            <div className="flex items-center justify-center gap-2">
                <span className="text-muted-foreground mr-1 text-sm">Drilldown:</span>
                {drilldownIntervals.map(({ label, days }) => (
                    <Button
                        key={days}
                        size="xs"
                        variant={activeInterval === days ? 'default' : 'outline-solid'}
                        className={cn('h-7 px-3 font-mono text-xs', activeInterval === days && 'pointer-events-none')}
                        onClick={() => setIntervalRange(days)}
                    >
                        {label}
                    </Button>
                ))}
                {drilldownRange && (
                    <Button
                        size="xs"
                        variant="ghost"
                        className="text-muted-foreground h-7 px-2 text-xs"
                        onClick={() => setDrilldownRange(null)}
                    >
                        Reset
                    </Button>
                )}
            </div>

            {swrDataApiResp.data && !swrDataApiResp.isValidating ? (
                <div className="min-h-128">
                    <DrilldownCard
                        windowStart={swrDataApiResp.data.detailed.windowStart}
                        windowEnd={swrDataApiResp.data.detailed.windowEnd}
                        windowData={swrDataApiResp.data.detailed.windowData}
                        rangeSelected={drilldownRange}
                        displayLod={displayLod}
                    />
                </div>
            ) : (
                <div className="min-h-128">
                    <DrilldownCardLoading isError={!!swrDataApiResp.error} />
                </div>
            )}
        </div>
    );
}
