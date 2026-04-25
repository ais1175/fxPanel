import type { BanTemplatesDataType, SvRtPerfThreadNamesType } from './otherTypes';
import type { ReactAuthDataType } from './authApiTypes';
import type { UpdateDataType } from './otherTypes';
import { DiscordBotStatus, TxConfigState, type FxMonitorHealth } from './enums';
import type { LiveConsoleInitialData } from './consoleBlock';
import type { SpectateFrameEventData } from './spectateApiTypes';
import type { ResourcesWsEventType } from './resourcesApiTypes';

export type SvRtNodeMemoryType = {
    used: number;
    limit: number;
};
export type SvRtPerfBoundariesType = Array<number | '+Inf'>;

/**
 * Status channel
 */
export type GlobalStatusType = {
    serverTime: number;
    configState: TxConfigState;
    discord: DiscordBotStatus;
    runner: {
        isIdle: boolean;
        isChildAlive: boolean;
    };
    server: {
        name: string;
        uptime: number;
        health: FxMonitorHealth;
        healthReason: string;
        whitelist: 'disabled' | 'adminOnly' | 'approvedLicense' | 'discordMember' | 'discordRoles';
    };
    scheduler:
        | {
              nextRelativeMs: number;
              nextSkip: boolean;
              nextIsTemp: boolean;
          }
        | {
              nextRelativeMs: false;
              nextSkip: false;
              nextIsTemp: false;
          };
};

/**
 * Status channel
 */
export type DashboardSvRuntimeDataType = {
    fxsMemory?: number;
    nodeMemory?: SvRtNodeMemoryType;
    perfBoundaries?: SvRtPerfBoundariesType;
    perfBucketCounts?: {
        [key in SvRtPerfThreadNamesType]: number[];
    };
};
export type DashboardPleyerDropDataType = {
    summaryLast6h: [reasonCategory: string, count: number][];
};
export type DashboardDataEventType = {
    svRuntime: DashboardSvRuntimeDataType;
    playerDrop: DashboardPleyerDropDataType;
    // joinLeaveTally30m: {
    //     joined: number;
    //     left: number;
    // };
};

/**
 * Player tags
 */
export type TagDefinition = {
    id: string;
    label: string;
    color: string;
    priority: number;
    enabled?: boolean;
};

export const AUTO_TAG_DEFINITIONS: TagDefinition[] = [
    { id: 'staff', label: 'Staff', color: '#EF4444', priority: 10, enabled: true },
    { id: 'problematic', label: 'Problematic', color: '#FB923C', priority: 20, enabled: true },
    { id: 'newplayer', label: 'Newcomer', color: '#A3E635', priority: 30, enabled: true },
];

export type PlayerTag = string;

/**
 * Playerlist channel
 * TODO: apply those types to the playerlistManager
 */
export type FullPlayerlistEventType = {
    mutex: string | null;
    type: 'fullPlayerlist';
    playerlist: PlayerlistPlayerType[];
    tagDefinitions: TagDefinition[];
};

export type PlayerlistPlayerType = {
    netid: number;
    displayName: string;
    pureName: string;
    ids: string[];
    license: string | null;
    tags: PlayerTag[];
};

export type PlayerDroppedEventType = {
    mutex: string;
    type: 'playerDropped';
    netid: number;
    reasonCategory?: string; //missing in case of server shutdown
};

export type PlayerJoiningEventType = {
    mutex: string;
    type: 'playerJoining';
} & PlayerlistPlayerType;

export type PlayerlistEventType = FullPlayerlistEventType | PlayerDroppedEventType | PlayerJoiningEventType;

/**
 * Standalone events (no room)
 */
export type UpdateAvailableEventType = {
    fxserver?: UpdateDataType;
    txadmin?: UpdateDataType;
};

/**
 * Listen Events Map
 */
export type ListenEventsMap = {
    error: (reason?: string) => void;
    logout: (reason?: string) => void;
    refreshToUpdate: () => void;
    txAdminShuttingDown: () => void;
    status: (status: GlobalStatusType) => void;
    playerlist: (playerlistData: PlayerlistEventType[]) => void;
    updateAuthData: (authData: ReactAuthDataType) => void;
    consoleData: (data: string | LiveConsoleInitialData) => void;
    logData: (data: { ts: number; type: string; src: { id: string | false; name: string }; msg: string }[]) => void;
    dashboard: (data: DashboardDataEventType) => void;
    banTemplatesUpdate: (data: BanTemplatesDataType[]) => void;
    resources: (data: ResourcesWsEventType) => void;

    //Standalone events
    updateAvailable: (event: UpdateAvailableEventType) => void;

    //Live spectate
    spectateFrame: (data: SpectateFrameEventData) => void;
};
