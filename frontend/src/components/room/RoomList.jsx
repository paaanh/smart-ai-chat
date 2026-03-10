import { useState, useEffect } from 'react';
import { roomAPI } from '../../services/api';
import { useAuth } from '../../hooks/useAuth';
import { useSocket } from '../../hooks/useSocket';
import { formatDistanceToNow } from 'date-fns';
import { vi } from 'date-fns/locale';
import { Plus, Search, MessageCircle, Users } from 'lucide-react';
import CreateRoomModal from './CreateRoomModal';

export default function RoomList({ activeRoomId, onSelectRoom }) {
    const { user } = useAuth();
    const { onlineUsers, on, off } = useSocket();
    const [rooms, setRooms] = useState([]);
    const [search, setSearch] = useState('');
    const [showCreate, setShowCreate] = useState(false);
    const [loading, setLoading] = useState(true);
    const [unreadCounts, setUnreadCounts] = useState({});

    useEffect(() => {
        loadRooms();
    }, []);

    // Clear unread when a room becomes active
    useEffect(() => {
        if (activeRoomId) {
            setUnreadCounts((prev) => {
                if (!prev[activeRoomId]) return prev;
                const next = { ...prev };
                delete next[activeRoomId];
                return next;
            });
        }
    }, [activeRoomId]);

    // Listen for room updates
    useEffect(() => {
        const handleRoomUpdate = (updatedRoom) => {
            setRooms((prev) => {
                const idx = prev.findIndex((r) => r._id === updatedRoom._id);
                if (idx >= 0) {
                    const updated = [...prev];
                    updated[idx] = { ...updated[idx], ...updatedRoom };
                    return updated.sort(
                        (a, b) => new Date(b.lastMessage?.createdAt || b.updatedAt) - new Date(a.lastMessage?.createdAt || a.updatedAt)
                    );
                }
                return [updatedRoom, ...prev];
            });
        };

        on('room:updated', handleRoomUpdate);
        return () => off('room:updated', handleRoomUpdate);
    }, [on, off]);

    // Listen for nickname updates to reflect in sidebar
    useEffect(() => {
        const handleNicknameUpdated = ({ roomId, nicknames }) => {
            setRooms((prev) =>
                prev.map((r) =>
                    r._id === roomId ? { ...r, nicknames } : r
                )
            );
        };
        on('room:nickname-updated', handleNicknameUpdated);
        return () => off('room:nickname-updated', handleNicknameUpdated);
    }, [on, off]);

    // Listen for new messages (sidebar update + unread badge)
    useEffect(() => {
        const handleNewMessage = ({ roomId: msgRoomId, lastMessage, senderId }) => {
            // Update lastMessage and re-sort rooms
            setRooms((prev) => {
                const idx = prev.findIndex((r) => r._id === msgRoomId);
                if (idx < 0) return prev;
                const updated = [...prev];
                updated[idx] = { ...updated[idx], lastMessage, updatedAt: new Date().toISOString() };
                return updated.sort(
                    (a, b) => new Date(b.lastMessage?.createdAt || b.updatedAt) - new Date(a.lastMessage?.createdAt || a.updatedAt)
                );
            });

            // Increment unread if not active room and not own message
            if (msgRoomId !== activeRoomId && senderId !== user?._id) {
                setUnreadCounts((prev) => ({
                    ...prev,
                    [msgRoomId]: (prev[msgRoomId] || 0) + 1,
                }));
            }
        };

        on('room:new-message', handleNewMessage);
        return () => off('room:new-message', handleNewMessage);
    }, [on, off, activeRoomId, user]);

    const loadRooms = async () => {
        try {
            const { data } = await roomAPI.getAll();
            setRooms(data.rooms || []);
        } catch (err) {
            console.error('Load rooms error:', err);
        } finally {
            setLoading(false);
        }
    };

    const getRoomDisplay = (room) => {
        if (room.type === 'group') {
            return { name: room.name, avatar: null, isGroup: true };
        }
        // Direct: show nickname if set, otherwise the other person's name
        const other = room.members?.find((m) => {
            const uid = m.user?._id || m.user;
            return uid !== user?._id;
        });
        const otherUser = other?.user;
        const otherNickname = otherUser?._id && room.nicknames?.[otherUser._id];
        return {
            name: otherNickname || otherUser?.username || 'Unknown',
            avatar: otherUser?.avatar || otherUser?.googlePicture,
            isGroup: false,
            otherUserId: otherUser?._id,
        };
    };

    const filtered = rooms.filter((r) => {
        if (!search) return true;
        const display = getRoomDisplay(r);
        return display.name.toLowerCase().includes(search.toLowerCase());
    });

    const handleCreated = (newRoom) => {
        setRooms((prev) => [newRoom, ...prev]);
        setShowCreate(false);
        onSelectRoom(newRoom._id);
    };

    return (
        <div className="h-full flex flex-col bg-white border-r border-gray-200">
            {/* Header */}
            <div className="p-4 border-b border-gray-100">
                <div className="flex items-center justify-between mb-3">
                    <h2 className="text-xl font-bold text-gray-900">Tin nhắn</h2>
                    <button
                        onClick={() => setShowCreate(true)}
                        className="p-2 hover:bg-gray-100 rounded-full transition"
                        title="Tạo cuộc trò chuyện"
                    >
                        <Plus size={20} className="text-[var(--color-primary)]" />
                    </button>
                </div>

                {/* Search */}
                <div className="relative">
                    <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                    <input
                        type="text"
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        placeholder="Tìm kiếm..."
                        className="w-full pl-9 pr-4 py-2 bg-gray-100 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-primary-ring)] transition"
                    />
                </div>
            </div>

            {/* Room List */}
            <div className="flex-1 overflow-y-auto scrollbar-thin">
                {loading && (
                    <div className="p-8 text-center text-gray-400">
                        <div className="animate-spin w-6 h-6 border-2 border-[var(--color-primary-ring)] border-t-transparent rounded-full mx-auto" />
                    </div>
                )}

                {!loading && filtered.length === 0 && (
                    <div className="p-8 text-center text-gray-400">
                        <MessageCircle size={40} className="mx-auto mb-2 opacity-50" />
                        <p className="text-sm">Chưa có cuộc trò chuyện nào</p>
                    </div>
                )}

                {filtered.map((room) => {
                    const display = getRoomDisplay(room);
                    const isActive = room._id === activeRoomId;
                    const isOnline = display.otherUserId && onlineUsers.includes(display.otherUserId);
                    const lastMsg = room.lastMessage;
                    const unread = unreadCounts[room._id] || 0;

                    return (
                        <button
                            key={room._id}
                            onClick={() => onSelectRoom(room._id)}
                            className={`w-full flex items-center gap-3 px-4 py-3 hover:bg-gray-50 transition text-left ${isActive ? 'bg-[var(--color-primary-light)] border-r-2 border-[var(--color-primary-ring)]' : ''
                                }`}
                        >
                            {/* Avatar */}
                            <div className="relative shrink-0">
                                <div
                                    className={`w-12 h-12 rounded-full flex items-center justify-center text-white font-semibold text-lg overflow-hidden ${display.isGroup ? 'bg-purple-500' : 'bg-[var(--color-primary)]'
                                        }`}
                                >
                                    {display.isGroup ? (
                                        <Users size={20} />
                                    ) : display.avatar ? (
                                        <img src={display.avatar} alt={display.name} className="w-full h-full object-cover" />
                                    ) : (
                                        display.name.charAt(0).toUpperCase()
                                    )}
                                </div>
                                {isOnline && (
                                    <div className="absolute bottom-0 right-0 w-3.5 h-3.5 bg-green-500 border-2 border-white rounded-full" />
                                )}
                            </div>

                            {/* Info */}
                            <div className="flex-1 min-w-0">
                                <div className="flex items-center justify-between">
                                    <span className={`font-medium truncate ${unread > 0 ? 'text-gray-900' : 'text-gray-900'}`}>{display.name}</span>
                                    <div className="flex items-center gap-1.5 shrink-0 ml-2">
                                        {lastMsg && (
                                            <span className="text-xs text-gray-400">
                                                {formatDistanceToNow(new Date(lastMsg.createdAt), {
                                                    addSuffix: false,
                                                    locale: vi,
                                                })}
                                            </span>
                                        )}
                                        {unread > 0 && (
                                            <span className="bg-[var(--color-primary)] text-white text-[10px] font-bold rounded-full min-w-[18px] h-[18px] flex items-center justify-center px-1">
                                                {unread > 99 ? '99+' : unread}
                                            </span>
                                        )}
                                    </div>
                                </div>
                                {lastMsg && (
                                    <p className={`text-sm truncate mt-0.5 ${unread > 0 ? 'text-gray-900 font-semibold' : 'text-gray-500'}`}>
                                        {lastMsg.type === 'system'
                                            ? lastMsg.content
                                            : lastMsg.sender?.username
                                                ? `${lastMsg.sender.username}: ${lastMsg.content}`
                                                : lastMsg.content}
                                    </p>
                                )}
                            </div>
                        </button>
                    );
                })}
            </div>

            {/* Create Room Modal */}
            {showCreate && (
                <CreateRoomModal onClose={() => setShowCreate(false)} onCreated={handleCreated} />
            )}
        </div>
    );
}
