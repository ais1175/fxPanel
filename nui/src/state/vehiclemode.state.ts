import { atom, useAtom } from 'jotai';

export enum VehicleMode {
    SPAWN = 'spawn',
    FIX = 'fix',
    DELETE = 'delete',
    BOOST = 'boost',
}

const vehicleMode = atom(VehicleMode.SPAWN);

export const useVehicleMode = () => useAtom(vehicleMode);
