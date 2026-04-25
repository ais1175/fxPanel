import type {
    InsightsActionsTimelineResp,
    InsightsDailyPlayersResp,
    InsightsDisconnectReasonsResp,
    InsightsNewPlayersResp,
    InsightsPeakHoursResp,
    InsightsPlayerCountResp,
    InsightsPlayerGrowthResp,
    InsightsPlaytimeDistResp,
    InsightsRetentionResp,
    InsightsSessionLengthResp,
    InsightsTopPlayersResp,
    InsightsUptimeResp,
} from '@shared/insightsApiTypes';

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

const toDayKey = (ts: number) => new Date(ts).toISOString().slice(0, 10);

const buildRecentDays = (days: number, now: number) => {
    const dayMs = 24 * 60 * 60 * 1000;
    return Array.from({ length: days }, (_, idx) => {
        const ts = now - (days - idx - 1) * dayMs;
        return {
            ts,
            day: toDayKey(ts),
        };
    });
};

const NAME_A = [
    'Neon',
    'Silver',
    'Turbo',
    'Mango',
    'Dusty',
    'Echo',
    'Lucky',
    'Rogue',
    'Pixel',
    'Nova',
    'Crimson',
    'Kilo',
] as const;

const NAME_B = [
    'Fox',
    'Drift',
    'Rider',
    'Bandit',
    'Nomad',
    'Comet',
    'Falcon',
    'Warden',
    'Scout',
    'Pilot',
    'Viking',
    'Cipher',
] as const;

const makeName = (idx: number) =>
    `${NAME_A[idx % NAME_A.length]}${NAME_B[(idx + 2) % NAME_B.length]}${String(100 + idx).slice(-3)}`;

export const getMockInsightsData = (now = Date.now()) => {
    const phase = Math.floor(now / 300_000);

    const playerCount = (): InsightsPlayerCountResp => {
        const points = Array.from({ length: 96 }, (_, idx) => {
            const ts = now - (95 - idx) * 15 * 60 * 1000;
            const swing = Math.sin((idx + phase) / 8) * 18 + Math.cos((idx + phase) / 21) * 8;
            const players = Math.round(clamp(74 + swing, 28, 128));
            return {
                ts,
                players,
                fxsMemory: clamp(1240 + players * 2.6 + Math.sin(idx / 6) * 34, 1100, 1880),
                nodeMemory: clamp(260 + players * 0.8 + Math.cos(idx / 5) * 19, 180, 540),
            };
        });

        let peakCount = 0;
        let peakTs = points[0]?.ts ?? now;
        for (const p of points) {
            if (p.players > peakCount) {
                peakCount = p.players;
                peakTs = p.ts;
            }
        }

        return {
            series: points,
            peakCount,
            peakTs,
        };
    };

    const newPlayers = (): InsightsNewPlayersResp => {
        const days = buildRecentDays(45, now);
        const daily = days.map((d, idx) => ({
            day: d.day,
            count: Math.max(1, Math.round(6 + Math.sin((idx + phase) / 5) * 4 + Math.cos(idx / 13) * 2)),
        }));

        return {
            daily,
            totalPlayers: 6832,
        };
    };

    const topPlayers = (): InsightsTopPlayersResp => {
        return {
            players: Array.from({ length: 24 }, (_, idx) => {
                const rank = idx + 1;
                const playTime = 18000 - idx * 420 + (idx % 4) * 55;
                return {
                    displayName: makeName(rank),
                    license: `license:${(8000 + rank).toString(16).padStart(10, '0')}`,
                    playTime,
                    tsJoined: now - (380 - idx * 6) * 24 * 60 * 60 * 1000,
                    tsLastConnection: now - (idx % 3) * 2 * 60 * 60 * 1000,
                };
            }),
        };
    };

    const playtimeDist = (): InsightsPlaytimeDistResp => {
        const buckets = [
            { label: '< 1h', minMinutes: 0, maxMinutes: 60, count: 426 },
            { label: '1-5h', minMinutes: 60, maxMinutes: 300, count: 1164 },
            { label: '5-20h', minMinutes: 300, maxMinutes: 1200, count: 1530 },
            { label: '20-50h', minMinutes: 1200, maxMinutes: 3000, count: 928 },
            { label: '50-100h', minMinutes: 3000, maxMinutes: 6000, count: 514 },
            { label: '100h+', minMinutes: 6000, maxMinutes: 100000, count: 241 },
        ];

        return {
            buckets,
            medianMinutes: 980,
            averageMinutes: 1784,
            totalPlayers: buckets.reduce((sum, b) => sum + b.count, 0),
        };
    };

    const retention = (): InsightsRetentionResp => ({
        returnRate: 71,
        returnRate1d: 62,
        returnRate7d: 49,
        returnRate30d: 34,
        sampleSize: 4921,
        activeLast7d: 41,
        activeLast30d: 63,
    });

    const uptimeTimeline = (): InsightsUptimeResp => {
        const start = now - 10 * 24 * 60 * 60 * 1000;
        const rows = [] as { start: number; end: number; status: 'online' | 'offline' }[];

        let cursor = start;
        for (let idx = 0; idx < 18; idx++) {
            const online = idx % 5 !== 3;
            const durationHours = online ? 10 + ((idx * 3) % 9) : 1 + (idx % 2);
            const end = cursor + durationHours * 60 * 60 * 1000;
            rows.push({ start: cursor, end, status: online ? 'online' : 'offline' });
            cursor = end;
            if (cursor >= now) break;
        }

        const lastRow = rows.at(-1);
        if (lastRow && lastRow.end < now) {
            rows.push({ start: lastRow.end, end: now, status: 'online' });
        }

        return { segments: rows };
    };

    const disconnectReasons = (): InsightsDisconnectReasonsResp => ({
        categories: [
            { category: 'player', count: 482 },
            { category: 'timeout', count: 231 },
            { category: 'resource', count: 98 },
            { category: 'crash', count: 61 },
            { category: 'security', count: 27 },
            { category: 'unknown', count: 44 },
        ],
        totalDrops: 943,
    });

    const peakHours = (): InsightsPeakHoursResp => {
        const cells = [] as { dayOfWeek: number; hour: number; avgPlayers: number }[];
        let maxAvg = 0;
        for (let dow = 0; dow < 7; dow++) {
            for (let hour = 0; hour < 24; hour++) {
                const primeWindow = Math.exp(-Math.pow((hour - 21) / 5, 2));
                const weekendBoost = dow === 5 || dow === 6 ? 1.25 : 1;
                const lunchBump = Math.exp(-Math.pow((hour - 13) / 4.5, 2)) * 0.4;
                const avgPlayers = Math.round(clamp((22 + primeWindow * 64 + lunchBump * 20) * weekendBoost, 3, 104));
                maxAvg = Math.max(maxAvg, avgPlayers);
                cells.push({ dayOfWeek: dow, hour, avgPlayers });
            }
        }
        return { cells, maxAvg };
    };

    const actionsTimeline = (): InsightsActionsTimelineResp => {
        const days = buildRecentDays(45, now);
        return {
            daily: days.map((d, idx) => ({
                day: d.day,
                bans: Math.max(0, Math.round(1 + Math.sin((idx + phase) / 6) * 1.2)),
                warns: Math.max(0, Math.round(6 + Math.cos((idx + phase) / 5) * 3)),
                kicks: Math.max(0, Math.round(3 + Math.sin((idx + phase) / 8) * 2.3)),
            })),
        };
    };

    const playerGrowth = (): InsightsPlayerGrowthResp => {
        const days = buildRecentDays(120, now);
        let cumulative = 5200;
        const data = days.map((d, idx) => {
            const delta = Math.max(0, Math.round(5 + Math.sin((idx + phase) / 7) * 3 + Math.cos(idx / 17) * 2));
            cumulative += delta;
            return { day: d.day, cumulative };
        });

        return {
            data,
            totalPlayers: data.at(-1)?.cumulative ?? cumulative,
        };
    };

    const sessionLength = (): InsightsSessionLengthResp => {
        const buckets = [
            { label: '< 10m', count: 181 },
            { label: '10-30m', count: 402 },
            { label: '30-60m', count: 688 },
            { label: '1-2h', count: 792 },
            { label: '2-4h', count: 506 },
            { label: '4h+', count: 163 },
        ];

        return {
            avgMinutes: 96,
            medianMinutes: 71,
            totalSessions: buckets.reduce((sum, b) => sum + b.count, 0),
            buckets,
            hoursAnalyzed: 336,
        };
    };

    const dailyPlayers = (): InsightsDailyPlayersResp => {
        const days = buildRecentDays(45, now);
        return {
            daily: days.map((d, idx) => ({
                day: d.day,
                newPlayers: Math.max(1, Math.round(5 + Math.sin((idx + phase) / 5) * 2.8)),
                returningPlayers: Math.max(12, Math.round(48 + Math.cos((idx + phase) / 6) * 11)),
            })),
            daysAnalyzed: days.length,
        };
    };

    return {
        playerCount: playerCount(),
        newPlayers: newPlayers(),
        topPlayers: topPlayers(),
        playtimeDist: playtimeDist(),
        retention: retention(),
        uptimeTimeline: uptimeTimeline(),
        disconnectReasons: disconnectReasons(),
        peakHours: peakHours(),
        actionsTimeline: actionsTimeline(),
        playerGrowth: playerGrowth(),
        sessionLength: sessionLength(),
        dailyPlayers: dailyPlayers(),
    };
};
