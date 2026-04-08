export const SystemLogCategories = ['action', 'command', 'config', 'login', 'monitor', 'scheduler', 'system'] as const;
export type SystemLogCategory = (typeof SystemLogCategories)[number];

export type SystemLogEntry = {
    ts: number;
    author: string;
    category: SystemLogCategory;
    action: string;
};
