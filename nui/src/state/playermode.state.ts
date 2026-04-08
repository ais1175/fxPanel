import { atom, useAtom } from 'jotai';

export enum PlayerMode {
    DEFAULT = 'none',
    NOCLIP = 'noclip',
    GOD_MODE = 'godmode',
    SUPER_JUMP = 'superjump',
}

const playermodeState = atom(PlayerMode.DEFAULT);

export const usePlayerMode = () => useAtom(playermodeState);
