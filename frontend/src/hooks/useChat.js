import { useState, useEffect, useCallback, useRef } from 'react';
import { useSocket } from './useSocket';
import { roomAPI } from '../services/api';

export function useChat(roomId) {
    const { on, off, emit, connected } = useSocket();
    const [messages, setMessages] = useState([]);
    const [loading, setLoading] = useState(false);
    const [hasMore, setHasMore] = useState(true);
    const [typingUsers, setTypingUsers] = useState([]);
    const pageRef = useRef(1);
    const typingTimeoutRef = useRef(null);

    const loadMessages = useCallback(async (page) => {
        setLoading(true);
        try {
            const { data } = await roomAPI.getMessages(roomId, page);
            const msgs = data.messages || [];
            if (page === 1) {
                setMessages(msgs);
            } else {
                setMessages((prev) => [...msgs, ...prev]);
            }
            setHasMore(data.hasMore ?? msgs.length >= 50);
            pageRef.current = page;
        } catch (err) {
            console.error('[Chat] Load messages error:', err);
        } finally {
            setLoading(false);
        }
    }, [roomId]);

    // Load initial messages
    useEffect(() => {
        if (!roomId) return;
        setMessages([]);
        pageRef.current = 1;
        setHasMore(true);
        loadMessages(1);
    }, [roomId, loadMessages]);

    // Socket listeners
    useEffect(() => {
        if (!roomId || !connected) return;

        const handleNewMessage = ({ message: msg }) => {
            if (msg.room === roomId || msg.room?._id === roomId) {
                setMessages((prev) => {
                    // Deduplicate
                    if (prev.some((m) => m._id === msg._id)) return prev;
                    return [...prev, msg];
                });
            }
        };

        const handleDeleted = ({ messageId }) => {
            setMessages((prev) => prev.map((m) => (m._id === messageId ? { ...m, deleted: true } : m)));
        };

        const handleTyping = ({ userId, username }) => {
            setTypingUsers((prev) => {
                if (prev.some((u) => u.userId === userId)) return prev;
                return [...prev, { userId, username }];
            });
        };

        const handleStopTyping = ({ userId }) => {
            setTypingUsers((prev) => prev.filter((u) => u.userId !== userId));
        };

        const handleTranslation = ({ messageId, translation }) => {
            if (!translation) return;
            const { language, content } = translation;
            setMessages((prev) =>
                prev.map((m) => {
                    if (m._id === messageId) {
                        const translations = m.translations || [];
                        const existing = translations.findIndex((t) => t.language === language);
                        if (existing >= 0) {
                            translations[existing] = { language, content };
                        } else {
                            translations.push({ language, content });
                        }
                        return { ...m, translations: [...translations] };
                    }
                    return m;
                })
            );
        };

        const handleReacted = ({ messageId, reactions }) => {
            setMessages((prev) =>
                prev.map((m) => (m._id === messageId ? { ...m, reactions } : m))
            );
        };

        on('message:received', handleNewMessage);
        on('message:deleted', handleDeleted);
        on('room:typing', handleTyping);
        on('room:stop-typing', handleStopTyping);
        on('message:translated', handleTranslation);
        on('message:reacted', handleReacted);

        // Join room
        emit('room:join', { roomId });

        return () => {
            off('message:received', handleNewMessage);
            off('message:deleted', handleDeleted);
            off('room:typing', handleTyping);
            off('room:stop-typing', handleStopTyping);
            off('message:translated', handleTranslation);
            off('message:reacted', handleReacted);
            emit('room:leave', { roomId });
        };
    }, [roomId, connected, on, off, emit]);

    const loadMore = useCallback(() => {
        if (hasMore && !loading) {
            loadMessages(pageRef.current + 1);
        }
    }, [hasMore, loading, loadMessages]);

    const sendMessage = useCallback(
        (content, type = 'text', file = null) => {
            const payload = { roomId, content, type };
            if (file) payload.file = file;
            emit('message:send', payload);
        },
        [roomId, emit]
    );

    const sendLocation = useCallback(
        (lat, lng, address = '') => {
            emit('message:send', {
                roomId,
                content: address || `📍 ${lat.toFixed(6)}, ${lng.toFixed(6)}`,
                type: 'location',
                file: { lat, lng, address },
            });
        },
        [roomId, emit]
    );

    const deleteMessage = useCallback(
        (messageId) => {
            emit('message:delete', { messageId, roomId });
        },
        [roomId, emit]
    );

    const startTyping = useCallback(() => {
        emit('room:typing', { roomId });
        if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
        typingTimeoutRef.current = setTimeout(() => {
            emit('room:stop-typing', { roomId });
        }, 2000);
    }, [roomId, emit]);

    const markRead = useCallback(
        (messageId) => {
            emit('message:read', { messageId, roomId });
        },
        [roomId, emit]
    );

    const reactToMessage = useCallback(
        (messageId, emoji) => {
            emit('message:react', { messageId, roomId, emoji });
        },
        [roomId, emit]
    );

    return {
        messages,
        loading,
        hasMore,
        typingUsers,
        sendMessage,
        sendLocation,
        deleteMessage,
        loadMore,
        startTyping,
        markRead,
        reactToMessage,
    };
}
