import { useState, useEffect, useRef, useCallback } from 'react';
import { roomAPI, userActionsAPI, resolveMediaUrl } from '../../services/api';
import { useAuth } from '../../hooks/useAuth';
import { useSocket } from '../../hooks/useSocket';
import { useCall } from '../../hooks/useCall';
import { useChat } from '../../hooks/useChat';
import { useAI } from '../../hooks/useAI';
import MessageBubble from './MessageBubble';
import MessageInput from './MessageInput';
import AIToggle from './AIToggle';
import ForwardModal from './ForwardModal';
import PollCreator from './PollCreator';
import {
    Phone,
    Video,
    ArrowLeft,
    Users,
    Loader2,
    ChevronUp,
    Info,
    Ban,
    Pin,
    BarChart3,
} from 'lucide-react';

export default function ChatWindow({ roomId, onBack, onToggleInfo, aiBotEnabled, onAIToggle, autoTranslate }) {
    const { user } = useAuth();
    const { onlineUsers, on, off, emit } = useSocket();
    const { initiateCall } = useCall();
    const { messages, loading, hasMore, typingUsers, sendMessage, sendLocation, deleteMessage, loadMore, startTyping, reactToMessage } = useChat(roomId);
    const { toggleBot, summarize } = useAI(roomId);

    const [room, setRoom] = useState(null);
    const [iBlockedThem, setIBlockedThem] = useState(false);
    const [theyBlockedMe, setTheyBlockedMe] = useState(false);
    const [localTranslations, setLocalTranslations] = useState({});
    const messagesEndRef = useRef(null);
    const containerRef = useRef(null);
    const [autoScroll, setAutoScroll] = useState(true);
    const translatedIdsRef = useRef(new Set());
    const [forwardMsg, setForwardMsg] = useState(null);
    const [showPollCreator, setShowPollCreator] = useState(false);

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
                onAIToggle?.(myMember?.aiBotEnabled || false);

                // Check block status for direct chats
                if (data.room.type !== 'group') {
                    const other = data.room.members?.find(
                        (m) => (m.user?._id || m.user) !== user?._id
                    );
                    const otherId = other?.user?._id || other?.user;
                    if (otherId) {
                        const { data: blockData } = await userActionsAPI.getBlocked();
                        const blockedIds = (blockData.blockedUsers || []).map((u) => u._id || u);
                        setIBlockedThem(blockedIds.includes(otherId));
                    }
                }
            } catch (err) {
                console.error('Load room error:', err);
            }
        };
        loadRoom();
    }, [roomId, user, onAIToggle]);

    // Listen for real-time group settings updates
    useEffect(() => {
        if (!roomId) return;
        const handleSettingsUpdate = (payload) => {
            if (payload.roomId === roomId) {
                setRoom((prev) =>
                    prev
                        ? {
                            ...prev,
                            name: payload.name ?? prev.name,
                            groupAvatar: payload.groupAvatar ?? prev.groupAvatar,
                            groupBackground: payload.groupBackground ?? prev.groupBackground,
                            description: payload.description ?? prev.description,
                        }
                        : prev
                );
            }
        };
        on('room:settings-updated', handleSettingsUpdate);
        return () => off('room:settings-updated', handleSettingsUpdate);
    }, [roomId, on, off]);

    // Listen for realtime nickname updates
    useEffect(() => {
        if (!roomId) return;
        const handleNicknameUpdated = (payload) => {
            if (payload.roomId === roomId) {
                setRoom((prev) =>
                    prev ? { ...prev, nicknames: payload.nicknames } : prev
                );
            }
        };
        on('room:nickname-updated', handleNicknameUpdated);
        return () => off('room:nickname-updated', handleNicknameUpdated);
    }, [roomId, on, off]);

    // Listen for realtime block/unblock updates
    useEffect(() => {
        if (!room || room.type === 'group') return;
        const other = room.members?.find((m) => (m.user?._id || m.user) !== user?._id);
        const otherId = other?.user?._id || other?.user;
        if (!otherId) return;

        const handleBlockUpdated = (payload) => {
            // The other user blocked/unblocked me
            if (payload.blockedBy === otherId) {
                setTheyBlockedMe(payload.action === 'block');
            }
        };
        on('user:block-updated', handleBlockUpdated);
        return () => off('user:block-updated', handleBlockUpdated);
    }, [room, user, on, off]);

    // Auto-scroll
    useEffect(() => {
        if (autoScroll) {
            messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
        }
    }, [messages, autoScroll]);

    // Clear local translations when switching rooms
    useEffect(() => {
        setLocalTranslations({});
        translatedIdsRef.current = new Set();
    }, [roomId]);

    // Auto-translate incoming messages (LOCAL ONLY — never stored in DB)
    useEffect(() => {
        if (!autoTranslate || !roomId) return;

        const handleLocalTranslation = ({ messageId, translation }) => {
            if (translation) {
                setLocalTranslations((prev) => ({ ...prev, [messageId]: translation }));
            }
        };

        on('ai:translate-result', handleLocalTranslation);
        return () => off('ai:translate-result', handleLocalTranslation);
    }, [autoTranslate, roomId, on, off]);

    // Request translation for new messages when autoTranslate is ON
    useEffect(() => {
        if (!autoTranslate || !messages.length) return;

        const myLang = user?.preferredLanguage || localStorage.getItem('preferredLanguage') || 'vi';

        for (const msg of messages) {
            const senderId = msg.sender?._id || msg.sender;
            if (senderId === user?._id) continue; // Skip own messages
            if (msg.type !== 'text' && msg.type !== undefined) continue; // Only text
            if (!msg.content || msg.content.trim().length < 2) continue;
            if (msg.deleted) continue;
            if (msg.aiMetadata?.isAIResponse) continue;
            if (translatedIdsRef.current.has(msg._id)) continue;
            if (localTranslations[msg._id]) continue;
            // Check if server already has a translation in my language
            const hasServerTranslation = msg.translations?.some((t) => t.language === myLang);
            if (hasServerTranslation) continue;

            translatedIdsRef.current.add(msg._id);
            emit('ai:translate', {
                messageId: msg._id,
                content: msg.content,
                targetLanguage: myLang,
                sourceLanguage: msg.originalLanguage,
            });
        }
    }, [autoTranslate, messages, user, emit, localTranslations]);

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
        // Hiển thị nickname nếu có, fallback về username
        const otherNickname = otherUser?._id && room.nicknames?.[otherUser._id];
        return {
            name: otherNickname || otherUser?.username || 'Unknown',
            subtitle: isOnline ? 'Đang hoạt động' : 'Offline',
            isOnline,
            isGroup: false,
            otherUserId: otherUser?._id,
            avatar: resolveMediaUrl(otherUser?.avatar || otherUser?.googlePicture),
        };
    };

    const display = getRoomDisplay();

    const handleToggleAI = (enabled) => {
        onAIToggle?.(enabled);
        toggleBot(enabled);
    };

    const handleCall = (type) => {
        if (display.isGroup) {
            const memberIds = (room?.members || [])
                .map(m => m.user?._id || m.user)
                .filter(id => id && id !== user?._id);
            initiateCall(roomId, null, type, '', {
                isGroup: true,
                targetUserIds: memberIds,
                roomName: display.name,
            });
        } else if (display.otherUserId) {
            initiateCall(roomId, display.otherUserId, type, display.name);
        }
    };

    const handleForwardMessage = async (messageId, targetRoomId) => {
        try {
            const { roomAPI } = await import('../../services/api');
            await roomAPI.forwardMessage(messageId, targetRoomId);
        } catch (err) {
            console.error('Forward error:', err);
        }
    };

    const handlePinMessage = async (message) => {
        try {
            const { roomAPI: rAPI } = await import('../../services/api');
            if (message.pinned) {
                await rAPI.unpinMessage(roomId, message._id);
            } else {
                await rAPI.pinMessage(roomId, message._id);
            }
        } catch (err) {
            console.error('Pin error:', err);
        }
    };

    const handleSendPoll = ({ question, options }) => {
        emit('message:send-poll', { roomId, question, options });
    };

    const handleVotePoll = (messageId, optionIndex) => {
        emit('poll:vote', { messageId, roomId, optionIndex });
    };

    // Listen for poll updates
    useEffect(() => {
        if (!roomId) return;
        const handlePollUpdated = ({ messageId, poll }) => {
            // useChat will handle updating messages via message:received
            // but poll:updated is a separate event, so we need to refresh
            // The messages state is managed by useChat, we can emit a custom event
        };
        on('poll:updated', handlePollUpdated);
        return () => off('poll:updated', handlePollUpdated);
    }, [roomId, on, off]);

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
                        className={`w-10 h-10 rounded-full flex items-center justify-center text-white font-semibold overflow-hidden ${display.isGroup ? 'bg-purple-500' : 'bg-[var(--color-primary)]'
                            }`}
                    >
                        {display.isGroup ? (
                            room?.groupAvatar ? (
                                <img src={resolveMediaUrl(room.groupAvatar)} alt={display.name} className="w-full h-full object-cover" />
                            ) : (
                                <Users size={18} />
                            )
                        ) : display.avatar ? (
                            <img src={display.avatar} alt={display.name} className="w-full h-full object-cover" />
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

                    {/* Call buttons - available for both 1-1 and group */}
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

                    <button
                        onClick={() => setShowPollCreator(true)}
                        className="p-2 hover:bg-gray-100 rounded-full transition text-gray-600"
                        title="Tạo bình chọn"
                    >
                        <BarChart3 size={18} />
                    </button>

                    <button
                        onClick={() => onToggleInfo?.(room)}
                        className="p-2 hover:bg-gray-100 rounded-full transition text-gray-600"
                        title="Thông tin"
                    >
                        <Info size={18} />
                    </button>
                </div>
            </div>

            {/* Messages */}
            <div
                ref={containerRef}
                onScroll={handleScroll}
                className="flex-1 overflow-y-auto px-4 py-3 scrollbar-thin bg-gray-50"
            >
                {/* Empty conversation — Profile Header */}
                {!loading && messages.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-full animate-[fadeIn_0.5s_ease]">
                        {/* Avatar */}
                        <div
                            className="w-24 h-24 rounded-full flex items-center justify-center text-white text-3xl font-bold overflow-hidden border-4 border-[var(--color-primary-medium)] shadow-lg mb-4"
                            style={{ backgroundColor: display.isGroup ? '#8b5cf6' : 'var(--color-primary)' }}
                        >
                            {display.isGroup ? (
                                room?.groupAvatar ? (
                                    <img src={resolveMediaUrl(room.groupAvatar)} alt={display.name} className="w-full h-full object-cover" />
                                ) : (
                                    <Users size={40} />
                                )
                            ) : display.avatar ? (
                                <img src={display.avatar} alt={display.name} className="w-full h-full object-cover" />
                            ) : (
                                display.name?.charAt(0).toUpperCase()
                            )}
                        </div>

                        {/* Name */}
                        <h2 className="text-xl font-bold text-gray-900 mb-1">{display.name}</h2>

                        {/* Subtitle */}
                        <p className="text-sm text-gray-500 text-center max-w-xs leading-relaxed">
                            {display.isGroup
                                ? `Chào mừng mọi người đến với nhóm ${display.name}! 🎉\n${room?.members?.length || 0} thành viên`
                                : 'Các bạn giờ đã là bạn bè trên SmartAI 🎉\nHãy bắt đầu trò chuyện ngay!'}
                        </p>

                        {/* Wave emoji hint */}
                        <div className="mt-6 text-4xl animate-bounce">👋</div>
                    </div>
                ) : (
                    <>
                        {/* Load more */}
                        {hasMore && (
                            <div className="text-center mb-4">
                                <button
                                    onClick={loadMore}
                                    disabled={loading}
                                    className="inline-flex items-center gap-1 text-sm text-[var(--color-primary)] hover:text-[var(--color-primary-hover)] disabled:opacity-50"
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
                                nicknames={room?.nicknames}
                                isOwn={
                                    (msg.sender?._id || msg.sender) === user?._id &&
                                    msg.type !== 'system' &&
                                    !msg.aiMetadata?.isAIResponse
                                }
                                localTranslation={localTranslations[msg._id]}
                                onDelete={deleteMessage}
                                onReact={reactToMessage}
                                onForward={(msg) => setForwardMsg(msg)}
                                onPinMessage={handlePinMessage}
                                onVotePoll={handleVotePoll}
                            />
                        ))}
                    </>
                )}

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

            {/* Input or Block notice */}
            {iBlockedThem ? (
                <div className="px-4 py-4 border-t border-gray-200 bg-gray-50 text-center">
                    <div className="flex items-center justify-center gap-2 text-gray-500 mb-2">
                        <Ban size={16} />
                        <span className="text-sm">Bạn đã chặn người dùng này</span>
                    </div>
                    <button
                        onClick={async () => {
                            const other = room?.members?.find((m) => (m.user?._id || m.user) !== user?._id);
                            const otherId = other?.user?._id || other?.user;
                            if (otherId) {
                                await userActionsAPI.unblock(otherId);
                                setIBlockedThem(false);
                            }
                        }}
                        className="text-sm text-[var(--color-primary)] hover:underline font-medium"
                    >
                        Bỏ chặn
                    </button>
                </div>
            ) : theyBlockedMe ? (
                <div className="px-4 py-4 border-t border-gray-200 bg-gray-50 text-center">
                    <p className="text-sm text-gray-500">Bạn không thể gửi tin nhắn cho người này</p>
                </div>
            ) : (
                <MessageInput
                    onSend={sendMessage}
                    onSendLocation={sendLocation}
                    onTyping={startTyping}
                    disabled={!room}
                />
            )}

            {/* Forward Modal */}
            {forwardMsg && (
                <ForwardModal
                    message={forwardMsg}
                    onClose={() => setForwardMsg(null)}
                    onForward={handleForwardMessage}
                />
            )}

            {/* Poll Creator */}
            {showPollCreator && (
                <PollCreator
                    onSend={handleSendPoll}
                    onClose={() => setShowPollCreator(false)}
                />
            )}
        </div>
    );
}
