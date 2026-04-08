import { atom, useAtom, useAtomValue, useSetAtom } from 'jotai';

const visibilityState = atom<boolean>(false);

export const useIsMenuVisibleValue = () => useAtomValue(visibilityState);

export const useSetIsMenuVisible = () => useSetAtom(visibilityState);

export const useIsMenuVisible = () => useAtom(visibilityState);
