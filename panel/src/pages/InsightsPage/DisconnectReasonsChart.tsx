import { memo, useMemo } from 'react';
import { ResponsiveBar, type BarDatum, type BarTooltipProps } from '@nivo/bar';
import { useIsDarkMode } from '@/hooks/theme';

const categoryLabels: Record<string, string> = {
    player: 'Player',
    timeout: 'Timeout',
    security: 'Security',
    crash: 'Crash',
    resource: 'Resource',
    unknown: 'Unknown',
};

const categoryColors: Record<string, string> = {
    player: '#22c55e',
    timeout: '#3b82f6',
    security: '#f59e0b',
    crash: '#ef4444',
    resource: '#a855f7',
    unknown: '#6b7280',
};

function ChartTooltip({ data, value, color }: BarTooltipProps<BarDatum>) {
    return (
        <div className="bg-card text-card-foreground border-border rounded-md border p-2 text-sm shadow-md">
            <div className="font-medium">{data.label as string}</div>
            <div style={{ color }}>
                Count: <strong>{value}</strong>
            </div>
        </div>
    );
}

type Props = {
    categories: { category: string; count: number }[];
};

function DisconnectReasonsChart({ categories }: Props) {
    const isDarkMode = useIsDarkMode();

    const data: BarDatum[] = useMemo(
        () =>
            Array.isArray(categories)
                ? categories.map((c) => ({
                      label: categoryLabels[c.category] ?? c.category,
                      count: c.count,
                      color: categoryColors[c.category] ?? '#6b7280',
                  }))
                : [],
        [categories],
    );

    if (!data.length) {
        return <div className="text-muted-foreground flex items-center justify-center py-12 text-sm">No data</div>;
    }

    return (
        <div style={{ height: 220 }}>
            <ResponsiveBar
                data={data}
                keys={['count']}
                indexBy="label"
                margin={{ top: 10, right: 10, bottom: 40, left: 70 }}
                layout="horizontal"
                padding={0.3}
                colors={({ data }) => data.color as string}
                borderWidth={0}
                axisBottom={{
                    tickSize: 5,
                    tickPadding: 5,
                    tickValues: 5,
                }}
                axisLeft={{
                    tickSize: 0,
                    tickPadding: 8,
                }}
                enableGridX={true}
                enableGridY={false}
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
            />
        </div>
    );
}

export default memo(DisconnectReasonsChart);
