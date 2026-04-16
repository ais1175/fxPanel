import { memo, useState } from 'react';
import { ResponsiveLine, type Serie, type PointTooltipProps } from '@nivo/line';
import { useIsDarkMode } from '@/hooks/theme';
import type { InsightsPlayerCountPoint } from '@shared/insightsApiTypes';
import { dateToLocaleTimeString, dateToLocaleDateString, isDateToday } from '@/lib/dateTime';

const formatTs = (ts: number) => {
    const d = new Date(ts);
    if (isDateToday(d)) return dateToLocaleTimeString(d, '2-digit', '2-digit');
    return dateToLocaleDateString(d, 'short') + ' ' + dateToLocaleTimeString(d, '2-digit', '2-digit');
};

const formatMemory = (mb: number) => {
    if (mb >= 1024) return `${(mb / 1024).toFixed(1)} GB`;
    return `${Math.round(mb)} MB`;
};

function ChartTooltip({ point }: PointTooltipProps) {
    const ts = point.data.x as number;
    return (
        <div className="bg-card text-card-foreground border-border rounded-md border p-2 text-sm shadow-md">
            <div className="font-medium">{formatTs(ts)}</div>
            <div style={{ color: point.serieColor }}>
                {point.serieId}:{' '}
                <strong>
                    {point.serieId === 'Players' ? point.data.yFormatted : formatMemory(point.data.y as number)}
                </strong>
            </div>
        </div>
    );
}

type Props = {
    series: InsightsPlayerCountPoint[];
};

function PlayerCountChart({ series }: Props) {
    const isDarkMode = useIsDarkMode();
    const [showMemory, setShowMemory] = useState(true);

    if (!Array.isArray(series) || !series.length) {
        return (
            <div className="text-muted-foreground flex items-center justify-center py-12 text-sm">
                No data available
            </div>
        );
    }

    const playerData: Serie = {
        id: 'Players',
        data: series.map((p) => ({ x: p.ts, y: p.players })),
    };

    const nivoSeries: Serie[] = [playerData];

    if (showMemory) {
        const memPoints = series.filter((p) => p.fxsMemory !== null);
        if (memPoints.length) {
            nivoSeries.push({
                id: 'FXS Memory',
                data: memPoints.map((p) => ({ x: p.ts, y: p.fxsMemory })),
            });
        }
    }

    const colors = isDarkMode ? ['#60a5fa', '#a78bfa'] : ['#2563eb', '#7c3aed'];

    return (
        <div>
            <div className="text-muted-foreground mb-1 flex items-center gap-4 px-1 text-xs">
                <label className="flex cursor-pointer items-center gap-1 select-none">
                    <input
                        type="checkbox"
                        checked={showMemory}
                        onChange={(e) => setShowMemory(e.target.checked)}
                        className="rounded"
                    />
                    Show Memory
                </label>
            </div>
            <div style={{ height: 280 }}>
                <ResponsiveLine
                    data={nivoSeries}
                    margin={{ top: 10, right: 30, bottom: 40, left: 50 }}
                    xScale={{ type: 'linear', min: 'auto', max: 'auto' }}
                    yScale={{ type: 'linear', min: 0, stacked: false }}
                    curve="monotoneX"
                    colors={colors}
                    lineWidth={2}
                    enablePoints={false}
                    enableArea={true}
                    areaOpacity={isDarkMode ? 0.15 : 0.1}
                    enableGridX={false}
                    enableGridY={true}
                    axisBottom={{
                        tickSize: 5,
                        tickPadding: 5,
                        format: (v) => formatTs(v as number),
                        tickValues: 6,
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
                    legends={[
                        {
                            anchor: 'top-left',
                            direction: 'row',
                            translateY: -10,
                            itemWidth: 100,
                            itemHeight: 20,
                            symbolSize: 10,
                            symbolShape: 'circle',
                            itemTextColor: isDarkMode ? '#a1a1aa' : '#71717a',
                        },
                    ]}
                />
            </div>
        </div>
    );
}

export default memo(PlayerCountChart);
