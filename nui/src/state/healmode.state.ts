import { atom, useAtom } from 'jotai';

export enum HealMode {
    SELF,
    ALL,
    RADIUS,
}

const healMode = atom(HealMode.SELF);

export const useHealMode = () => useAtom(healMode);
