import { useEffect, useRef, useState, useCallback } from 'react';
import { getSocket, joinSocketRoom, leaveSocketRoom } from '@/lib/utils';
import { useBackendApi } from '@/hooks/fetch';
import type { SystemLogEntry } from '@shared/systemLogTypes';
import type { ActionLogFilterKey, ActionLogFiltersState } from './actionLogTypes';
import { ACTION_LOG_FILTERS, DEFAULT_ACTION_FILTERS, LOCALSTORAGE_ACTION_FILTERS_KEY } from './actionLogTypes';

const MAX_EVENTS = 2000;
const HISTORY_PAGE_SIZE = 500;

export type SessionFile = {
    name: string;
    size: string;
    ts: string;
    mtime: number;
};

const loadFilters = (): ActionLogFiltersState => {
    try {
        const stored = localStorage.getItem(LOCALSTORAGE_ACTION_FILTERS_KEY);
        if (stored) {
            const parsed = JSON.parse(stored);
            return { ...DEFAULT_ACTION_FILTERS, ...parsed };
        }
    } catch (_) {
        /* ignore */
    }
    return { ...DEFAULT_ACTION_FILTERS };
};

const saveFilters = (filters: ActionLogFiltersState) => {
    localStorage.setItem(LOCALSTORAGE_ACTION_FILTERS_KEY, JSON.stringify(filters));
};

const getVisibleCategories = (filters: ActionLogFiltersState): Set<string> => {
    const categories = new Set<string>();
    for (const filter of ACTION_LOG_FILTERS) {
        if (filters[filter.key]) {
            categories.add(filter.key);
        }
    }
    return categories;
};

export default function useActionLog() {
    const [events, setEvents] = useState<SystemLogEntry[]>([]);
    const [isLive, setIsLive] = useState(true);
    const [isConnected, setIsConnected] = useState(false);
    const [isLoadingOlder, setIsLoadingOlder] = useState(false);
    const [hasOlderData, setHasOlderData] = useState(true);
    const [filters, setFilters] = useState<ActionLogFiltersState>(loadFilters);
    const [searchText, setSearchText] = useState('');
    const [adminFilter, setAdminFilter] = useState<string | null>(null);
    const [sessions, setSessions] = useState<SessionFile[]>([]);
    const [activeSession, setActiveSession] = useState<string | null>(null);
    const [isLoadingSession, setIsLoadingSession] = useState(false);

    const pageSocket = useRef<ReturnType<typeof getSocket> | null>(null);

    // ── Partial history API ──
    const historyApi = useBackendApi<{ boundry: boolean; log: SystemLogEntry[] }>({
        method: 'GET',
        path: '/logs/system/partial',
        throwGenericErrors: true,
    });

    // ── Session APIs ──
    const sessionsApi = useBackendApi<{ sessions: SessionFile[] }>({
        method: 'GET',
        path: '/logs/system/sessions',
        throwGenericErrors: true,
    });
    const sessionFileApi = useBackendApi<{ events: SystemLogEntry[] }>({
        method: 'GET',
        path: '/logs/system/session',
        throwGenericErrors: true,
    });

    // ── Fetch session list on mount ──
    useEffect(() => {
        sessionsApi({})
            .then((resp) => {
                if (resp?.sessions) setSessions(resp.sessions);
            })
            .catch(() => {
                /* ignore */
            });
    }, []);

    // ── Socket connection ──
    useEffect(() => {
        if (!isLive) return;

        const socket = getSocket();
        pageSocket.current = socket;
        setIsConnected(socket.connected);

        const connectHandler = () => {
            setIsConnected(true);
        };
        const disconnectHandler = () => {
            setIsConnected(false);
        };
        const logDataHandler = (data: SystemLogEntry | SystemLogEntry[]) => {
            const entries = Array.isArray(data) ? data : [data];
            setEvents((prev) => {
                const merged = [...prev, ...entries];
                if (merged.length > MAX_EVENTS) {
                    return merged.slice(-MAX_EVENTS);
                }
                return merged;
            });
        };

        socket.on('connect', connectHandler);
        socket.on('disconnect', disconnectHandler);
        (socket as any).on('systemLogData', logDataHandler);
        joinSocketRoom('systemlog');

        return () => {
            socket.off('connect', connectHandler);
            socket.off('disconnect', disconnectHandler);
            (socket as any).off('systemLogData', logDataHandler);
            leaveSocketRoom('systemlog');
            pageSocket.current = null;
            setIsConnected(false);
        };
    }, [isLive]);

    // ── Toggle live/paused ──
    const toggleLive = useCallback(() => {
        setIsLive((prev) => !prev);
    }, []);

    const goLive = useCallback(() => {
        setActiveSession(null);
        setEvents([]);
        setHasOlderData(true);
        setIsLive(true);
    }, []);

    // ── Load historical session ──
    const loadSession = useCallback(
        async (fileName: string) => {
            setIsLive(false);
            setActiveSession(fileName);
            setEvents([]);
            setHasOlderData(false);
            setIsLoadingSession(true);
            try {
                const resp = await sessionFileApi({ queryParams: { file: fileName } });
                if (resp?.events) {
                    setEvents(resp.events);
                }
            } catch (_) {
                /* silently fail */
            } finally {
                setIsLoadingSession(false);
            }
        },
        [sessionFileApi],
    );

    // ── Load older events ──
    const loadOlder = useCallback(async () => {
        if (isLoadingOlder || !hasOlderData || events.length === 0) return;
        const oldestTs = events[0].ts;
        setIsLoadingOlder(true);
        try {
            const resp = await historyApi({
                queryParams: { dir: 'older', ref: String(oldestTs) },
            });
            if (!resp || !Array.isArray(resp.log)) return;
            if (resp.boundry) setHasOlderData(false);
            if (resp.log.length > 0) {
                setEvents((prev) => {
                    const merged = [...resp.log, ...prev];
                    if (merged.length > MAX_EVENTS) {
                        return merged.slice(-MAX_EVENTS);
                    }
                    return merged;
                });
            } else {
                setHasOlderData(false);
            }
        } catch (_) {
            /* silently fail */
        } finally {
            setIsLoadingOlder(false);
        }
    }, [isLoadingOlder, hasOlderData, events, historyApi]);

    // ── Jump to time ──
    const jumpToTime = useCallback(
        async (timestamp: number) => {
            setIsLive(false);
            setActiveSession(null);
            setEvents([]);
            setHasOlderData(true);
            setIsLoadingOlder(true);
            try {
                const resp = await historyApi({
                    queryParams: { dir: 'newer', ref: String(timestamp) },
                });
                if (!resp || !Array.isArray(resp.log)) return;
                setEvents(resp.log);
                if (resp.boundry) {
                    goLive();
                }
            } catch (_) {
                /* silently fail */
            } finally {
                setIsLoadingOlder(false);
            }
        },
        [historyApi, goLive],
    );

    // ── Filter management ──
    const toggleFilter = useCallback((key: ActionLogFilterKey) => {
        setFilters((prev) => {
            const next = { ...prev, [key]: !prev[key] };
            saveFilters(next);
            return next;
        });
    }, []);

    const setAllFilters = useCallback((enabled: boolean) => {
        setFilters(() => {
            const next: ActionLogFiltersState = { ...DEFAULT_ACTION_FILTERS };
            for (const key of Object.keys(next) as ActionLogFilterKey[]) {
                next[key] = enabled;
            }
            saveFilters(next);
            return next;
        });
    }, []);

    // ── Filtered & searched events ──
    const visibleCategories = getVisibleCategories(filters);
    const searchLower = searchText.toLowerCase();

    const filteredEvents = events.filter((e) => {
        if (!visibleCategories.has(e.category)) return false;
        if (adminFilter && e.author !== adminFilter) return false;
        if (searchLower) {
            const haystack = `${e.author} ${e.action}`.toLowerCase();
            if (!haystack.includes(searchLower)) return false;
        }
        return true;
    });

    // ── Event counts per filter ──
    const eventCounts: Record<ActionLogFilterKey, number> = {
        action: 0,
        command: 0,
        config: 0,
        login: 0,
        monitor: 0,
        scheduler: 0,
        system: 0,
    };
    for (const event of events) {
        if (event.category in eventCounts) {
            eventCounts[event.category]++;
        }
    }

    return {
        events: filteredEvents,
        allEventsCount: events.length,
        eventCounts,
        isLive,
        isConnected,
        isLoadingOlder,
        isLoadingSession,
        hasOlderData,
        filters,
        searchText,
        adminFilter,
        sessions,
        activeSession,
        toggleLive,
        goLive,
        loadOlder,
        loadSession,
        jumpToTime,
        toggleFilter,
        setAllFilters,
        setSearchText,
        setAdminFilter,
    };
}
