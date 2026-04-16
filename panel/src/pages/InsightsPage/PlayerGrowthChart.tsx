import { memo } from 'react';
import { ResponsiveLine, type Serie, type PointTooltipProps } from '@nivo/line';
import { useIsDarkMode } from '@/hooks/theme';
import type { InsightsPlayerGrowthPoint } from '@shared/insightsApiTypes';

function ChartTooltip({ point }: PointTooltipProps) {
    return (
        <div className="bg-card text-card-foreground border-border rounded-md border p-2 text-sm shadow-md">
            <div className="font-medium">{point.data.x as string}</div>
            <div style={{ color: point.serieColor }}>
                Total players: <strong>{point.data.yFormatted}</strong>
            </div>
        </div>
    );
}

type Props = {
    data: InsightsPlayerGrowthPoint[];
};

function PlayerGrowthChart({ data }: Props) {
    const isDarkMode = useIsDarkMode();

    if (!Array.isArray(data) || !data.length) {
        return (
            <div className="text-muted-foreground flex items-center justify-center py-12 text-sm">
                No data available
            </div>
        );
    }

    const series: Serie[] = [
        {
            id: 'Players',
            data: data.map((d) => ({ x: d.day, y: d.cumulative })),
        },
    ];

    return (
        <div style={{ height: 260 }}>
            <ResponsiveLine
                data={series}
                margin={{ top: 10, right: 20, bottom: 40, left: 60 }}
                xScale={{ type: 'point' }}
                yScale={{ type: 'linear', min: 0, stacked: false }}
                curve="monotoneX"
                colors={isDarkMode ? ['#34d399'] : ['#059669']}
                lineWidth={2}
                enablePoints={false}
                enableArea={true}
                areaOpacity={isDarkMode ? 0.15 : 0.1}
                enableGridX={false}
                enableGridY={true}
                axisBottom={{
                    tickSize: 5,
                    tickPadding: 5,
                    tickRotation: -45,
                    tickValues:
                        data.length > 30
                            ? data.filter((_, i) => i % Math.ceil(data.length / 15) === 0).map((d) => d.day)
                            : undefined,
                }}
                axisLeft={{
                    tickSize: 5,
                    tickPadding: 5,
                    tickValues: 5,
                }}
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
                    crosshair: {
                        line: {
                            stroke: isDarkMode ? '#a1a1aa' : '#71717a',
                            strokeWidth: 1,
                            strokeOpacity: 0.5,
                        },
                    },
                }}
                useMesh={true}
                tooltip={ChartTooltip}
            />
        </div>
    );
}

export default memo(PlayerGrowthChart);
