import { atom, useAtomValue, useSetAtom } from 'jotai';

const tabState = atom(false);

// setter - Disable tab nav
export const useSetDisableTab = () => useSetAtom(tabState);
// value - disable tab nav
export const useTabDisabledValue = () => useAtomValue(tabState);

const listenForExitState = atom(true);
// setter - Listen for ESC/Delete keys
export const useSetListenForExit = () => useSetAtom(listenForExitState);

// value - Listen for ESC/Delete keys
export const useListenForExitValue = () => useAtomValue(listenForExitState);
