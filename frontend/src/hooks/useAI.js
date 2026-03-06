import { useCallback } from 'react';
import { useSocket } from './useSocket';

export function useAI(roomId) {
    const { emit } = useSocket();

    const toggleBot = useCallback(
        (enabled) => {
            emit('ai:toggle', { roomId, enabled });
        },
        [roomId, emit]
    );

    const summarize = useCallback(
        (messageCount = 20) => {
            emit('ai:summarize', { roomId, messageCount });
        },
        [roomId, emit]
    );

    const getStats = useCallback(() => {
        emit('ai:stats');
    }, [emit]);

    return { toggleBot, summarize, getStats };
}
