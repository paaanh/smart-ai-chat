import { useState, useEffect, useCallback } from 'react';
import { friendAPI, userAPI, roomAPI } from '../../services/api';
import { useSocket } from '../../hooks/useSocket';
import { useAuth } from '../../hooks/useAuth';
import {
    UserPlus,
    UserCheck,
    UserX,
    Search,
    Loader2,
    Clock,
    Users,
    MessageCircle,
    X,
    Check,
    Bell,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export default function FriendPanel({ onSelectRoom }) {
    const { user } = useAuth();
    const { on, off, onlineUsers } = useSocket();
    const navigate = useNavigate();
    const [tab, setTab] = useState('friends'); // friends | requests | search
    const [friends, setFriends] = useState([]);
    const [requests, setRequests] = useState([]);
    const [sentRequests, setSentRequests] = useState([]);
    const [searchQuery, setSearchQuery] = useState('');
    const [searchResults, setSearchResults] = useState([]);
    const [loading, setLoading] = useState(true);
    const [searching, setSearching] = useState(false);
    const [actionLoading, setActionLoading] = useState(null);

    // Load friends and requests
    const loadData = useCallback(async () => {
        setLoading(true);
        try {
            const [friendsRes, requestsRes, sentRes] = await Promise.all([
                friendAPI.getAll(),
                friendAPI.getRequests(),
                friendAPI.getSent(),
            ]);
            setFriends(friendsRes.data.friends || []);
            setRequests(requestsRes.data.requests || []);
            setSentRequests(sentRes.data.requests || []);
        } catch (err) {
            console.error('Load friends error:', err);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        loadData();
    }, [loadData]);

    // Real-time friend events
    useEffect(() => {
        const handleRequestReceived = ({ friendship }) => {
            setRequests((prev) => {
                if (prev.some((r) => r._id === friendship._id)) return prev;
                return [friendship, ...prev];
            });
        };

        const handleAccepted = ({ friendship }) => {
            // Remove from requests/sent, add to friends
            setRequests((prev) => prev.filter((r) => r._id !== friendship._id));
            setSentRequests((prev) => prev.filter((r) => r._id !== friendship._id));
            // Add the new friend
            const friend =
                friendship.requester._id === user?._id
                    ? friendship.recipient
                    : friendship.requester;
            setFriends((prev) => {
                if (prev.some((f) => f._id === friend._id)) return prev;
                return [...prev, { ...friend, friendshipId: friendship._id }];
            });
        };

        const handleRejected = ({ friendshipId }) => {
            setRequests((prev) => prev.filter((r) => r._id !== friendshipId));
        };

        on('friend:request-received', handleRequestReceived);
        on('friend:accepted', handleAccepted);
        on('friend:rejected', handleRejected);

        return () => {
            off('friend:request-received', handleRequestReceived);
            off('friend:accepted', handleAccepted);
            off('friend:rejected', handleRejected);
        };
    }, [on, off, user]);

    // Search users
    const handleSearch = async (q) => {
        setSearchQuery(q);
        if (q.length < 2) {
            setSearchResults([]);
            return;
        }
        setSearching(true);
        try {
            const { data } = await userAPI.search(q);
            const users = (data.users || []).filter((u) => u._id !== user?._id);

            // Get friendship status for each result
            const withStatus = await Promise.all(
                users.map(async (u) => {
                    try {
                        const { data: statusData } = await friendAPI.getStatus(u._id);
                        return { ...u, friendStatus: statusData.status, friendshipId: statusData.friendshipId, isRequester: statusData.isRequester };
                    } catch {
                        return { ...u, friendStatus: 'none', friendshipId: null };
                    }
                })
            );
            setSearchResults(withStatus);
        } catch {
            setSearchResults([]);
        } finally {
            setSearching(false);
        }
    };

    // Send friend request
    const handleSendRequest = async (recipientId) => {
        setActionLoading(recipientId);
        try {
            await friendAPI.sendRequest(recipientId);
            // Update search result status
            setSearchResults((prev) =>
                prev.map((u) =>
                    u._id === recipientId ? { ...u, friendStatus: 'pending', isRequester: true } : u
                )
            );
            // Also refresh sent requests
            const { data } = await friendAPI.getSent();
            setSentRequests(data.requests || []);
        } catch (err) {
            console.error('Send request error:', err);
        } finally {
            setActionLoading(null);
        }
    };

    // Accept friend request
    const handleAccept = async (friendshipId) => {
        setActionLoading(friendshipId);
        try {
            await friendAPI.accept(friendshipId);
            await loadData();
        } catch (err) {
            console.error('Accept error:', err);
        } finally {
            setActionLoading(null);
        }
    };

    // Reject friend request
    const handleReject = async (friendshipId) => {
        setActionLoading(friendshipId);
        try {
            await friendAPI.reject(friendshipId);
            setRequests((prev) => prev.filter((r) => r._id !== friendshipId));
        } catch (err) {
            console.error('Reject error:', err);
        } finally {
            setActionLoading(null);
        }
    };

    // Start chat with friend (create/find direct room)
    const handleStartChat = async (friendId) => {
        try {
            const { data } = await roomAPI.create({
                type: 'direct',
                memberIds: [friendId],
            });
            onSelectRoom(data.room._id);
        } catch (err) {
            console.error('Start chat error:', err);
        }
    };

    const requestCount = requests.length;

    return (
        <div className="h-full flex flex-col bg-white border-r border-gray-200">
            {/* Header */}
            <div className="p-4 border-b border-gray-100">
                <h2 className="text-xl font-bold text-gray-900 mb-3">Bạn bè</h2>

                {/* Tabs */}
                <div className="flex gap-1 bg-gray-100 rounded-lg p-1">
                    <button
                        onClick={() => setTab('friends')}
                        className={`flex-1 py-1.5 text-xs font-medium rounded-md transition ${tab === 'friends'
                            ? 'bg-white text-[var(--color-primary)] shadow-sm'
                            : 'text-gray-500 hover:text-gray-700'
                            }`}
                    >
                        <Users size={14} className="inline mr-1" />
                        Bạn bè
                    </button>
                    <button
                        onClick={() => setTab('requests')}
                        className={`flex-1 py-1.5 text-xs font-medium rounded-md transition relative ${tab === 'requests'
                            ? 'bg-white text-[var(--color-primary)] shadow-sm'
                            : 'text-gray-500 hover:text-gray-700'
                            }`}
                    >
                        <Bell size={14} className="inline mr-1" />
                        Lời mời
                        {requestCount > 0 && (
                            <span className="absolute -top-1 -right-1 bg-red-500 text-white text-[10px] rounded-full w-4 h-4 flex items-center justify-center">
                                {requestCount}
                            </span>
                        )}
                    </button>
                    <button
                        onClick={() => setTab('search')}
                        className={`flex-1 py-1.5 text-xs font-medium rounded-md transition ${tab === 'search'
                            ? 'bg-white text-[var(--color-primary)] shadow-sm'
                            : 'text-gray-500 hover:text-gray-700'
                            }`}
                    >
                        <UserPlus size={14} className="inline mr-1" />
                        Thêm
                    </button>
                </div>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto scrollbar-thin">
                {loading && (
                    <div className="p-8 text-center text-gray-400">
                        <Loader2 size={24} className="animate-spin mx-auto" />
                    </div>
                )}

                {/* ── Friends List ── */}
                {!loading && tab === 'friends' && (
                    <>
                        {friends.length === 0 ? (
                            <div className="p-8 text-center text-gray-400">
                                <Users size={40} className="mx-auto mb-2 opacity-50" />
                                <p className="text-sm">Chưa có bạn bè</p>
                                <button
                                    onClick={() => setTab('search')}
                                    className="mt-2 text-sm text-[var(--color-primary)] hover:text-[var(--color-primary-hover)]"
                                >
                                    Tìm kiếm bạn bè
                                </button>
                            </div>
                        ) : (
                            friends.map((friend) => {
                                const isOnline = onlineUsers.includes(friend._id);
                                return (
                                    <div
                                        key={friend._id}
                                        className="flex items-center gap-3 px-4 py-3 hover:bg-gray-50 transition"
                                    >
                                        <div className="relative shrink-0">
                                            <div
                                                className="w-10 h-10 rounded-full bg-[var(--color-primary)] flex items-center justify-center text-white font-semibold cursor-pointer hover:ring-2 hover:ring-[var(--color-primary-ring)] transition overflow-hidden"
                                                onClick={() => navigate(`/profile/${friend._id}`)}
                                                title="Xem trang cá nhân"
                                            >
                                                {friend.avatar ? (
                                                    <img src={friend.avatar} alt={friend.username} className="w-full h-full object-cover" />
                                                ) : (
                                                    friend.username?.charAt(0).toUpperCase()
                                                )}
                                            </div>
                                            {isOnline && (
                                                <div className="absolute bottom-0 right-0 w-3 h-3 bg-green-500 border-2 border-white rounded-full" />
                                            )}
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <p className="font-medium text-gray-900 text-sm truncate">
                                                {friend.username}
                                            </p>
                                            <p className="text-xs text-gray-400">
                                                {isOnline ? 'Đang hoạt động' : 'Offline'}
                                            </p>
                                        </div>
                                        <button
                                            onClick={() => handleStartChat(friend._id)}
                                            className="p-2 hover:bg-[var(--color-primary-light)] rounded-full text-[var(--color-primary)] transition"
                                            title="Nhắn tin"
                                        >
                                            <MessageCircle size={18} />
                                        </button>
                                    </div>
                                );
                            })
                        )}
                    </>
                )}

                {/* ── Requests Tab ── */}
                {!loading && tab === 'requests' && (
                    <>
                        {/* Incoming requests */}
                        {requests.length > 0 && (
                            <div>
                                <p className="px-4 pt-3 pb-1 text-xs font-semibold text-gray-400 uppercase">
                                    Lời mời nhận được
                                </p>
                                {requests.map((req) => (
                                    <div
                                        key={req._id}
                                        className="flex items-center gap-3 px-4 py-3 hover:bg-gray-50"
                                    >
                                        <div className="w-10 h-10 rounded-full bg-orange-500 flex items-center justify-center text-white font-semibold shrink-0">
                                            {req.requester?.username?.charAt(0).toUpperCase()}
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <p className="font-medium text-gray-900 text-sm truncate">
                                                {req.requester?.username}
                                            </p>
                                            <p className="text-xs text-gray-400">Muốn kết bạn</p>
                                        </div>
                                        <div className="flex gap-1.5">
                                            <button
                                                onClick={() => handleAccept(req._id)}
                                                disabled={actionLoading === req._id}
                                                className="p-1.5 bg-green-500 hover:bg-green-600 text-white rounded-full transition disabled:opacity-50"
                                                title="Chấp nhận"
                                            >
                                                {actionLoading === req._id ? (
                                                    <Loader2 size={14} className="animate-spin" />
                                                ) : (
                                                    <Check size={14} />
                                                )}
                                            </button>
                                            <button
                                                onClick={() => handleReject(req._id)}
                                                disabled={actionLoading === req._id}
                                                className="p-1.5 bg-red-500 hover:bg-red-600 text-white rounded-full transition disabled:opacity-50"
                                                title="Từ chối"
                                            >
                                                <X size={14} />
                                            </button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}

                        {/* Sent requests */}
                        {sentRequests.length > 0 && (
                            <div>
                                <p className="px-4 pt-3 pb-1 text-xs font-semibold text-gray-400 uppercase">
                                    Lời mời đã gửi
                                </p>
                                {sentRequests.map((req) => (
                                    <div
                                        key={req._id}
                                        className="flex items-center gap-3 px-4 py-3 hover:bg-gray-50"
                                    >
                                        <div className="w-10 h-10 rounded-full bg-gray-400 flex items-center justify-center text-white font-semibold shrink-0">
                                            {req.recipient?.username?.charAt(0).toUpperCase()}
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <p className="font-medium text-gray-900 text-sm truncate">
                                                {req.recipient?.username}
                                            </p>
                                            <div className="flex items-center gap-1 text-xs text-yellow-600">
                                                <Clock size={12} />
                                                <span>Đang chờ</span>
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}

                        {requests.length === 0 && sentRequests.length === 0 && (
                            <div className="p-8 text-center text-gray-400">
                                <Bell size={40} className="mx-auto mb-2 opacity-50" />
                                <p className="text-sm">Không có lời mời kết bạn</p>
                            </div>
                        )}
                    </>
                )}

                {/* ── Search / Add Friend Tab ── */}
                {!loading && tab === 'search' && (
                    <div className="p-4 space-y-3">
                        <div className="relative">
                            <Search
                                size={16}
                                className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
                            />
                            <input
                                type="text"
                                value={searchQuery}
                                onChange={(e) => handleSearch(e.target.value)}
                                placeholder="Tìm theo tên hoặc email..."
                                className="w-full pl-9 pr-4 py-2 bg-gray-100 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-primary-ring)]"
                            />
                        </div>

                        {searching && (
                            <div className="text-center py-4">
                                <Loader2 size={20} className="animate-spin mx-auto text-[var(--color-primary)]" />
                            </div>
                        )}

                        {searchResults.map((u) => (
                            <div
                                key={u._id}
                                className="flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-gray-50"
                            >
                                <div className="w-10 h-10 rounded-full bg-[var(--color-primary)] flex items-center justify-center text-white font-medium shrink-0">
                                    {u.username.charAt(0).toUpperCase()}
                                </div>
                                <div className="flex-1 min-w-0">
                                    <p className="font-medium text-gray-900 text-sm truncate">
                                        {u.username}
                                    </p>
                                    <p className="text-xs text-gray-500">
                                        {u.preferredLanguageLabel || u.preferredLanguage}
                                    </p>
                                </div>
                                {u.friendStatus === 'accepted' ? (
                                    <span className="inline-flex items-center gap-1 text-xs text-green-600 bg-green-50 px-2 py-1 rounded-full">
                                        <UserCheck size={12} />
                                        Bạn bè
                                    </span>
                                ) : u.friendStatus === 'pending' ? (
                                    <span className="inline-flex items-center gap-1 text-xs text-yellow-600 bg-yellow-50 px-2 py-1 rounded-full">
                                        <Clock size={12} />
                                        {u.isRequester ? 'Đã gửi' : 'Chờ bạn'}
                                    </span>
                                ) : (
                                    <button
                                        onClick={() => handleSendRequest(u._id)}
                                        disabled={actionLoading === u._id}
                                        className="inline-flex items-center gap-1 text-xs text-[var(--color-primary)] bg-[var(--color-primary-light)] hover:bg-[var(--color-primary-medium)] px-2.5 py-1.5 rounded-full transition disabled:opacity-50"
                                    >
                                        {actionLoading === u._id ? (
                                            <Loader2 size={12} className="animate-spin" />
                                        ) : (
                                            <UserPlus size={12} />
                                        )}
                                        Kết bạn
                                    </button>
                                )}
                            </div>
                        ))}

                        {!searching && searchQuery.length >= 2 && searchResults.length === 0 && (
                            <p className="text-center text-sm text-gray-400 py-4">
                                Không tìm thấy người dùng
                            </p>
                        )}

                        {searchQuery.length < 2 && (
                            <p className="text-center text-sm text-gray-400 py-4">
                                Nhập ít nhất 2 ký tự để tìm kiếm
                            </p>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
}
