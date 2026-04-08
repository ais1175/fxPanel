import { useMemo } from 'react';
import { numberToLocaleString } from '@/lib/utils';
import { PlayerDropsMessage } from './PlayerDropsGenericSubcards';

type DisplayResourceDatum = {
    label: string;
    count: number;
};

type DrilldownResourcesSubcardProps = {
    resKicks: [string, number][];
};

export default function DrilldownResourcesSubcard({ resKicks }: DrilldownResourcesSubcardProps) {
    let { totalKicks, resources } = useMemo(() => {
        let totalKicks = 0;
        const resources: Record<string, DisplayResourceDatum> = {};
        for (const [resName, cnt] of resKicks) {
            totalKicks += cnt;
            resources[resName] = {
                label: resName,
                count: cnt,
            };
        }
        return {
            totalKicks,
            resources: Object.entries(resources),
        };
    }, [resKicks]);

    if (!resources.length) {
        return <PlayerDropsMessage message="No players kicked by resources within this time window." />;
    }

    return (
        <div className="text-muted-foreground flex flex-wrap justify-evenly gap-4 px-4 py-4">
            {resources.map(([resName, resData]) => (
                <div key={resName} className="flex flex-col items-center justify-center gap-1 px-4">
                    <span className="border-b-2 text-lg tracking-wider">{resData.label}</span>
                    <span className="text-sm">
                        {numberToLocaleString(resData.count)}{' '}
                        <small className="opacity-75">
                            ({numberToLocaleString((resData.count / totalKicks) * 100, 1)}%)
                        </small>
                    </span>
                </div>
            ))}
        </div>
    );
}
