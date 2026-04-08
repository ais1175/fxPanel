import { useMemo } from 'react';
import { useServerCtxValue } from '../state/server.state';
import localeMap from '@shared/localeMap';

const isObject = (value: unknown): value is Record<string, unknown> => {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
};

const mergeLocaleFallback = <T extends Record<string, unknown>>(fallback: T, target?: Record<string, unknown>): T => {
    if (!target) return fallback;

    const mergedEntries = Object.entries(fallback).map(([key, fallbackValue]) => {
        const targetValue = target[key];

        if (isObject(fallbackValue)) {
            return [key, mergeLocaleFallback(fallbackValue, isObject(targetValue) ? targetValue : undefined)];
        }

        return [key, targetValue ?? fallbackValue];
    });

    return Object.fromEntries(mergedEntries) as T;
};

export const useLocale = () => {
    const serverCtx = useServerCtxValue();

    return useMemo(() => {
        const fallbackLocale = localeMap.en;

        if (serverCtx.locale === 'custom' && typeof serverCtx.localeData === 'object') {
            return mergeLocaleFallback(fallbackLocale, serverCtx.localeData);
        } else {
            if (localeMap[serverCtx.locale]) {
                return mergeLocaleFallback(fallbackLocale, localeMap[serverCtx.locale]);
            } else {
                console.log(`Unable to find a locale with code ${serverCtx.locale} in cache, using English`);
                return fallbackLocale;
            }
        }
    }, [serverCtx.locale, serverCtx.localeData]);
};
