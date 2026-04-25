import { Button } from '@/components/ui/button';
import { getSocket, joinSocketRoom, leaveSocketRoom } from '@/lib/utils';
import { useEffect, useRef, useState } from 'react';
import { Socket } from 'socket.io-client';

const BUFFER_TRIM_SIZE = 128 * 1024; // 128kb

export default function TmpSocket() {
    const socketRef = useRef<Socket | null>(null);
    const [consoleData, setConsoleData] = useState('[empty]');
    const [isOffline, setIsOffline] = useState(true);

    const ingestConsoleData = (incomingData: string) => {
        setConsoleData((currData) => {
            console.log(currData.length, incomingData.length);
            let _consoleData = currData + incomingData;
            _consoleData =
                _consoleData.length > BUFFER_TRIM_SIZE
                    ? _consoleData.slice(-0.5 * BUFFER_TRIM_SIZE) // grab the last half
                    : _consoleData; // no need to trim
            _consoleData = _consoleData.substring(_consoleData.indexOf('\n'));
            return _consoleData;
        });
    };

    const sendPing = () => {
        socketRef.current?.emit('consoleCommand', 'txaPing');
    };
    const clearTerminal = () => {
        setConsoleData('[cleared]');
    };

    useEffect(() => {
        const socket = getSocket();
        socketRef.current = socket;
        setIsOffline(!socket.connected);

        const connectHandler = () => {
            console.log('Console Socket.IO Connected.');
            setIsOffline(false);
        };
        const disconnectHandler = (message: string) => {
            console.log('Console Socket.IO Disconnected:', message);
            setIsOffline(true);
        };
        const errorHandler = (reason?: string) => {
            console.log('Console Socket.IO', reason ?? 'unknown');
        };
        const dataHandler = (data: any) => {
            ingestConsoleData(data);
        };

        socket.on('connect', connectHandler);
        socket.on('disconnect', disconnectHandler);
        socket.on('error', errorHandler);
        socket.on('consoleData', dataHandler);
        joinSocketRoom('liveconsole');

        return () => {
            socket.off('connect', connectHandler);
            socket.off('disconnect', disconnectHandler);
            socket.off('error', errorHandler);
            socket.off('consoleData', dataHandler);
            leaveSocketRoom('liveconsole');
        };
    }, []);

    return (
        <>
            <div className="space-x-4">
                <Button onClick={sendPing}>Send Ping</Button>
                <Button onClick={clearTerminal}>Clear</Button>
                <span>Status: {isOffline ? 'Offline' : 'Online'}</span>
            </div>
            <pre className="bg-muted p-2">{consoleData}</pre>
        </>
    );
}
