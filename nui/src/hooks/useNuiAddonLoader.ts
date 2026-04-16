import { useEffect } from 'react';
import { fetchWebPipe } from '../utils/fetchWebPipe';
import { useIsMenuVisibleValue } from '../state/visibility.state';

interface AddonNuiDescriptor {
    id: string;
    name: string;
    version: string;
    entryUrl: string;
    stylesUrl: string | null;
    pages: unknown[];
}

// Singleton guard — load once per NUI lifecycle
let loaded = false;
let loadPromise: Promise<void> | null = null;

/**
 * Convert a relative addon path to a nui:// resource URL.
 * NUI hot-reload is handled by `ensure monitor` which destroys and recreates
 * the NUI browser, so fresh nui:// paths always resolve to the latest files.
 */
function toResourceUrl(relativePath: string): string {
    return `nui://monitor/${relativePath}`;
}

async function loadNuiAddons(): Promise<void> {
    try {
        const resp = await fetchWebPipe<{ addons: AddonNuiDescriptor[] }>('/addons/nui-manifest');
        if (!resp?.addons?.length) return;

        // Expose a minimal API for NUI addon scripts
        (window as any).txNuiAddonApi = {
            /** Get a URL to an addon's static asset (e.g. images, SVGs) */
            getStaticUrl: (addonId: string, filePath: string) =>
                toResourceUrl(`addons/${addonId}/static/${filePath}`),
            /** Make an authenticated request to an addon API route via WebPipe */
            fetch: async (path: string, opts?: { method?: string; data?: unknown }) => {
                return fetchWebPipe(path as any, {
                    method: opts?.method as any,
                    data: opts?.data,
                });
            },
        };

        for (const addon of resp.addons) {
            try {
                if (addon.stylesUrl) {
                    const link = document.createElement('link');
                    link.rel = 'stylesheet';
                    link.href = toResourceUrl(addon.stylesUrl.replace(/^\//, ''));
                    link.dataset.addonId = addon.id;
                    document.head.appendChild(link);
                }

                if (addon.entryUrl) {
                    const script = document.createElement('script');
                    script.src = toResourceUrl(addon.entryUrl.replace(/^\//, ''));
                    script.dataset.addonId = addon.id;
                    document.head.appendChild(script);
                }
            } catch (err) {
                console.error(`[NuiAddonLoader] Failed to load addon ${addon.id}:`, err);
            }
        }
    } catch (err) {
        console.error('[NuiAddonLoader] Failed to fetch NUI addon manifest:', err);
    }
}

/**
 * Hook that loads NUI addons when the menu first becomes visible.
 * The WebPipe rejects requests while the menu is hidden, so we
 * wait for the first visibility event before fetching the manifest.
 *
 * NUI hot-reload is handled server-side via `ensure monitor`, which
 * destroys and recreates the entire NUI browser — no client-side
 * reload logic needed.
 */
export function useNuiAddonLoader() {
    const isMenuVisible = useIsMenuVisibleValue();

    useEffect(() => {
        if (!isMenuVisible || loaded) return;
        if (!loadPromise) {
            loadPromise = loadNuiAddons().then(() => {
                loaded = true;
            });
        }
    }, [isMenuVisible]);
}
