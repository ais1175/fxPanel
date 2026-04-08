import type { GenericApiErrorResp } from './genericApiTypes';

// ── Player count + RAM time series ──

export type InsightsPlayerCountPoint = {
    ts: number;
    players: number;
    fxsMemory: number | null;
    nodeMemory: number | null;
};

export type InsightsPlayerCountResp =
    | {
          series: InsightsPlayerCountPoint[];
          peakCount: number;
          peakTs: number;
      }
    | GenericApiErrorResp;

// ── New players per day ──

export type InsightsNewPlayersDayEntry = {
    day: string; // 'YYYY-MM-DD'
    count: number;
};

export type InsightsNewPlayersResp =
    | {
          daily: InsightsNewPlayersDayEntry[];
          totalPlayers: number;
      }
    | GenericApiErrorResp;

// ── Top players by playtime ──

export type InsightsTopPlayer = {
    displayName: string;
    license: string;
    playTime: number; // minutes
    tsJoined: number;
    tsLastConnection: number;
};

export type InsightsTopPlayersResp =
    | {
          players: InsightsTopPlayer[];
      }
    | GenericApiErrorResp;

// ── Playtime distribution ──

export type InsightsPlaytimeBucket = {
    label: string;
    minMinutes: number;
    maxMinutes: number;
    count: number;
};

export type InsightsPlaytimeDistResp =
    | {
          buckets: InsightsPlaytimeBucket[];
          medianMinutes: number;
          averageMinutes: number;
          totalPlayers: number;
      }
    | GenericApiErrorResp;

// ── Player retention ──

export type InsightsRetentionResp =
    | {
          /** % of players who played at least once after their join day */
          returnRate: number;
          /** % of players who played again within 1 day of joining */
          returnRate1d: number;
          /** % of players who played again within 7 days of joining */
          returnRate7d: number;
          /** % of players who played again within 30 days of joining */
          returnRate30d: number;
          /** Total players used in the calculation (joined > 30d ago) */
          sampleSize: number;
          /** % of players who played in the last 7 days out of those who ever joined */
          activeLast7d: number;
          /** % of players who played in the last 30 days out of those who ever joined */
          activeLast30d: number;
      }
    | GenericApiErrorResp;

// ── Server uptime timeline ──

export type InsightsUptimeSegment = {
    start: number;
    end: number;
    status: 'online' | 'offline';
};

export type InsightsUptimeResp =
    | {
          segments: InsightsUptimeSegment[];
      }
    | GenericApiErrorResp;

// ── Disconnect reasons (14d) ──

export type InsightsDisconnectReasonsResp =
    | {
          categories: { category: string; count: number }[];
          totalDrops: number;
      }
    | GenericApiErrorResp;

// ── Peak hours heatmap ──

export type InsightsPeakHoursCell = {
    dayOfWeek: number; // 0=Sunday, 6=Saturday
    hour: number; // 0-23
    avgPlayers: number;
};

export type InsightsPeakHoursResp =
    | {
          cells: InsightsPeakHoursCell[];
          maxAvg: number;
      }
    | GenericApiErrorResp;

// ── Actions timeline ──

export type InsightsActionsTimelineDay = {
    day: string; // YYYY-MM-DD
    bans: number;
    warns: number;
    kicks: number;
};

export type InsightsActionsTimelineResp =
    | {
          daily: InsightsActionsTimelineDay[];
      }
    | GenericApiErrorResp;

// ── Player growth ──

export type InsightsPlayerGrowthPoint = {
    day: string; // YYYY-MM-DD
    cumulative: number;
};

export type InsightsPlayerGrowthResp =
    | {
          data: InsightsPlayerGrowthPoint[];
          totalPlayers: number;
      }
    | GenericApiErrorResp;

// ── Session length ──

export type InsightsSessionLengthBucket = {
    label: string;
    count: number;
};

export type InsightsSessionLengthResp =
    | {
          avgMinutes: number;
          medianMinutes: number;
          totalSessions: number;
          buckets: InsightsSessionLengthBucket[];
          hoursAnalyzed: number;
      }
    | GenericApiErrorResp;

// ── Returning vs new players ──

export type InsightsDailyPlayersDay = {
    day: string; // YYYY-MM-DD
    newPlayers: number;
    returningPlayers: number;
};

export type InsightsDailyPlayersResp =
    | {
          daily: InsightsDailyPlayersDay[];
          daysAnalyzed: number;
      }
    | GenericApiErrorResp;
