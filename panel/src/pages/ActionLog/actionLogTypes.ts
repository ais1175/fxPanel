import type { SystemLogCategory } from '@shared/systemLogTypes';

export type ActionLogFilterKey = SystemLogCategory;

export type ActionLogFiltersState = Record<ActionLogFilterKey, boolean>;

export const ACTION_LOG_FILTERS: {
    key: ActionLogFilterKey;
    label: string;
    color: string;
    icon: string;
}[] = [
    { key: 'action', label: 'Actions', color: 'text-blue-400', icon: 'Zap' },
    { key: 'command', label: 'Commands', color: 'text-purple-400', icon: 'Terminal' },
    { key: 'config', label: 'Config', color: 'text-amber-400', icon: 'Settings' },
    { key: 'login', label: 'Logins', color: 'text-green-400', icon: 'LogIn' },
    { key: 'monitor', label: 'Monitor', color: 'text-red-400', icon: 'Activity' },
    { key: 'scheduler', label: 'Scheduler', color: 'text-cyan-400', icon: 'Clock' },
    { key: 'system', label: 'System', color: 'text-zinc-400', icon: 'Cpu' },
];

export const DEFAULT_ACTION_FILTERS: ActionLogFiltersState = {
    action: true,
    command: true,
    config: true,
    login: true,
    monitor: true,
    scheduler: true,
    system: true,
};

export const LOCALSTORAGE_ACTION_FILTERS_KEY = 'actionLogFilters';
