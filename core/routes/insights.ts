const modulename = 'WebServer:Insights';
import { AuthedCtx } from '@modules/WebServer/ctxTypes';
import { now } from '@lib/misc';
import type {
    InsightsPlayerCountResp,
    InsightsNewPlayersResp,
    InsightsTopPlayersResp,
    InsightsPlaytimeDistResp,
    InsightsRetentionResp,
    InsightsUptimeResp,
    InsightsUptimeSegment,
    InsightsDisconnectReasonsResp,
    InsightsPeakHoursResp,
    InsightsActionsTimelineResp,
    InsightsPlayerGrowthResp,
    InsightsSessionLengthResp,
    InsightsDailyPlayersResp,
} from '@shared/insightsApiTypes';
import consoleFactory from '@lib/console';
const console = consoleFactory(modulename);

/**
 * Returns the player count + memory time series from perf log (up to 96h)
 */
export const insightsPlayerCount = async (ctx: AuthedCtx) => {
    const sendTypedResp = (data: InsightsPlayerCountResp) => ctx.send(data);
    try {
        const series = txCore.metrics.svRuntime.getPlayerCountSeries();
        if (!series.length) {
            return sendTypedResp({ error: 'No performance data available yet.' });
        }
        let peakCount = 0;
        let peakTs = 0;
        for (const point of series) {
            if (point.players > peakCount) {
                peakCount = point.players;
                peakTs = point.ts;
            }
        }
        return sendTypedResp({ series, peakCount, peakTs });
    } catch (error) {
        return sendTypedResp({ error: `Failed to get player count data: ${emsg(error)}` });
    }
};

/**
 * Returns new players per day aggregation
 */
export const insightsNewPlayers = async (ctx: AuthedCtx) => {
    const sendTypedResp = (data: InsightsNewPlayersResp) => ctx.send(data);
    try {
        const db = txCore.database.getDboRef();
        const players = db.chain.get('players').value();

        // Aggregate by day (local timezone)
        const dayCounts: Record<string, number> = {};
        for (const player of players) {
            const date = new Date(player.tsJoined * 1000);
            const day = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
            dayCounts[day] = (dayCounts[day] || 0) + 1;
        }

        // Sort by date and take last 90 days
        const sortedDays = Object.entries(dayCounts)
            .map(([day, count]) => ({ day, count }))
            .sort((a, b) => a.day.localeCompare(b.day))
            .slice(-90);

        return sendTypedResp({
            daily: sortedDays,
            totalPlayers: players.length,
        });
    } catch (error) {
        return sendTypedResp({ error: `Failed to get new players data: ${emsg(error)}` });
    }
};

/**
 * Returns top players by playtime
 */
export const insightsTopPlayers = async (ctx: AuthedCtx) => {
    const sendTypedResp = (data: InsightsTopPlayersResp) => ctx.send(data);
    try {
        const db = txCore.database.getDboRef();
        const topPlayers = db.chain
            .get('players')
            .sortBy('playTime')
            .reverse()
            .take(20)
            .map((p) => ({
                displayName: p.displayName,
                license: p.license,
                playTime: p.playTime,
                tsJoined: p.tsJoined,
                tsLastConnection: p.tsLastConnection,
            }))
            .value();

        return sendTypedResp({ players: topPlayers });
    } catch (error) {
        return sendTypedResp({ error: `Failed to get top players data: ${emsg(error)}` });
    }
};

/**
 * Returns playtime distribution histogram
 */
export const insightsPlaytimeDist = async (ctx: AuthedCtx) => {
    const sendTypedResp = (data: InsightsPlaytimeDistResp) => ctx.send(data);
    try {
        const db = txCore.database.getDboRef();
        const players = db.chain.get('players').value();
        if (!players.length) {
            return sendTypedResp({ error: 'No player data available.' });
        }

        const bucketDefs = [
            { label: '< 1h', minMinutes: 0, maxMinutes: 60 },
            { label: '1–5h', minMinutes: 60, maxMinutes: 300 },
            { label: '5–10h', minMinutes: 300, maxMinutes: 600 },
            { label: '10–24h', minMinutes: 600, maxMinutes: 1440 },
            { label: '1–3d', minMinutes: 1440, maxMinutes: 4320 },
            { label: '3–7d', minMinutes: 4320, maxMinutes: 10080 },
            { label: '1–2w', minMinutes: 10080, maxMinutes: 20160 },
            { label: '2w+', minMinutes: 20160, maxMinutes: Infinity },
        ];

        const buckets = bucketDefs.map((def) => ({ ...def, count: 0 }));
        let totalMinutes = 0;
        const playTimes: number[] = [];

        for (const player of players) {
            totalMinutes += player.playTime;
            playTimes.push(player.playTime);
            for (const bucket of buckets) {
                if (player.playTime >= bucket.minMinutes && player.playTime < bucket.maxMinutes) {
                    bucket.count++;
                    break;
                }
            }
        }

        playTimes.sort((a, b) => a - b);
        const medianMinutes = playTimes[Math.floor(playTimes.length / 2)];
        const averageMinutes = Math.round(totalMinutes / players.length);

        return sendTypedResp({
            buckets,
            medianMinutes,
            averageMinutes,
            totalPlayers: players.length,
        });
    } catch (error) {
        return sendTypedResp({ error: `Failed to get playtime data: ${emsg(error)}` });
    }
};

/**
 * Returns player retention metrics
 */
export const insightsRetention = async (ctx: AuthedCtx) => {
    const sendTypedResp = (data: InsightsRetentionResp) => ctx.send(data);
    try {
        const db = txCore.database.getDboRef();
        const players = db.chain.get('players').value();
        if (!players.length) {
            return sendTypedResp({ error: 'No player data available.' });
        }

        const ts = now();
        const oneDay = 86400;

        // For retention: only consider players who joined > 30 days ago
        const maturePlayers = players.filter((p) => p.tsJoined < ts - 30 * oneDay);
        const sampleSize = maturePlayers.length;

        if (sampleSize < 10) {
            return sendTypedResp({ error: 'Not enough mature players (need at least 10 who joined 30+ days ago).' });
        }

        let returned = 0;
        let returned1d = 0;
        let returned7d = 0;
        let returned30d = 0;

        for (const player of maturePlayers) {
            // A player "returned" if they played after their join day
            // We approximate this by checking if tsLastConnection > tsJoined + threshold
            if (player.tsLastConnection > player.tsJoined + oneDay) {
                returned++;
                returned1d++;
            }
            if (player.tsLastConnection > player.tsJoined + 7 * oneDay) {
                returned7d++;
            }
            if (player.tsLastConnection > player.tsJoined + 30 * oneDay) {
                returned30d++;
            }
        }

        // Active rates (from all players)
        const activeLast7d = players.filter((p) => p.tsLastConnection > ts - 7 * oneDay).length;
        const activeLast30d = players.filter((p) => p.tsLastConnection > ts - 30 * oneDay).length;

        return sendTypedResp({
            returnRate: Math.round((returned / sampleSize) * 100),
            returnRate1d: Math.round((returned1d / sampleSize) * 100),
            returnRate7d: Math.round((returned7d / sampleSize) * 100),
            returnRate30d: Math.round((returned30d / sampleSize) * 100),
            sampleSize,
            activeLast7d: Math.round((activeLast7d / players.length) * 100),
            activeLast30d: Math.round((activeLast30d / players.length) * 100),
        });
    } catch (error) {
        return sendTypedResp({ error: `Failed to get retention data: ${emsg(error)}` });
    }
};

/**
 * Returns server uptime/downtime segments from the performance log
 */
export const insightsUptimeTimeline = async (ctx: AuthedCtx) => {
    const sendTypedResp = (data: InsightsUptimeResp) => ctx.send(data);
    try {
        const log = txCore.metrics.svRuntime.getFullStatsLog();
        if (!log.length) {
            return sendTypedResp({ error: 'No performance data available yet.' });
        }

        const segments: InsightsUptimeSegment[] = [];
        let onlineStart: number | null = null;

        for (const entry of log) {
            if (entry.type === 'svBoot') {
                // If we were offline, mark the offline segment
                if (onlineStart === null && segments.length > 0) {
                    const lastSeg = segments[segments.length - 1];
                    segments.push({ start: lastSeg.end, end: entry.ts, status: 'offline' });
                }
                onlineStart = entry.ts;
            } else if (entry.type === 'svClose') {
                if (onlineStart !== null) {
                    segments.push({ start: onlineStart, end: entry.ts, status: 'online' });
                    onlineStart = null;
                }
            } else if (entry.type === 'data') {
                // If we haven't seen a boot event yet, infer online from first data entry
                if (onlineStart === null && segments.length === 0) {
                    onlineStart = entry.ts;
                }
            }
        }

        // Close the last open segment (still online)
        if (onlineStart !== null) {
            segments.push({ start: onlineStart, end: Date.now(), status: 'online' });
        }

        return sendTypedResp({ segments });
    } catch (error) {
        return sendTypedResp({ error: `Failed to get uptime data: ${emsg(error)}` });
    }
};

/**
 * Returns player disconnect reason tallies for the last 14 days
 */
export const insightsDisconnectReasons = async (ctx: AuthedCtx) => {
    const sendTypedResp = (data: InsightsDisconnectReasonsResp) => ctx.send(data);
    try {
        const tally = txCore.metrics.playerDrop.getRecentDropTally(336); // 14 days
        if (!tally.length) {
            return sendTypedResp({ error: 'No disconnect data available yet.' });
        }

        let totalDrops = 0;
        const categories = tally.map(([category, count]) => {
            totalDrops += count;
            return { category, count };
        });

        return sendTypedResp({ categories, totalDrops });
    } catch (error) {
        return sendTypedResp({ error: `Failed to get disconnect data: ${emsg(error)}` });
    }
};

/**
 * Returns a day-of-week × hour-of-day heatmap of average player counts
 */
export const insightsPeakHours = async (ctx: AuthedCtx) => {
    const sendTypedResp = (data: InsightsPeakHoursResp) => ctx.send(data);
    try {
        const series = txCore.metrics.svRuntime.getPlayerCountSeries();
        if (!series.length) {
            return sendTypedResp({ error: 'No performance data available yet.' });
        }

        // Bucket: dayOfWeek (0-6) × hour (0-23) → { sum, count }
        const grid: { sum: number; count: number }[][] = Array.from({ length: 7 }, () =>
            Array.from({ length: 24 }, () => ({ sum: 0, count: 0 })),
        );

        for (const point of series) {
            const d = new Date(point.ts);
            const dow = d.getDay();
            const hour = d.getHours();
            grid[dow][hour].sum += point.players;
            grid[dow][hour].count++;
        }

        let maxAvg = 0;
        const cells = [];
        for (let dow = 0; dow < 7; dow++) {
            for (let hour = 0; hour < 24; hour++) {
                const cell = grid[dow][hour];
                const avgPlayers = cell.count > 0 ? Math.round(cell.sum / cell.count) : 0;
                if (avgPlayers > maxAvg) maxAvg = avgPlayers;
                cells.push({ dayOfWeek: dow, hour, avgPlayers });
            }
        }

        return sendTypedResp({ cells, maxAvg });
    } catch (error) {
        return sendTypedResp({ error: `Failed to get peak hours data: ${emsg(error)}` });
    }
};

/**
 * Returns daily ban/warn/kick counts for the actions timeline chart
 */
export const insightsActionsTimeline = async (ctx: AuthedCtx) => {
    const sendTypedResp = (data: InsightsActionsTimelineResp) => ctx.send(data);
    try {
        const db = txCore.database.getDboRef();
        const actions = db.chain.get('actions').value();

        const dayCounts: Record<string, { bans: number; warns: number; kicks: number }> = {};
        for (const action of actions) {
            const date = new Date(action.timestamp * 1000);
            const day = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
            if (!dayCounts[day]) dayCounts[day] = { bans: 0, warns: 0, kicks: 0 };
            if (action.type === 'ban') dayCounts[day].bans++;
            else if (action.type === 'warn') dayCounts[day].warns++;
            else if (action.type === 'kick') dayCounts[day].kicks++;
        }

        const daily = Object.entries(dayCounts)
            .map(([day, counts]) => ({ day, ...counts }))
            .sort((a, b) => a.day.localeCompare(b.day))
            .slice(-90);

        return sendTypedResp({ daily });
    } catch (error) {
        return sendTypedResp({ error: `Failed to get actions timeline: ${emsg(error)}` });
    }
};

/**
 * Returns cumulative player growth over time
 */
export const insightsPlayerGrowth = async (ctx: AuthedCtx) => {
    const sendTypedResp = (data: InsightsPlayerGrowthResp) => ctx.send(data);
    try {
        const db = txCore.database.getDboRef();
        const players = db.chain.get('players').value();

        // Count new players per day
        const dayCounts: Record<string, number> = {};
        for (const player of players) {
            const date = new Date(player.tsJoined * 1000);
            const day = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
            dayCounts[day] = (dayCounts[day] || 0) + 1;
        }

        // Build cumulative timeline
        const sortedDays = Object.entries(dayCounts).sort(([a], [b]) => a.localeCompare(b));

        let cumulative = 0;
        const data = sortedDays.map(([day, count]) => {
            cumulative += count;
            return { day, cumulative };
        });

        return sendTypedResp({ data, totalPlayers: players.length });
    } catch (error) {
        return sendTypedResp({ error: `Failed to get growth data: ${emsg(error)}` });
    }
};

/**
 * Returns session length distribution from recent server log events
 */
export const insightsSessionLength = async (ctx: AuthedCtx) => {
    const sendTypedResp = (data: InsightsSessionLengthResp) => ctx.send(data);
    try {
        const events = txCore.logger.server.getRecentBuffer();
        if (!events.length) {
            return sendTypedResp({ error: 'No recent server log data available.' });
        }

        // Track pending sessions: srcId → join timestamp
        const pending = new Map<string, number>();
        const durations: number[] = [];

        for (const event of events) {
            if (event.type === 'playerJoining' && event.src.id) {
                pending.set(event.src.id as string, event.ts);
            } else if (event.type === 'playerDropped' && event.src.id) {
                const joinTs = pending.get(event.src.id as string);
                if (joinTs !== undefined) {
                    const durationMs = event.ts - joinTs;
                    const durationMin = durationMs / 60_000;
                    // Filter out unrealistic sessions (< 1min or > 24h)
                    if (durationMin >= 1 && durationMin <= 1440) {
                        durations.push(durationMin);
                    }
                    pending.delete(event.src.id as string);
                }
            }
        }

        if (!durations.length) {
            return sendTypedResp({ error: 'Not enough session data to analyze.' });
        }

        // Compute stats
        durations.sort((a, b) => a - b);
        const totalMinutes = durations.reduce((sum, d) => sum + d, 0);
        const avgMinutes = Math.round(totalMinutes / durations.length);
        const medianMinutes = Math.round(durations[Math.floor(durations.length / 2)]);

        // Build distribution buckets
        const bucketDefs = [
            { label: '< 5m', min: 0, max: 5 },
            { label: '5–15m', min: 5, max: 15 },
            { label: '15–30m', min: 15, max: 30 },
            { label: '30m–1h', min: 30, max: 60 },
            { label: '1–2h', min: 60, max: 120 },
            { label: '2–4h', min: 120, max: 240 },
            { label: '4–8h', min: 240, max: 480 },
            { label: '8h+', min: 480, max: Infinity },
        ];
        const buckets = bucketDefs.map((def) => {
            const count = durations.filter((d) => d >= def.min && d < def.max).length;
            return { label: def.label, count };
        });

        // Estimate how many hours of data we analyzed
        const oldestTs = events[0].ts;
        const newestTs = events[events.length - 1].ts;
        const hoursAnalyzed = Math.round((newestTs - oldestTs) / 3_600_000);

        return sendTypedResp({
            avgMinutes,
            medianMinutes,
            totalSessions: durations.length,
            buckets,
            hoursAnalyzed,
        });
    } catch (error) {
        return sendTypedResp({ error: `Failed to get session length data: ${emsg(error)}` });
    }
};

/**
 * Returns daily new vs returning player counts from server log session files
 */
export const insightsDailyPlayers = async (ctx: AuthedCtx) => {
    const sendTypedResp = (data: InsightsDailyPlayersResp) => ctx.send(data);
    try {
        // Collect playerJoining events from recentBuffer
        const recentEvents = txCore.logger.server.getRecentBuffer();
        const joinEvents: { ts: number; license: string }[] = [];

        // Extract license from playerJoining msg (format: "joined with identifiers license:xxx ...")
        const licenseRegex = /license:([a-f0-9]{40})/;

        for (const event of recentEvents) {
            if (event.type !== 'playerJoining') continue;
            const match = licenseRegex.exec(event.msg);
            if (match) {
                joinEvents.push({ ts: event.ts, license: match[1] });
            }
        }

        // Also try reading recent JSONL session files (cap at 10 files)
        try {
            const sessionFiles = await txCore.logger.server.listSessionFiles();
            const filesToRead = sessionFiles.slice(0, 10);
            for (const file of filesToRead) {
                const events = await txCore.logger.server.readSessionFile(file.name);
                for (const event of events) {
                    if (event.type !== 'playerJoining') continue;
                    const match = licenseRegex.exec(event.msg);
                    if (match) {
                        joinEvents.push({ ts: event.ts, license: match[1] });
                    }
                }
            }
        } catch (err) {
            // JSONL files are optional — recentBuffer data is still used
            console.verbose.warn('Failed to read session files for daily players:', emsg(err));
        }

        if (!joinEvents.length) {
            return sendTypedResp({ error: 'No player join data available.' });
        }

        // Build a set of all player tsJoined from DB for cross-reference
        const db = txCore.database.getDboRef();
        const allPlayers = db.chain.get('players').value();
        const playerJoinedMap = new Map<string, number>();
        for (const player of allPlayers) {
            playerJoinedMap.set(player.license, player.tsJoined);
        }

        // Group join events by day, deduplicate by license per day
        const dayData: Record<string, { newLicenses: Set<string>; returningLicenses: Set<string> }> = {};

        for (const { ts, license } of joinEvents) {
            const date = new Date(ts);
            const day = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;

            if (!dayData[day]) {
                dayData[day] = { newLicenses: new Set(), returningLicenses: new Set() };
            }

            // Check if this player's first-ever join (tsJoined) was on this day
            const tsJoined = playerJoinedMap.get(license);
            if (tsJoined !== undefined) {
                const joinedDate = new Date(tsJoined * 1000);
                const joinedDay = `${joinedDate.getFullYear()}-${String(joinedDate.getMonth() + 1).padStart(2, '0')}-${String(joinedDate.getDate()).padStart(2, '0')}`;
                if (joinedDay === day) {
                    dayData[day].newLicenses.add(license);
                } else {
                    dayData[day].returningLicenses.add(license);
                }
            } else {
                // Unknown player — treat as new
                dayData[day].newLicenses.add(license);
            }
        }

        const daily = Object.entries(dayData)
            .map(([day, data]) => ({
                day,
                newPlayers: data.newLicenses.size,
                returningPlayers: data.returningLicenses.size,
            }))
            .sort((a, b) => a.day.localeCompare(b.day));

        // Estimate how many days of data
        const oldestTs = joinEvents.reduce((min, e) => Math.min(min, e.ts), Infinity);
        const newestTs = joinEvents.reduce((max, e) => Math.max(max, e.ts), 0);
        const daysAnalyzed = Math.max(1, Math.round((newestTs - oldestTs) / 86_400_000));

        return sendTypedResp({ daily, daysAnalyzed });
    } catch (error) {
        return sendTypedResp({ error: `Failed to get daily players data: ${emsg(error)}` });
    }
};
