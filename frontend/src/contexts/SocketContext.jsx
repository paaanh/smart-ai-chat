import { useEffect, useState, useCallback, useRef } from 'react';
import { connectSocket, disconnectSocket, getSocket } from '../config/socket';
import { useAuth } from '../hooks/useAuth';
import { SocketContext } from '.';

export function SocketProvider({ children }) {
    const { token, user } = useAuth();
    const [connected, setConnected] = useState(false);
    const [onlineUsers, setOnlineUsers] = useState([]);
    const [socketReady, setSocketReady] = useState(false);

    // Map<event, Set<handler>> — reliable listener tracking
    const listenersRef = useRef(new Map());

    const hasAuth = !!(token && user);

    useEffect(() => {
        if (!hasAuth) {
            disconnectSocket();
            return;
        }

        const socket = connectSocket(token);

        socket.on('connect', () => {
            setConnected(true);
            setSocketReady(true);
            // Re-attach all tracked listeners on reconnect
            listenersRef.current.forEach((handlers, event) => {
                handlers.forEach((handler) => {
                    socket.off(event, handler);
                    socket.on(event, handler);
                });
            });
        });

        socket.on('disconnect', () => setConnected(false));

        socket.on('user:online', ({ userId }) => {
            setOnlineUsers((prev) => [...new Set([...prev, userId])]);
        });

        socket.on('user:offline', ({ userId }) => {
            setOnlineUsers((prev) => prev.filter((id) => id !== userId));
        });

        return () => {
            disconnectSocket();
            setConnected(false);
            setSocketReady(false);
        };
    }, [hasAuth, token]);

    // Sync socketReady state when auth is lost
    if (!hasAuth && socketReady) {
        setSocketReady(false);
    }

    const on = useCallback((event, handler) => {
        // Track by event → Set<handler> for reliable add/remove
        if (!listenersRef.current.has(event)) {
            listenersRef.current.set(event, new Set());
        }
        listenersRef.current.get(event).add(handler);

        const socket = getSocket();
        if (socket) {
            socket.on(event, handler);
        }
    }, []);

    const off = useCallback((event, handler) => {
        const handlers = listenersRef.current.get(event);
        if (handlers) {
            handlers.delete(handler);
            if (handlers.size === 0) {
                listenersRef.current.delete(event);
            }
        }
        const socket = getSocket();
        if (socket) {
            socket.off(event, handler);
        }
    }, []);

    const emit = useCallback((event, data) => {
        const socket = getSocket();
        if (socket?.connected) {
            socket.emit(event, data);
        }
    }, []);

    return (
        <SocketContext.Provider value={{ connected, onlineUsers, emit, on, off, getSocket, socketReady }}>
            {children}
        </SocketContext.Provider>
    );
}
