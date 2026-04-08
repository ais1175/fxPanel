import { atom, useAtom, useAtomValue } from 'jotai';

const isRedmState = atom(false);
export const useIsRedmValue = () => useAtomValue(isRedmState);
export const useIsRedm = () => useAtom(isRedmState);
