import { useEffect, useState, useCallback, useRef } from 'react';
import React from 'react';
import { useAuthedFetcher } from '@/hooks/fetch';
import { useCsrfToken, useAdminPerms } from '@/hooks/auth';
import type { AddonPanelDescriptor } from '@shared/addonTypes';
import { DropdownMenuItem, DropdownMenuSeparator } from '@/components/ui/dropdown-menu';
import { getSocket, joinSocketRoom, leaveSocketRoom } from '@/lib/utils';

/**
 * Loaded addon entry module — exports from the addon's panel/index.js
 */
export interface AddonPanelModule {
    /** Maps component names to React components */
    pages?: Record<string, React.ComponentType<any>>;
    widgets?: Record<string, React.ComponentType<any>>;
    settings?: React.ComponentType<any>;
}

/**
 * A fully resolved addon with its manifest + loaded module
 */
export interface LoadedAddon {
    descriptor: AddonPanelDescriptor;
    module: AddonPanelModule;
    error?: string;
}

/**
 * Resolved addon page route for the router
 */
export interface AddonPageRoute {
    addonId: string;
    path: string;
    title: string;
    sidebar?: boolean;
    permission?: string;
    Component: React.ComponentType<any>;
}

/**
 * Resolved addon widget for slot injection
 */
export interface AddonWidgetEntry {
    addonId: string;
    slot: string;
    title: string;
    defaultSize?: string;
    permission?: string;
    Component: React.ComponentType<any>;
}

// Singleton state so we don't re-fetch on every mount
let cachedAddons: LoadedAddon[] | null = null;
let loadPromise: Promise<LoadedAddon[]> | null = null;

/**
 * Hook to get loaded panel addons.
 * Fetches the manifest and dynamically imports addon entry scripts.
 * Returns { addons, pages, widgets, loading, error }.
 */
export function useAddonLoader() {
    const fetcher = useAuthedFetcher();
    const csrfToken = useCsrfToken();
    const [addons, setAddons] = useState<LoadedAddon[]>(cachedAddons ?? []);
    const [loading, setLoading] = useState(!cachedAddons);
    const [error, setError] = useState<string | null>(null);
    const mountedRef = useRef(true);

    useEffect(() => {
        mountedRef.current = true;
        return () => { mountedRef.current = false; };
    }, []);

    useEffect(() => {
        if (cachedAddons) {
            setAddons(cachedAddons);
            setLoading(false);
            return;
        }

        if (loadPromise) {
            loadPromise.then((result) => {
                if (mountedRef.current) {
                    setAddons(result);
                    setLoading(false);
                }
            });
            return;
        }

        loadPromise = (async () => {
            try {
                const resp = await fetcher<{ addons: AddonPanelDescriptor[] }>('/addons/panel-manifest');
                if (!resp.addons || !Array.isArray(resp.addons) || resp.addons.length === 0) {
                    cachedAddons = [];
                    return [];
                }

                const loaded: LoadedAddon[] = [];

                // Expose React and API helpers as globals so addon scripts can use them
                (window as any).React = React;
                (window as any).txAddonApi = {
                    ...(window as any).txAddonApi,
                    csrfToken,
                    getHeaders: () => ({
                        'Content-Type': 'application/json',
                        'X-TxAdmin-CsrfToken': csrfToken ?? '',
                    }),
                    ui: {
                        DropdownMenuItem,
                        DropdownMenuSeparator,
                    },
                    socket: {
                        get: getSocket,
                        joinRoom: joinSocketRoom,
                        leaveRoom: leaveSocketRoom,
                    },
                };

                for (const descriptor of resp.addons) {
                    try {
                        // Dynamically import the addon entry script
                        // The entry URL is served by the core at /addons/:id/panel/index.js
                        const mod = await import(/* @vite-ignore */ descriptor.entryUrl);

                        loaded.push({
                            descriptor,
                            module: {
                                pages: mod.pages ?? {},
                                widgets: mod.widgets ?? {},
                                settings: descriptor.settingsComponent
                                    ? (mod.widgets?.[descriptor.settingsComponent] ?? mod.pages?.[descriptor.settingsComponent] ?? mod[descriptor.settingsComponent])
                                    : undefined,
                            },
                        });
                    } catch (err) {
                        console.error(`[AddonLoader] Failed to load addon ${descriptor.id}:`, err);
                        loaded.push({
                            descriptor,
                            module: { pages: {}, widgets: {} },
                            error: (err as Error).message,
                        });
                    }
                }

                cachedAddons = loaded;
                return loaded;
            } catch (err) {
                console.error('[AddonLoader] Failed to fetch addon manifest:', err);
                if (mountedRef.current) {
                    setError((err as Error).message);
                }
                cachedAddons = [];
                return [];
            }
        })();

        loadPromise.then((result) => {
            if (mountedRef.current) {
                setAddons(result);
                setLoading(false);
            }
        });
    }, [fetcher]);

    // Resolve pages from all loaded addons
    const pages: AddonPageRoute[] = [];
    for (const addon of addons) {
        if (!addon.descriptor.pages) continue;
        for (const page of addon.descriptor.pages) {
            const Component = addon.module.pages?.[page.component];
            if (!Component) continue;
            pages.push({
                addonId: addon.descriptor.id,
                path: `/addon/${addon.descriptor.id}${page.path}`,
                title: page.title,
                sidebar: page.sidebar,
                permission: page.permission,
                Component,
            });
        }
    }

    // Resolve widgets from all loaded addons
    const widgets: AddonWidgetEntry[] = [];
    for (const addon of addons) {
        if (!addon.descriptor.widgets) continue;
        for (const widget of addon.descriptor.widgets) {
            const Component = addon.module.widgets?.[widget.component];
            if (!Component) continue;
            widgets.push({
                addonId: addon.descriptor.id,
                slot: widget.slot,
                title: widget.title,
                defaultSize: widget.defaultSize,
                permission: widget.permission,
                Component,
            });
        }
    }

    return { addons, pages, widgets, loading, error };
}

/**
 * Get widgets for a specific slot (filtered by permission).
 */
export function useAddonWidgets(slot: string): AddonWidgetEntry[] {
    const { widgets } = useAddonLoader();
    const { hasPerm } = useAdminPerms();
    return widgets.filter(w => w.slot === slot && (!w.permission || hasPerm(w.permission)));
}

/**
 * Get widgets matching a slot prefix (filtered by permission).
 */
export function useAddonWidgetsByPrefix(prefix: string): AddonWidgetEntry[] {
    const { widgets } = useAddonLoader();
    const { hasPerm } = useAdminPerms();
    return widgets.filter(w => w.slot.startsWith(prefix) && (!w.permission || hasPerm(w.permission)));
}

/**
 * Get the settings component for a specific addon, if it has one.
 */
export function useAddonSettings(addonId: string): React.ComponentType<any> | undefined {
    const { addons } = useAddonLoader();
    const addon = addons.find(a => a.descriptor.id === addonId);
    return addon?.module.settings;
}

/**
 * Reset the addon cache (e.g. after addon approval/revocation).
 */
export function resetAddonCache() {
    cachedAddons = null;
    loadPromise = null;
}
