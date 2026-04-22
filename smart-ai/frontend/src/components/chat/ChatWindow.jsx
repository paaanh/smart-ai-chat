import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { roomAPI, userActionsAPI, friendAPI, resolveMediaUrl } from '../../services/api';
import { useAuth } from '../../hooks/useAuth';
import { useSocket } from '../../hooks/useSocket';
import { useCall } from '../../hooks/useCall';
import { useChat } from '../../hooks/useChat';
import { useAI } from '../../hooks/useAI';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'; // eslint-disable-line no-unused-vars
import MessageBubble from './MessageBubble';
import MessageInput from './MessageInput';
import AIToggle from './AIToggle';
import ForwardModal from './ForwardModal';
import PollCreator from './PollCreator';
import PinnedHeader from './PinnedHeader';
import SkeletonBlock from '../ui/SkeletonBlock';
import { isStickerPayload } from '../../utils/stickers';
import { format } from 'date-fns';
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
    Lock,
    Building2,
    CheckSquare,
    Copy,
    X,
    Reply,
    Compass,
    HeartHandshake,
    House,
    Search,
    UserPlus,
} from 'lucide-react';

export default function ChatWindow({ roomId, onBack, onToggleInfo, aiBotEnabled, onAIToggle, autoTranslate, onOpenStartAction }) {
    const navigate = useNavigate();
    const reduceMotion = useReducedMotion();
    const { user, updateLockStatus } = useAuth();
    const { onlineUsers, on, off, emit } = useSocket();
    const { initiateCall } = useCall();
    const { messages, loading, hasMore, typingUsers, sendMessage, sendLocation, deleteMessage, loadMore, startTyping, markRead, reactToMessage } = useChat(roomId);
    const { toggleBot, summarize } = useAI(roomId);

    const [room, setRoom] = useState(null);
    const [iBlockedThem, setIBlockedThem] = useState(false);
    const [theyBlockedMe, setTheyBlockedMe] = useState(false);
    const [lockOverlay, setLockOverlay] = useState(false);
    const [friendshipStatus, setFriendshipStatus] = useState('none');
    const [localMessages, setLocalMessages] = useState([]);
    const [localTranslations, setLocalTranslations] = useState({});
    const messagesEndRef = useRef(null);
    const containerRef = useRef(null);
    const [autoScroll, setAutoScroll] = useState(true);
    const translatedIdsRef = useRef(new Set());
    const sentReadIdsRef = useRef(new Set());
    const processedServerOwnMessagesRef = useRef(new Set());
    const pendingQueueRef = useRef([]);
    const [forwardMsg, setForwardMsg] = useState(null);
    const [showPollCreator, setShowPollCreator] = useState(false);
    const [pinnedMessages, setPinnedMessages] = useState([]);
    const [pendingMessages, setPendingMessages] = useState([]);
    const [replyDraft, setReplyDraft] = useState(null);
    const [selectionMode, setSelectionMode] = useState(false);
    const [selectedMessageIds, setSelectedMessageIds] = useState(new Set());
    const [copiedSelection, setCopiedSelection] = useState(false);
    const [startSuggestions, setStartSuggestions] = useState([]);
    const [startSuggestionLoading, setStartSuggestionLoading] = useState(false);
    const [startSuggestionActionId, setStartSuggestionActionId] = useState(null);

    const loadStartSuggestions = useCallback(async () => {
        setStartSuggestionLoading(true);
        try {
            const { data } = await friendAPI.getSuggestions();
            const merged = [
                ...(data.topSimilarity || []),
                ...(data.topicAffinity || []),
            ];

            const unique = [];
            const seen = new Set();
            for (const item of merged) {
                if (!item?._id || seen.has(item._id)) continue;
                seen.add(item._id);
                unique.push(item);
                if (unique.length >= 6) break;
            }

            setStartSuggestions(unique);
        } catch (error) {
            console.error('Load start suggestions failed:', error);
            setStartSuggestions([]);
        } finally {
            setStartSuggestionLoading(false);
        }
    }, []);

    const handleStartSuggestionRequest = useCallback(async (recipientId) => {
        setStartSuggestionActionId(recipientId);
        try {
            await friendAPI.sendRequest(recipientId);
            setStartSuggestions((prev) => prev.filter((item) => item._id !== recipientId));
        } catch (error) {
            console.error('Send request from start suggestions failed:', error);
        } finally {
            setStartSuggestionActionId(null);
        }
    }, []);

    useEffect(() => {
        if (!roomId) {
            loadStartSuggestions();
        }
    }, [roomId, loadStartSuggestions]);

    // Load room info
    useEffect(() => {
        if (!roomId) return;
        const loadRoom = async () => {
            try {
                setFriendshipStatus('none');
                const { data } = await roomAPI.getById(roomId);
                setRoom(data.room);
                // Set pinned messages from populated room data
                setPinnedMessages(
                    (data.room.pinnedMessages || []).filter(m => m && m._id)
                );
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

                        const { data: statusData } = await friendAPI.getStatus(otherId);
                        setFriendshipStatus(statusData?.status || 'none');
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

    // Listen for account:locked — show overlay immediately
    useEffect(() => {
        const handleLocked = () => setLockOverlay(true);
        on('account:locked', handleLocked);
        return () => off('account:locked', handleLocked);
    }, [on, off]);

    // Dismiss overlay when lock expires (status updated to active)
    useEffect(() => {
        if (user?.accountStatus === 'active') {
            setLockOverlay(false);
        }
    }, [user?.accountStatus]);

    // Clear local messages when switching rooms
    useEffect(() => {
        setLocalMessages([]);
        sentReadIdsRef.current = new Set();
        processedServerOwnMessagesRef.current = new Set();
        pendingQueueRef.current = [];
        setPendingMessages([]);
        setReplyDraft(null);
        setSelectionMode(false);
        setSelectedMessageIds(new Set());
    }, [roomId]);

    // Wrapper: inject local system message when user is locked
    const handleSendMessage = useCallback((content, type, fileData) => {
        const nowLocked =
            user?.accountStatus === 'locked' &&
            user?.lockUntil &&
            new Date(user.lockUntil) > new Date();
        if (nowLocked) {
            setLocalMessages((prev) => [
                ...prev,
                {
                    _id: `local_blocked_${Date.now()}`,
                    type: 'system',
                    content: '🚫 Tin nhắn không được gửi. Bạn đang trong thời gian bị khóa.',
                    createdAt: new Date().toISOString(),
                    local: true,
                },
            ]);
            return;
        }

        const tempId = `pending_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
        const createdAt = new Date().toISOString();
        const pendingMessage = {
            _id: tempId,
            room: roomId,
            sender: {
                _id: user?._id,
                username: user?.username,
                avatar: user?.avatar,
                googlePicture: user?.googlePicture,
                preferredBubbleFrame: user?.preferredBubbleFrame || localStorage.getItem('chatBubbleFrame') || undefined,
            },
            type,
            content: content || '',
            file: fileData || null,
            createdAt,
            pending: true,
        };

        setPendingMessages((prev) => [...prev, pendingMessage]);
        pendingQueueRef.current.push({
            tempId,
            type,
            content: (content || '').trim(),
            fileName: fileData?.name || '',
            createdAt,
        });

        sendMessage(content, type, fileData);
        setReplyDraft(null);
    }, [user, sendMessage, roomId]);

    // Auto-scroll
    useEffect(() => {
        if (autoScroll) {
            messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
        }
    }, [messages, autoScroll]);

    // Reconcile local pending messages when server confirms own messages.
    useEffect(() => {
        if (!user?._id || !messages.length || pendingQueueRef.current.length === 0) return;

        setPendingMessages((prev) => {
            let next = [...prev];
            let changed = false;

            messages.forEach((msg) => {
                const msgId = msg?._id;
                if (!msgId || processedServerOwnMessagesRef.current.has(msgId)) return;

                const senderId = msg.sender?._id || msg.sender;
                if (String(senderId || '') !== String(user._id)) {
                    processedServerOwnMessagesRef.current.add(msgId);
                    return;
                }

                const normalizedContent = (msg.content || '').trim();
                const pendingIndex = pendingQueueRef.current.findIndex((pendingItem) => {
                    const sameType = pendingItem.type === msg.type;
                    const sameContent = pendingItem.content === normalizedContent;
                    const sameFile = pendingItem.fileName && pendingItem.fileName === (msg.file?.name || '');
                    const closeInTime = Math.abs(new Date(msg.createdAt) - new Date(pendingItem.createdAt)) < 2 * 60 * 1000;
                    return sameType && closeInTime && (sameContent || sameFile);
                });

                if (pendingIndex >= 0) {
                    const [matchedPending] = pendingQueueRef.current.splice(pendingIndex, 1);
                    const uiIndex = next.findIndex((pendingMsg) => pendingMsg._id === matchedPending.tempId);
                    if (uiIndex >= 0) {
                        next.splice(uiIndex, 1);
                        changed = true;
                    }
                }

                processedServerOwnMessagesRef.current.add(msgId);
            });

            return changed ? next : prev;
        });
    }, [messages, user?._id]);

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
            if (isStickerPayload(msg.content)) continue;
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

    // Mark incoming messages as read when this room is open.
    useEffect(() => {
        if (!roomId || !user?._id || !messages.length) return;

        messages.forEach((msg) => {
            const senderId = msg.sender?._id || msg.sender;
            if (!senderId || String(senderId) === String(user._id)) return;

            const alreadyRead = (msg.readBy || []).some((entry) => {
                const reader = entry?.user?._id || entry?.user;
                return String(reader || '') === String(user._id);
            });

            if (!alreadyRead && !sentReadIdsRef.current.has(msg._id)) {
                sentReadIdsRef.current.add(msg._id);
                markRead(msg._id);
            }
        });
    }, [roomId, user?._id, messages, markRead]);

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
        if (room.type === 'group' || room.type === 'topic' || room.type === 'counseling') {
            return {
                name: room.name,
                subtitle: room.type === 'counseling' ? 'Phiên tư vấn' : `${room.members?.length || 0} thành viên`,
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
        if (!display.isGroup && friendshipStatus !== 'accepted') {
            setLocalMessages((prev) => [
                ...prev,
                {
                    _id: `local_call_block_${Date.now()}`,
                    type: 'system',
                    content: '📵 Chỉ có thể gọi khi hai bên đã là bạn bè.',
                    createdAt: new Date().toISOString(),
                    local: true,
                },
            ]);
            return;
        }

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

    const handleQuickReply = useCallback((msg) => {
        if (!msg || msg.type === 'system') return;
        const senderId = msg.sender?._id || msg.sender;
        const nickname = senderId && room?.nicknames?.[senderId];
        const senderName = nickname || msg.sender?.username || 'Người dùng';
        const contentPreview = isStickerPayload(msg.content)
            ? '[Sticker]'
            : (msg.content?.trim() || msg.file?.name || `[${msg.type || 'text'}]`);

        setReplyDraft({
            messageId: msg._id,
            senderName,
            preview: contentPreview,
        });
    }, [room?.nicknames]);

    const allRenderableMessages = useMemo(
        () => [...messages, ...localMessages, ...pendingMessages]
            .sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt)),
        [messages, localMessages, pendingMessages]
    );

    const isClusterMate = useCallback((left, right) => {
        if (!left || !right) return false;
        if (left.type === 'system' || right.type === 'system') return false;

        const leftSender = left.sender?._id || left.sender;
        const rightSender = right.sender?._id || right.sender;
        if (String(leftSender || '') !== String(rightSender || '')) return false;

        const leftTime = new Date(left.createdAt).getTime();
        const rightTime = new Date(right.createdAt).getTime();
        if (Number.isNaN(leftTime) || Number.isNaN(rightTime)) return false;

        return Math.abs(rightTime - leftTime) <= 5 * 60 * 1000;
    }, []);

    const toggleMessageSelection = useCallback((messageId) => {
        setSelectedMessageIds((prev) => {
            const next = new Set(prev);
            if (next.has(messageId)) {
                next.delete(messageId);
            } else {
                next.add(messageId);
            }
            return next;
        });
    }, []);

    const clearSelectionMode = useCallback(() => {
        setSelectionMode(false);
        setSelectedMessageIds(new Set());
        setCopiedSelection(false);
    }, []);

    const copySelectedMessages = useCallback(async () => {
        const selectedRows = allRenderableMessages.filter((msg) => selectedMessageIds.has(msg._id));
        if (!selectedRows.length) return;

        const lines = selectedRows.map((msg) => {
            const senderId = msg.sender?._id || msg.sender;
            const nickname = senderId && room?.nicknames?.[senderId];
            const senderName = nickname || msg.sender?.username || (senderId === user?._id ? 'Bạn' : 'Người dùng');
            const body = isStickerPayload(msg.content)
                ? '[Sticker]'
                : (msg.content || msg.file?.name || `[${msg.type || 'text'}]`);
            return `${senderName} (${format(new Date(msg.createdAt), 'HH:mm')}): ${body}`;
        });

        try {
            await navigator.clipboard.writeText(lines.join('\n'));
            setCopiedSelection(true);
            setTimeout(() => setCopiedSelection(false), 1500);
        } catch (error) {
            console.error('Copy selected messages error:', error);
        }
    }, [allRenderableMessages, selectedMessageIds, room?.nicknames, user?._id]);

    useEffect(() => {
        const handleGlobalShortcut = (event) => {
            if (!(event.ctrlKey || event.metaKey)) return;

            const key = event.key.toLowerCase();
            if (key === 'k') {
                event.preventDefault();
                window.dispatchEvent(new CustomEvent('roomlist:focus-search'));
                return;
            }

            if (event.key === 'ArrowUp' || event.key === 'ArrowDown') {
                event.preventDefault();
                window.dispatchEvent(new CustomEvent('roomlist:navigate', {
                    detail: { direction: event.key === 'ArrowUp' ? 'up' : 'down' },
                }));
            }
        };

        window.addEventListener('keydown', handleGlobalShortcut);
        return () => window.removeEventListener('keydown', handleGlobalShortcut);
    }, []);

    // Listen for poll updates
    useEffect(() => {
        if (!roomId) return;
        const handlePollUpdated = () => {
            // useChat will handle updating messages via message:received
            // but poll:updated is a separate event, so we need to refresh
            // The messages state is managed by useChat, we can emit a custom event
        };
        on('poll:updated', handlePollUpdated);
        return () => off('poll:updated', handlePollUpdated);
    }, [roomId, on, off]);

    // Listen for real-time pin/unpin events
    useEffect(() => {
        if (!roomId) return;
        const handlePinnedEvent = ({ messageId, roomId: eventRoomId, pinned, message: msg }) => {
            if (eventRoomId !== roomId) return;
            if (pinned && msg) {
                setPinnedMessages((prev) => {
                    if (prev.some((m) => m._id === messageId)) return prev;
                    return [...prev, msg];
                });
            } else {
                setPinnedMessages((prev) => prev.filter((m) => m._id !== messageId));
            }
        };
        on('message:pinned', handlePinnedEvent);
        return () => off('message:pinned', handlePinnedEvent);
    }, [roomId, on, off]);

    // Scroll to a specific message by ID
    const scrollToMessage = useCallback((messageId) => {
        const el = containerRef.current?.querySelector(`[data-message-id="${messageId}"]`);
        if (el) {
            el.scrollIntoView({ behavior: 'smooth', block: 'center' });
            el.classList.add('bg-amber-100/50');
            setTimeout(() => el.classList.remove('bg-amber-100/50'), 2000);
        }
    }, []);

    if (!roomId) {
        return (
            <div className="flex-1 flex items-center justify-center bg-gray-50 px-4">
                <div className="w-full max-w-xl text-center">
                    <div className="text-6xl mb-4">💬</div>
                    <p className="text-xl font-semibold text-gray-700">Chọn cuộc trò chuyện để bắt đầu</p>
                    <p className="text-sm mt-1 text-gray-400">Hoặc mở nhanh theo gợi ý bên dưới</p>

                    <div className="mt-5 grid grid-cols-1 sm:grid-cols-3 gap-2">
                        <button
                            onClick={() => onOpenStartAction?.('topics')}
                            className="px-3 py-2.5 rounded-xl border border-gray-200 bg-white hover:border-emerald-300 hover:bg-emerald-50 transition text-left"
                        >
                            <span className="inline-flex items-center gap-1.5 text-[13px] font-semibold text-emerald-700">
                                <Compass size={14} />
                                Khám phá chủ đề
                            </span>
                            <p className="text-[11px] text-gray-400 mt-1">Mở danh sách phòng chủ đề</p>
                        </button>

                        <button
                            onClick={() => onOpenStartAction?.('chats-search')}
                            className="px-3 py-2.5 rounded-xl border border-gray-200 bg-white hover:border-indigo-300 hover:bg-indigo-50 transition text-left"
                        >
                            <span className="inline-flex items-center gap-1.5 text-[13px] font-semibold text-indigo-700">
                                <Search size={14} />
                                Tìm cuộc trò chuyện
                            </span>
                            <p className="text-[11px] text-gray-400 mt-1">Focus vào ô tìm kiếm chat</p>
                        </button>

                        <button
                            onClick={() => onOpenStartAction?.('counseling')}
                            className="px-3 py-2.5 rounded-xl border border-gray-200 bg-white hover:border-rose-300 hover:bg-rose-50 transition text-left"
                        >
                            <span className="inline-flex items-center gap-1.5 text-[13px] font-semibold text-rose-700">
                                <HeartHandshake size={14} />
                                Tư vấn
                            </span>
                            <p className="text-[11px] text-gray-400 mt-1">Mở trang tư vấn hỗ trợ</p>
                        </button>
                    </div>

                    <div className="mt-4 rounded-2xl border border-gray-200 bg-white p-3 text-left">
                        <p className="text-sm font-semibold text-gray-700 inline-flex items-center gap-1.5">
                            <UserPlus size={14} className="text-[var(--color-primary)]" />
                            Gợi ý bạn bè cho bạn
                        </p>

                        {startSuggestionLoading ? (
                            <div className="py-6 text-center text-xs text-gray-400">
                                <Loader2 size={14} className="animate-spin mx-auto mb-2" />
                                Đang tải gợi ý...
                            </div>
                        ) : startSuggestions.length === 0 ? (
                            <p className="py-4 text-xs text-gray-400 text-center">Hiện chưa có gợi ý phù hợp.</p>
                        ) : (
                            <div className="mt-2 space-y-2">
                                {startSuggestions.map((item) => (
                                    <div key={item._id} className="flex items-center gap-2 rounded-lg border border-gray-100 px-2.5 py-2">
                                        <div 
                                            className="w-8 h-8 rounded-full bg-[var(--color-primary)] text-white flex items-center justify-center text-sm font-semibold overflow-hidden shrink-0 cursor-pointer hover:ring-2 hover:ring-[var(--color-primary-ring)] transition"
                                            onClick={() => navigate(`/profile/${item._id}`)}
                                            title="Xem hồ sơ"
                                        >
                                            {item.avatar || item.googlePicture ? (
                                                <img src={item.avatar || item.googlePicture} alt={item.username} className="w-full h-full object-cover" />
                                            ) : (
                                                item.username?.charAt(0)?.toUpperCase()
                                            )}
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <p className="text-sm font-medium text-gray-800 truncate flex items-center gap-2">
                                                {item.username}
                                                <span className="text-[10px] font-bold text-green-700 bg-green-100 px-1.5 py-0.5 rounded-full border border-green-200">
                                                    {item.similarityScore || item.topicAffinityScore || 0}%
                                                </span>
                                            </p>
                                            <p className="text-[11px] text-gray-400 truncate">
                                                {(item.reasonBadges || []).slice(0, 1).join(' • ') || 'Có điểm tương đồng với bạn'}
                                            </p>
                                        </div>
                                        <button
                                            onClick={() => handleStartSuggestionRequest(item._id)}
                                            disabled={startSuggestionActionId === item._id}
                                            className="px-2.5 py-1 rounded-full text-[11px] font-medium bg-[var(--color-primary-light)] text-[var(--color-primary)] hover:bg-[var(--color-primary-medium)] disabled:opacity-50"
                                        >
                                            {startSuggestionActionId === item._id ? 'Đang gửi' : 'Kết bạn'}
                                        </button>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="flex-1 flex flex-col h-full min-h-0 bg-white relative">
            {/* Header */}
            <div className="flex items-center gap-3 px-4 py-3 border-b border-gray-200 bg-white">
                {/* Back button (mobile) */}
                <button
                    onClick={onBack}
                    className="md:hidden p-1 hover:bg-gray-100 rounded-full shrink-0"
                >
                    <ArrowLeft size={20} />
                </button>

                {/* Avatar */}
                <div className="relative">
                    <div
                        className={`w-10 h-10 rounded-full flex items-center justify-center text-white font-semibold overflow-hidden ${display.isGroup ? 'bg-purple-500' : 'bg-[var(--color-primary)]'
                            }`}
                        title={`${display.name}${display.subtitle ? ` - ${display.subtitle}` : ''}`}
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
                <div className="flex items-center gap-1 max-w-[50vw] md:max-w-none overflow-x-auto scrollbar-hide">
                    <button
                        onClick={() => onOpenStartAction?.('home')}
                        className="p-2 hover:bg-gray-100 rounded-full transition text-gray-600 shrink-0"
                        title="Về trang chọn cuộc trò chuyện"
                    >
                        <House size={18} />
                    </button>

                    <button
                        onClick={() => {
                            if (selectionMode) {
                                clearSelectionMode();
                            } else {
                                setSelectionMode(true);
                                setSelectedMessageIds(new Set());
                            }
                        }}
                        className={`p-2 rounded-full transition shrink-0 ${selectionMode ? 'bg-[var(--color-primary-light)] text-[var(--color-primary)]' : 'hover:bg-gray-100 text-gray-600'}`}
                        title="Chọn nhiều tin để sao chép"
                    >
                        <CheckSquare size={18} />
                    </button>

                    <AIToggle
                        enabled={aiBotEnabled}
                        onToggle={handleToggleAI}
                        onSummarize={() => summarize(20)}
                    />

                    {/* Call buttons - available for both 1-1 and group */}
                    <button
                        onClick={() => handleCall('audio')}
                        disabled={!display.isGroup && friendshipStatus !== 'accepted'}
                        className="p-2 hover:bg-gray-100 rounded-full transition text-gray-600 shrink-0 disabled:opacity-40 disabled:cursor-not-allowed"
                        title={!display.isGroup && friendshipStatus !== 'accepted' ? 'Chỉ gọi được khi đã là bạn bè' : 'Gọi thoại'}
                    >
                        <Phone size={18} />
                    </button>
                    <button
                        onClick={() => handleCall('video')}
                        disabled={!display.isGroup && friendshipStatus !== 'accepted'}
                        className="p-2 hover:bg-gray-100 rounded-full transition text-gray-600 shrink-0 disabled:opacity-40 disabled:cursor-not-allowed"
                        title={!display.isGroup && friendshipStatus !== 'accepted' ? 'Chỉ gọi được khi đã là bạn bè' : 'Gọi video'}
                    >
                        <Video size={18} />
                    </button>

                    <button
                        onClick={() => setShowPollCreator(true)}
                        className="p-2 hover:bg-gray-100 rounded-full transition text-gray-600 shrink-0"
                        title="Tạo bình chọn"
                    >
                        <BarChart3 size={18} />
                    </button>

                    <button
                        onClick={() => onToggleInfo?.(room)}
                        className="p-2 hover:bg-gray-100 rounded-full transition text-gray-600 shrink-0"
                        title="Thông tin"
                    >
                        <Info size={18} />
                    </button>
                </div>
            </div>
            {/* Pinned Messages Bar */}
            <PinnedHeader
                pinnedMessages={pinnedMessages}
                onScrollToMessage={scrollToMessage}
                onUnpin={handlePinMessage}
            />

            {/* Messages */}
            <div
                ref={containerRef}
                onScroll={handleScroll}
                className="flex-1 overflow-y-auto px-4 py-3 scrollbar-thin bg-gray-50 conversation-bg"
            >
                {/* Empty conversation — Profile Header */}
                {loading && allRenderableMessages.length === 0 ? (
                    <div className="space-y-3 py-2">
                        {Array.from({ length: 7 }).map((_, idx) => (
                            <div key={`msg-skeleton-${idx}`} className={`flex ${idx % 3 === 0 ? 'justify-end' : 'justify-start'}`}>
                                <div className="max-w-[80%] space-y-2">
                                    <SkeletonBlock className="h-3 w-14 rounded-md" />
                                    <SkeletonBlock className={`h-10 rounded-2xl ${idx % 2 === 0 ? 'w-44' : 'w-64 max-w-[75vw]'}`} />
                                </div>
                            </div>
                        ))}
                    </div>
                ) : !loading && allRenderableMessages.length === 0 ? (
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
                        <div className={`mt-6 text-4xl ${reduceMotion ? '' : 'animate-bounce'}`}>👋</div>
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

                        {/* Messages list — merge server messages with local-only system messages */}
                        <AnimatePresence initial={false}>
                            {allRenderableMessages
                                .map((msg, index, list) => {
                                    const prev = list[index - 1];
                                    const next = list[index + 1];
                                    const isClusterStart = !isClusterMate(prev, msg);
                                    const isClusterEnd = !isClusterMate(msg, next);

                                    return (
                                    <motion.div
                                        key={msg._id}
                                        data-message-id={msg._id}
                                        className={`transition-colors duration-500 ${msg.pending ? 'opacity-85' : ''}`}
                                        layout={!reduceMotion}
                                        initial={reduceMotion ? false : { opacity: 0, y: 10 }}
                                        animate={reduceMotion ? { opacity: 1 } : { opacity: 1, y: 0 }}
                                        exit={reduceMotion ? { opacity: 0 } : { opacity: 0, y: -8 }}
                                        transition={reduceMotion ? { duration: 0 } : { duration: 0.18, ease: 'easeOut' }}
                                    >
                                        <MessageBubble
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
                                            selectionMode={selectionMode}
                                            isSelected={selectedMessageIds.has(msg._id)}
                                            onToggleSelect={toggleMessageSelection}
                                            onQuickReply={handleQuickReply}
                                            isClusterStart={isClusterStart}
                                            isClusterEnd={isClusterEnd}
                                        />
                                    </motion.div>
                                );
                                })}
                        </AnimatePresence>
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

            {selectionMode && (
                <div className="px-4 py-2 border-t border-gray-200 bg-[var(--color-primary-light)] flex flex-wrap items-center justify-between gap-2">
                    <div className="text-sm text-[var(--color-primary-dark)] flex items-center gap-1.5">
                        <Reply size={14} className="opacity-70" />
                        <span>Đã chọn {selectedMessageIds.size} tin nhắn</span>
                    </div>
                    <div className="flex items-center gap-2 ml-auto">
                        <button
                            onClick={copySelectedMessages}
                            disabled={selectedMessageIds.size === 0}
                            className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-medium bg-white border border-gray-200 text-[var(--color-primary)] hover:bg-gray-50 disabled:opacity-50"
                        >
                            <Copy size={13} />
                            {copiedSelection ? 'Đã sao chép' : 'Sao chép'}
                        </button>
                        <button
                            onClick={clearSelectionMode}
                            className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-medium bg-white border border-gray-200 text-gray-500 hover:bg-gray-50"
                        >
                            <X size={13} />
                            Hủy
                        </button>
                    </div>
                </div>
            )}

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
                    onSend={handleSendMessage}
                    onSendLocation={sendLocation}
                    onTyping={startTyping}
                    disabled={!room}
                    lockUntil={
                        user?.accountStatus === 'locked' && user?.lockUntil
                            ? user.lockUntil
                            : null
                    }
                    replyContext={replyDraft}
                    onCancelReply={() => setReplyDraft(null)}
                    onLockExpire={() => updateLockStatus('active', null)}
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

            {/* Lock Overlay — shown when admin locks this account in real time */}
            {lockOverlay && (
                <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/60 rounded-none">
                    <div className="bg-white rounded-2xl shadow-2xl p-6 mx-6 max-w-sm w-full text-center">
                        <div className="flex items-center justify-center w-14 h-14 rounded-full bg-orange-100 mx-auto mb-4">
                            <Lock size={28} className="text-orange-500" />
                        </div>
                        <h3 className="text-lg font-bold text-gray-900 mb-2">Tài khoản bị khóa</h3>
                        <p className="text-sm text-gray-600 mb-1">
                            Tài khoản của bạn đã bị khóa
                            {user?.lockUntil
                                ? ` đến ${format(new Date(user.lockUntil), 'HH:mm - dd/MM/yyyy')}`
                                : ''}.
                        </p>
                        <p className="text-xs text-gray-400 mb-5">Bạn sẽ bị hạn chế tính năng trong thời gian này.</p>
                        <button
                            onClick={() => setLockOverlay(false)}
                            className="w-full py-2 rounded-xl bg-orange-500 text-white font-semibold hover:bg-orange-600 transition"
                        >
                            Đã hiểu
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}
