import { useEffect, useRef } from 'react';
import { getSocket, destroySocket } from '@/lib/utils';
import { useExpireAuthData, useSetAuthData } from '@/hooks/auth';
import { useSetGlobalStatus } from '@/hooks/status';
import { useProcessUpdateAvailableEvent, useSetOfflineWarning } from '@/hooks/useWarningBar';
import { useProcessPlayerlistEvents } from '@/hooks/playerlist';
import { useSetBanTemplates } from '@/hooks/banTemplates';
import { useAuthedFetcher } from '@/hooks/fetch';
import { LogoutReasonHash } from '@/pages/auth/Login';
import { createMockGlobalStatus, createMockPlayerlistEvents } from '@/pages/Dashboard/devMockData';
import type { GlobalStatusType } from '@shared/socketioTypes';

/**
 * Responsible for starting and handling the main socket.io connection
 * This has been separated from the MainShell.tsx to avoid possible re-renders
 */
export default function MainSocket() {
    const expireSession = useExpireAuthData();
    const setAuthData = useSetAuthData();
    const socketStateChangeCounter = useRef(0);
    const setIsSocketOffline = useSetOfflineWarning();
    const setGlobalStatus = useSetGlobalStatus();
    const processPlayerlistEvents = useProcessPlayerlistEvents();
    const processUpdateAvailableEvent = useProcessUpdateAvailableEvent();
    const setBanTemplates = useSetBanTemplates();
    const authedFetcher = useAuthedFetcher();

    //Runing on mount only
    // Mount-only socket setup: handlers/setters are stable singletons (Jotai
    // setters, refs, module-level helpers) and the socket itself is a singleton.
    // Re-running this effect would tear down and re-register all listeners.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    useEffect(() => {
        //SocketIO - singleton, rooms passed via query on first connect
        const socket = getSocket();
        const isDevMockMode = import.meta.env.DEV;
        let latestLiveStatus: GlobalStatusType | null = null;
        let devMockInterval: ReturnType<typeof setInterval> | undefined;

        if (isDevMockMode) {
            // Visible signal so developers know createMockGlobalStatus and
            // processPlayerlistEvents output is being injected instead of real
            // socket events.
            console.warn(
                '%c[DEV MOCK MODE ACTIVE]%c Using createMockGlobalStatus / createMockPlayerlistEvents instead of live socket data.',
                'background:#b91c1c;color:#fff;font-weight:bold;padding:2px 6px;border-radius:3px;',
                'color:inherit;',
            );
        }

        const pushDevMockState = () => {
            const now = Date.now();
            setGlobalStatus(createMockGlobalStatus(now, latestLiveStatus));
            if (window.txConsts.isWebInterface) {
                processPlayerlistEvents(createMockPlayerlistEvents(now));
            }
        };
        const connectHandler = () => {
            console.log('Main Socket.IO Connected.');
            setIsSocketOffline(false);
            authedFetcher('/settings/banTemplates')
                .then((data) => setBanTemplates(data))
                .catch(() => {});
        };
        const disconnectHandler = (message: string) => {
            console.log('Main Socket.IO Disconnected:', message);
            //Grace period of 500ms to allow for quick reconnects
            //Tracking the state change ID for the timeout not to overwrite a reconnection
            const newId = socketStateChangeCounter.current + 1;
            socketStateChangeCounter.current = newId;
            setTimeout(() => {
                if (socketStateChangeCounter.current === newId) {
                    setIsSocketOffline(true);
                }
            }, 500);
        };
        const errorHandler = (reason?: string) => {
            console.log('Main Socket.IO', reason ?? 'unknown');
        };
        const logoutHandler = (reason?: string) => {
            expireSession('main socketio', reason);
        };
        const refreshHandler = () => {
            expireSession('main socketio', 'got refreshToUpdate', LogoutReasonHash.UPDATED);
        };
        const shutdownHandler = () => {
            expireSession('main socketio', 'got txAdminShuttingDown', LogoutReasonHash.SHUTDOWN);
        };
        const statusHandler = (status: any) => {
            if (isDevMockMode) {
                latestLiveStatus = status;
                return;
            }
            setGlobalStatus(status);
        };
        const playerlistHandler = (playerlistData: any) => {
            if (!window.txConsts.isWebInterface) return;
            if (isDevMockMode) return;
            processPlayerlistEvents(playerlistData);
        };
        const updateHandler = (data: any) => {
            processUpdateAvailableEvent(data);
        };
        const authDataHandler = (authData: any) => {
            console.warn('Got updateAuthData from websocket', authData);
            setAuthData(authData);
        };
        const banTemplatesHandler = (data: any) => {
            setBanTemplates(data);
        };

        socket.on('connect', connectHandler);
        socket.on('disconnect', disconnectHandler);
        socket.on('error', errorHandler);
        socket.on('logout', logoutHandler);
        socket.on('refreshToUpdate', refreshHandler);
        socket.on('txAdminShuttingDown', shutdownHandler);
        socket.on('status', statusHandler);
        socket.on('playerlist', playerlistHandler);
        socket.on('updateAvailable', updateHandler);
        socket.on('updateAuthData', authDataHandler);
        socket.on('banTemplatesUpdate', banTemplatesHandler);

        if (isDevMockMode) {
            pushDevMockState();
            devMockInterval = setInterval(pushDevMockState, 4_000);
        }

        return () => {
            socket.off('connect', connectHandler);
            socket.off('disconnect', disconnectHandler);
            socket.off('error', errorHandler);
            socket.off('logout', logoutHandler);
            socket.off('refreshToUpdate', refreshHandler);
            socket.off('txAdminShuttingDown', shutdownHandler);
            socket.off('status', statusHandler);
            socket.off('playerlist', playerlistHandler);
            socket.off('updateAvailable', updateHandler);
            socket.off('updateAuthData', authDataHandler);
            socket.off('banTemplatesUpdate', banTemplatesHandler);
            if (devMockInterval) clearInterval(devMockInterval);
            setGlobalStatus(null);
            destroySocket();
        };
    }, []);

    return null;
}
