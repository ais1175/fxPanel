import { atom, useAtom } from 'jotai';

export enum TeleportMode {
    WAYPOINT = 'waypoint',
    COORDINATES = 'coords',
    PREVIOUS = 'previous',
    COPY = 'copy',
}

const teleportMode = atom(TeleportMode.WAYPOINT);

export const useTeleportMode = () => useAtom(teleportMode);
