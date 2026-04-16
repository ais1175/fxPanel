import { memo } from 'react';
import { ResponsiveBar, type BarDatum, type BarTooltipProps } from '@nivo/bar';
import { useIsDarkMode } from '@/hooks/theme';
import type { InsightsActionsTimelineDay } from '@shared/insightsApiTypes';

function ChartTooltip({ id, value, data, color }: BarTooltipProps<BarDatum>) {
    return (
        <div className="bg-card text-card-foreground border-border rounded-md border p-2 text-sm shadow-md">
            <div className="font-medium">{data.day as string}</div>
            <div style={{ color }}>
                {id}: <strong>{value}</strong>
            </div>
        </div>
    );
}

type Props = {
    daily: InsightsActionsTimelineDay[];
};

function ActionsTimelineChart({ daily }: Props) {
    const isDarkMode = useIsDarkMode();

    if (!Array.isArray(daily) || !daily.length) {
        return (
            <div className="text-muted-foreground flex items-center justify-center py-12 text-sm">
                No data available
            </div>
        );
    }

    const data: BarDatum[] = daily.map((d) => ({
        day: d.day.slice(5), // MM-DD
        bans: d.bans,
        warns: d.warns,
        kicks: d.kicks,
    }));

    const colors = isDarkMode ? ['#ef4444', '#f59e0b', '#3b82f6'] : ['#dc2626', '#d97706', '#2563eb'];

    return (
        <div style={{ height: 260 }}>
            <ResponsiveBar
                data={data}
                keys={['bans', 'warns', 'kicks']}
                indexBy="day"
                margin={{ top: 10, right: 10, bottom: 40, left: 40 }}
                padding={0.3}
                groupMode="stacked"
                colors={colors}
                borderWidth={0}
                axisBottom={{
                    tickSize: 5,
                    tickPadding: 5,
                    tickRotation: -45,
                    tickValues:
                        data.length > 30
                            ? data.filter((_, i) => i % Math.ceil(data.length / 15) === 0).map((d) => d.day as string)
                            : undefined,
                }}
                axisLeft={{
                    tickSize: 5,
                    tickPadding: 5,
                    tickValues: 5,
                }}
                enableGridX={false}
                enableGridY={true}
                enableLabel={false}
                theme={{
                    text: {
                        fontSize: 11,
                        fill: isDarkMode ? '#a1a1aa' : '#71717a',
                    },
                    grid: {
                        line: {
                            strokeDasharray: '8 6',
                            stroke: '#3F4146',
                            strokeOpacity: isDarkMode ? 1 : 0.25,
                            strokeWidth: 1,
                        },
                    },
                }}
                tooltip={ChartTooltip}
                legends={[
                    {
                        dataFrom: 'keys',
                        anchor: 'top-right',
                        direction: 'row',
                        translateY: -10,
                        itemWidth: 60,
                        itemHeight: 20,
                        symbolSize: 10,
                        symbolShape: 'circle',
                        itemTextColor: isDarkMode ? '#a1a1aa' : '#71717a',
                    },
                ]}
            />
        </div>
    );
}

export default memo(ActionsTimelineChart);
