import { useAtom } from 'jotai';
import { atomWithStorage, createJSONStorage } from 'jotai/utils';
import type { LiveConsoleOptions } from './LiveConsolePage';

/**
 * Custom storage adapter for LiveConsoleOptions
 * Maps between the LiveConsoleOptions shape and the two legacy localStorage keys
 */
const liveConsoleOptionsStorage = createJSONStorage<LiveConsoleOptions>(() => ({
    getItem: (): LiveConsoleOptions => {
        let timestampDisabled = false;
        let timestampForceHour12: boolean | undefined = undefined;
        let copyTimestamp = false;
        let copyTag = true;
        try {
            const tsConfig = localStorage.getItem('liveConsoleTimestamp');
            if (tsConfig === '24h') {
                timestampForceHour12 = false;
            } else if (tsConfig === '12h') {
                timestampForceHour12 = true;
            } else if (tsConfig === 'off') {
                timestampDisabled = true;
            }
        } catch (error) {}
        try {
            const copyConfig = localStorage.getItem('liveConsoleCopyOpts');
            if (typeof copyConfig === 'string') {
                const parts = copyConfig.split(',');
                copyTimestamp = parts.includes('ts');
                copyTag = parts.includes('tag');
            }
        } catch (error) {}
        return { timestampDisabled, timestampForceHour12, copyTimestamp, copyTag } as any;
    },
    setItem: (_key: string, newValue: LiveConsoleOptions) => {
        try {
            if (newValue.timestampDisabled) {
                localStorage.setItem('liveConsoleTimestamp', 'off');
            } else if (newValue.timestampForceHour12 === true) {
                localStorage.setItem('liveConsoleTimestamp', '12h');
            } else if (newValue.timestampForceHour12 === false) {
                localStorage.setItem('liveConsoleTimestamp', '24h');
            } else {
                localStorage.removeItem('liveConsoleTimestamp');
            }
            const copyParts: string[] = [];
            if (newValue.copyTimestamp) copyParts.push('ts');
            if (newValue.copyTag) copyParts.push('tag');
            localStorage.setItem('liveConsoleCopyOpts', copyParts.join(','));
        } catch (error) {}
    },
    removeItem: () => {
        try {
            localStorage.removeItem('liveConsoleTimestamp');
            localStorage.removeItem('liveConsoleCopyOpts');
        } catch (error) {}
    },
}));

const defaultConsoleOptions: LiveConsoleOptions = {
    timestampDisabled: false,
    timestampForceHour12: undefined,
    copyTimestamp: false,
    copyTag: true,
};

export const liveConsoleOptionsAtom = atomWithStorage<LiveConsoleOptions>(
    'liveConsoleOptions', // key (not used by our custom storage, but required by the API)
    defaultConsoleOptions,
    liveConsoleOptionsStorage,
);

/**
 * Atoms
 */
const liveConsoleHistoryAtom = atomWithStorage<string[]>('liveConsoleCommandHistory', []);
const liveConsoleBookmarksAtom = atomWithStorage<string[]>('liveConsoleCommandBookmarks', []);
const historyMaxLength = 50;

/**
 * Hooks
 */
export const useLiveConsoleHistory = () => {
    const [history, setHistory] = useAtom(liveConsoleHistoryAtom);
    return {
        history,
        setHistory,
        appendHistory: (cmd: string) => {
            const newHistory = history.filter((h) => h !== cmd);
            if (newHistory.unshift(cmd) > historyMaxLength) newHistory.pop();
            setHistory(newHistory);
        },
        wipeHistory: () => {
            setHistory([]);
        },
    };
};

export const useLiveConsoleBookmarks = () => {
    const [bookmarks, setBookmarks] = useAtom(liveConsoleBookmarksAtom);
    return {
        bookmarks,
        addBookmark: (cmd: string) => {
            if (!bookmarks.includes(cmd)) {
                setBookmarks([cmd, ...bookmarks]);
            }
        },
        removeBookmark: (cmd: string) => {
            setBookmarks(bookmarks.filter((b) => b !== cmd));
        },
    };
};
