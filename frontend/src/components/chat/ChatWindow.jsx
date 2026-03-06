import { useState, useEffect, useRef, useCallback } from 'react';
import { roomAPI } from '../../services/api';
import { useAuth } from '../../hooks/useAuth';
import { useSocket } from '../../hooks/useSocket';
import { useCall } from '../../hooks/useCall';
import { useChat } from '../../hooks/useChat';
import { useAI } from '../../hooks/useAI';
import MessageBubble from './MessageBubble';
import MessageInput from './MessageInput';
import AIToggle from './AIToggle';
import {
    Phone,
    Video,
    ArrowLeft,
    Users,
    Loader2,
    ChevronUp,
} from 'lucide-react';

export default function ChatWindow({ roomId, onBack }) {
    const { user } = useAuth();
    const { onlineUsers } = useSocket();
    const { initiateCall } = useCall();
    const { messages, loading, hasMore, typingUsers, sendMessage, deleteMessage, loadMore, startTyping } = useChat(roomId);
    const { toggleBot, summarize } = useAI(roomId);

    const [room, setRoom] = useState(null);
    const [aiBotEnabled, setAiBotEnabled] = useState(false);
    const messagesEndRef = useRef(null);
    const containerRef = useRef(null);
    const [autoScroll, setAutoScroll] = useState(true);

    // Load room info
    useEffect(() => {
        if (!roomId) return;
        const loadRoom = async () => {
            try {
                const { data } = await roomAPI.getById(roomId);
                setRoom(data.room);
                // Check if AI bot is enabled for current user
                const myMember = data.room.members?.find(
                    (m) => (m.user?._id || m.user) === user?._id
                );
                setAiBotEnabled(myMember?.aiBotEnabled || false);
            } catch (err) {
                console.error('Load room error:', err);
            }
        };
        loadRoom();
    }, [roomId, user]);

    // Auto-scroll
    useEffect(() => {
        if (autoScroll) {
            messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
        }
    }, [messages, autoScroll]);

    // Detect scroll position
    const handleScroll = useCallback(() => {
        const el = containerRef.current;
        if (!el) return;
        const atBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 100;
        setAutoScroll(atBottom);

        // Load more when scrolled to top
        if (el.scrollTop < 50 && hasMore && !loading) {
            loadMore();
        }
    }, [hasMore, loading, loadMore]);

    // Room display info
    const getRoomDisplay = () => {
        if (!room) return { name: '', isOnline: false };
        if (room.type === 'group') {
            return {
                name: room.name,
                subtitle: `${room.members?.length || 0} thành viên`,
                isOnline: false,
                isGroup: true,
            };
        }
        const other = room.members?.find((m) => (m.user?._id || m.user) !== user?._id);
        const otherUser = other?.user;
        const isOnline = otherUser?._id && onlineUsers.includes(otherUser._id);
        return {
            name: otherUser?.username || 'Unknown',
            subtitle: isOnline ? 'Đang hoạt động' : 'Offline',
            isOnline,
            isGroup: false,
            otherUserId: otherUser?._id,
        };
    };

    const display = getRoomDisplay();

    const handleToggleAI = (enabled) => {
        setAiBotEnabled(enabled);
        toggleBot(enabled);
    };

    const handleCall = (type) => {
        if (display.otherUserId) {
            initiateCall(roomId, display.otherUserId, type, display.name);
        }
    };

    if (!roomId) {
        return (
            <div className="flex-1 flex items-center justify-center bg-gray-50">
                <div className="text-center text-gray-400">
                    <div className="text-6xl mb-4">💬</div>
                    <p className="text-lg font-medium">Chọn cuộc trò chuyện để bắt đầu</p>
                    <p className="text-sm mt-1">Hoặc tạo cuộc trò chuyện mới</p>
                </div>
            </div>
        );
    }

    return (
        <div className="flex-1 flex flex-col h-full bg-white">
            {/* Header */}
            <div className="flex items-center gap-3 px-4 py-3 border-b border-gray-200 bg-white">
                {/* Back button (mobile) */}
                <button
                    onClick={onBack}
                    className="lg:hidden p-1 hover:bg-gray-100 rounded-full"
                >
                    <ArrowLeft size={20} />
                </button>

                {/* Avatar */}
                <div className="relative">
                    <div
                        className={`w-10 h-10 rounded-full flex items-center justify-center text-white font-semibold ${display.isGroup ? 'bg-purple-500' : 'bg-blue-500'
                            }`}
                    >
                        {display.isGroup ? (
                            <Users size={18} />
                        ) : (
                            display.name.charAt(0).toUpperCase()
                        )}
                    </div>
                    {display.isOnline && (
                        <div className="absolute bottom-0 right-0 w-3 h-3 bg-green-500 border-2 border-white rounded-full" />
                    )}
                </div>

                {/* Info */}
                <div className="flex-1 min-w-0">
                    <h3 className="font-semibold text-gray-900 truncate">{display.name}</h3>
                    <p className={`text-xs ${display.isOnline ? 'text-green-500' : 'text-gray-400'}`}>
                        {typingUsers.length > 0
                            ? `${typingUsers.map((u) => u.username).join(', ')} đang nhập...`
                            : display.subtitle}
                    </p>
                </div>

                {/* Actions */}
                <div className="flex items-center gap-1">
                    <AIToggle
                        enabled={aiBotEnabled}
                        onToggle={handleToggleAI}
                        onSummarize={() => summarize(20)}
                    />

                    {!display.isGroup && (
                        <>
                            <button
                                onClick={() => handleCall('audio')}
                                className="p-2 hover:bg-gray-100 rounded-full transition text-gray-600"
                                title="Gọi thoại"
                            >
                                <Phone size={18} />
                            </button>
                            <button
                                onClick={() => handleCall('video')}
                                className="p-2 hover:bg-gray-100 rounded-full transition text-gray-600"
                                title="Gọi video"
                            >
                                <Video size={18} />
                            </button>
                        </>
                    )}
                </div>
            </div>

            {/* Messages */}
            <div
                ref={containerRef}
                onScroll={handleScroll}
                className="flex-1 overflow-y-auto px-4 py-3 scrollbar-thin bg-gray-50"
            >
                {/* Load more */}
                {hasMore && (
                    <div className="text-center mb-4">
                        <button
                            onClick={loadMore}
                            disabled={loading}
                            className="inline-flex items-center gap-1 text-sm text-blue-500 hover:text-blue-700 disabled:opacity-50"
                        >
                            {loading ? (
                                <Loader2 size={14} className="animate-spin" />
                            ) : (
                                <ChevronUp size={14} />
                            )}
                            Tải tin nhắn cũ hơn
                        </button>
                    </div>
                )}

                {/* Messages list */}
                {messages.map((msg) => (
                    <MessageBubble
                        key={msg._id}
                        message={msg}
                        isOwn={
                            (msg.sender?._id || msg.sender) === user?._id &&
                            msg.type !== 'system' &&
                            !msg.aiMetadata?.isAIResponse
                        }
                        onDelete={deleteMessage}
                    />
                ))}

                {/* Typing indicator */}
                {typingUsers.length > 0 && (
                    <div className="flex justify-start mb-2">
                        <div className="bg-gray-100 px-4 py-3 rounded-2xl">
                            <div className="flex gap-1">
                                <div className="w-2 h-2 bg-gray-400 rounded-full typing-dot" />
                                <div className="w-2 h-2 bg-gray-400 rounded-full typing-dot" />
                                <div className="w-2 h-2 bg-gray-400 rounded-full typing-dot" />
                            </div>
                        </div>
                    </div>
                )}

                <div ref={messagesEndRef} />
            </div>

            {/* Input */}
            <MessageInput
                onSend={sendMessage}
                onTyping={startTyping}
                disabled={!room}
            />
        </div>
    );
}
