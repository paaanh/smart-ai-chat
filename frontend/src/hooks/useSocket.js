import { useContext } from 'react';
import { SocketContext } from '../contexts';

export const useSocket = () => {
    const ctx = useContext(SocketContext);
    if (!ctx) throw new Error('useSocket must be inside SocketProvider');
    return ctx;
};
