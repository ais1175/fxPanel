import { useEffect, useRef } from 'react';
import { getSocket, destroySocket } from '@/lib/utils';
import { useExpireAuthData, useSetAuthData } from '@/hooks/auth';
import { useSetGlobalStatus } from '@/hooks/status';
import { useProcessUpdateAvailableEvent, useSetOfflineWarning } from '@/hooks/useWarningBar';
import { useProcessPlayerlistEvents } from '@/hooks/playerlist';
import { useSetBanTemplates } from '@/hooks/banTemplates';
import { useAuthedFetcher } from '@/hooks/fetch';
import { LogoutReasonHash } from '@/pages/auth/Login';

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
    useEffect(() => {
        //SocketIO - singleton, rooms passed via query on first connect
        const socket = getSocket();
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
        const errorHandler = (error: Error) => {
            console.log('Main Socket.IO', error);
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
            setGlobalStatus(status);
        };
        const playerlistHandler = (playerlistData: any) => {
            if (!window.txConsts.isWebInterface) return;
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
            setGlobalStatus(null);
            destroySocket();
        };
    }, []);

    return null;
}
