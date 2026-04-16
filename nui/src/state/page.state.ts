import { atom, useAtom, useAtomValue, useSetAtom } from 'jotai';

export enum txAdminMenuPage {
    Main,
    Players,
    Reports,
    PlayerModalOnly,
}

const pageState = atom<txAdminMenuPage>(txAdminMenuPage.Main);

export const usePage = () => useAtom(pageState);

export const useSetPage = () => useSetAtom(pageState);

export const usePageValue = () => useAtomValue(pageState);
