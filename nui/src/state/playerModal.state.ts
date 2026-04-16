import { atom, useAtom, useAtomValue, useSetAtom } from 'jotai';

export enum PlayerModalTabs {
    ACTIONS,
    INFO,
    IDENTIFIERS,
    HISTORY,
    BAN,
}

const playerModalTabAtom = atom<PlayerModalTabs>(PlayerModalTabs.ACTIONS);

export const usePlayerModalTabValue = () => useAtomValue(playerModalTabAtom);
export const useSetPlayerModalTab = () => useSetAtom(playerModalTabAtom);
export const usePlayerModalTab = () => useAtom(playerModalTabAtom);

const modalVisibilityAtom = atom(false);

export const usePlayerModalVisbilityValue = () => useAtomValue(modalVisibilityAtom);
export const usePlayerModalVisibility = () => useAtom(modalVisibilityAtom);
export const useSetPlayerModalVisibility = () => useSetAtom(modalVisibilityAtom);

export type PendingPlayerAction = 'kick' | 'warn' | null;
const pendingPlayerActionAtom = atom<PendingPlayerAction>(null);

export const usePendingPlayerActionValue = () => useAtomValue(pendingPlayerActionAtom);
export const useSetPendingPlayerAction = () => useSetAtom(pendingPlayerActionAtom);
