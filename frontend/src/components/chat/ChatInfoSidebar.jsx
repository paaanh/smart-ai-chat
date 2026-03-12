import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import { useSocket } from '../../hooks/useSocket';
import { roomAPI, userActionsAPI, resolveMediaUrl } from '../../services/api';
import MemberList from './MemberList';
import PendingMembers from './PendingMembers';
import NicknameModal from './NicknameModal';
import ReportModal from './ReportModal';
import AddMemberModal from './AddMemberModal';
import {
    X, Users, Bell, BellOff, Ban, Flag, LogOut, UserPlus,
    ChevronDown, ChevronUp, Edit3, Shield, Loader2, Crown, Eye,
} from 'lucide-react';

export default function ChatInfoSidebar({ room, onClose, onRoomUpdate }) {
    const { user } = useAuth();
    const { onlineUsers, on, off } = useSocket();
    const navigate = useNavigate();

    const [muted, setMuted] = useState(false);
    const [blocked, setBlocked] = useState(false);
    const [showMembers, setShowMembers] = useState(true);
    const [showPending, setShowPending] = useState(false);
    const [pendingMembers, setPendingMembers] = useState([]);
    const [actionLoading, setActionLoading] = useState(null);

    // Modals
    const [nicknameTarget, setNicknameTarget] = useState(null);
    const [showReport, setShowReport] = useState(false);
    const [showAddMember, setShowAddMember] = useState(false);

    const isGroup = room?.type === 'group';
    const myMember = room?.members?.find((m) => (m.user?._id || m.user) === user?._id);
    const isAdmin = myMember?.role === 'admin';

    // For 1-1 chats
    const otherMember = !isGroup
        ? room?.members?.find((m) => (m.user?._id || m.user) !== user?._id)
        : null;
    const otherUser = otherMember?.user;
    const otherIsOnline = otherUser?._id && onlineUsers.includes(otherUser._id);

    // Check initial muted/blocked state
    useEffect(() => {
        if (!room) return;
        setMuted(room.mutedBy?.includes(user?._id) || false);
    }, [room, user]);

    useEffect(() => {
        if (isGroup || !otherUser?._id) return;
        userActionsAPI.getBlocked().then(({ data }) => {
            const blockedIds = (data.blockedUsers || []).map((u) => u._id || u);
            setBlocked(blockedIds.includes(otherUser._id));
        }).catch(() => { });
    }, [isGroup, otherUser]);

    // Listen for realtime block/unblock events from the other user
    useEffect(() => {
        if (isGroup || !otherUser?._id) return;
        const handleBlockUpdated = (payload) => {
            if (payload.blockedBy === otherUser._id) {
                // The other user blocked/unblocked us — no change to our "blocked" toggle
                // but we could reflect it in UI if needed
            }
        };
        on('user:block-updated', handleBlockUpdated);
        return () => off('user:block-updated', handleBlockUpdated);
    }, [isGroup, otherUser, on, off]);

    // Listen for realtime nickname updates
    useEffect(() => {
        if (!room?._id) return;
        const handleNicknameUpdated = (payload) => {
            if (payload.roomId === room._id) {
                onRoomUpdate?.({ ...room, nicknames: payload.nicknames });
            }
        };
        on('room:nickname-updated', handleNicknameUpdated);
        return () => off('room:nickname-updated', handleNicknameUpdated);
    }, [room, on, off, onRoomUpdate]);

    // Listen for realtime member-added updates
    useEffect(() => {
        if (!isGroup || !room?._id) return;
        const handleMemberAdded = (payload) => {
            if (payload.roomId === room._id && payload.room) {
                onRoomUpdate?.(payload.room);
            }
        };
        on('room:member-added', handleMemberAdded);
        return () => off('room:member-added', handleMemberAdded);
    }, [isGroup, room, on, off, onRoomUpdate]);

    // Load pending members for admin
    useEffect(() => {
        if (!isGroup || !isAdmin || !room?._id) return;
        roomAPI.getPending(room._id).then(({ data }) => {
            setPendingMembers(data.pendingMembers || []);
        }).catch(() => { });
    }, [isGroup, isAdmin, room]);

    // Listen for real-time group settings updates
    useEffect(() => {
        if (!isGroup || !room?._id) return;
        const handleSettingsUpdate = (payload) => {
            if (payload.roomId === room._id) {
                onRoomUpdate?.((prev) => ({
                    ...(typeof prev === 'object' ? prev : room),
                    name: payload.name ?? room.name,
                    description: payload.description ?? room.description,
                    groupAvatar: payload.groupAvatar ?? room.groupAvatar,
                    groupBackground: payload.groupBackground ?? room.groupBackground,
                }));
            }
        };
        on('room:settings-updated', handleSettingsUpdate);
        return () => off('room:settings-updated', handleSettingsUpdate);
    }, [isGroup, room, on, off, onRoomUpdate]);

    const handleToggleMute = async () => {
        setActionLoading('mute');
        try {
            const { data } = await roomAPI.toggleMute(room._id);
            setMuted(data.muted);
        } catch (err) {
            console.error('Toggle mute error:', err);
        } finally {
            setActionLoading(null);
        }
    };

    const handleToggleBlock = async () => {
        setActionLoading('block');
        try {
            if (blocked) {
                await userActionsAPI.unblock(otherUser._id);
            } else {
                await userActionsAPI.block(otherUser._id);
            }
            setBlocked(!blocked);
        } catch (err) {
            console.error('Toggle block error:', err);
        } finally {
            setActionLoading(null);
        }
    };

    const handleLeave = async () => {
        if (!confirm('Bạn có chắc muốn rời nhóm?')) return;
        setActionLoading('leave');
        try {
            await roomAPI.leave(room._id);
            onRoomUpdate?.(null);
            onClose();
        } catch (err) {
            console.error('Leave room error:', err);
        } finally {
            setActionLoading(null);
        }
    };

    const handleRemoveMember = async (userId) => {
        if (!confirm('Xoá thành viên này khỏi nhóm?')) return;
        try {
            await roomAPI.addMember(room._id, userId); // reuse or call specific endpoint
        } catch (err) {
            console.error('Remove member error:', err);
        }
    };

    const handleNicknameSaved = (targetUserId, nickname) => {
        // Update room nicknames locally
        onRoomUpdate?.({ ...room, nicknames: { ...room.nicknames, [targetUserId]: nickname } });
    };

    const handlePendingApproved = (userId) => {
        setPendingMembers((prev) => prev.filter((m) => (m.user?._id || m._id || m) !== userId));
    };

    const handlePendingRejected = (userId) => {
        setPendingMembers((prev) => prev.filter((m) => (m.user?._id || m._id || m) !== userId));
    };

    if (!room) return null;

    const existingMemberIds = room.members?.map((m) => m.user?._id || m.user) || [];
    const displayName = isGroup
        ? room.name
        : otherUser?.username || 'Unknown';
    const initial = displayName.charAt(0).toUpperCase();

    return (
        <>
            <div className="w-80 shrink-0 bg-white border-l border-gray-200 flex flex-col h-full overflow-hidden">
                {/* Header */}
                <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200">
                    <h3 className="font-semibold text-gray-900">Thông tin</h3>
                    <button onClick={onClose} className="p-1 hover:bg-gray-100 rounded-full transition">
                        <X size={18} />
                    </button>
                </div>

                {/* Scrollable content */}
                <div className="flex-1 overflow-y-auto">
                    {/* Profile section */}
                    <div className="px-4 py-6 text-center border-b border-gray-100">
                        <div
                            className={`w-20 h-20 rounded-full mx-auto flex items-center justify-center text-white text-2xl font-bold cursor-pointer hover:opacity-90 transition overflow-hidden ${isGroup ? 'bg-purple-500' : 'bg-[var(--color-primary)]'}`}
                            onClick={() => {
                                if (isGroup) navigate(`/group/${room._id}`);
                                else if (otherUser?._id) navigate(`/profile/${otherUser._id}`);
                            }}
                        >
                            {isGroup ? (
                                room.groupAvatar ? (
                                    <img src={resolveMediaUrl(room.groupAvatar)} alt={displayName} className="w-full h-full object-cover" />
                                ) : (
                                    <Users size={32} />
                                )
                            ) : (otherUser?.avatar || otherUser?.googlePicture) ? (
                                <img src={resolveMediaUrl(otherUser.avatar || otherUser.googlePicture)} alt={displayName} className="w-full h-full object-cover" />
                            ) : (
                                initial
                            )}
                        </div>
                        <h4 className="mt-3 font-semibold text-gray-900 text-lg">{displayName}</h4>
                        {!isGroup && (
                            <p className={`text-sm ${otherIsOnline ? 'text-green-500' : 'text-gray-400'}`}>
                                {otherIsOnline ? 'Đang hoạt động' : 'Offline'}
                            </p>
                        )}
                        {isGroup && (
                            <p className="text-sm text-gray-400">{room.members?.length || 0} thành viên</p>
                        )}
                    </div>

                    {/* ─── Actions for 1-1 chat ─── */}
                    {!isGroup && (
                        <div className="px-2 py-3 border-b border-gray-100 space-y-0.5">
                            {/* View profile */}
                            <button
                                onClick={() => navigate(`/profile/${otherUser?._id}`)}
                                className="w-full flex items-center gap-3 px-3 py-2.5 text-sm text-gray-700 hover:bg-gray-50 rounded-xl transition"
                            >
                                <Users size={16} className="text-gray-400" />
                                Xem trang cá nhân
                            </button>

                            {/* Set nickname */}
                            <button
                                onClick={() => setNicknameTarget(otherMember)}
                                className="w-full flex items-center gap-3 px-3 py-2.5 text-sm text-gray-700 hover:bg-gray-50 rounded-xl transition"
                            >
                                <Edit3 size={16} className="text-gray-400" />
                                Đặt biệt danh
                            </button>

                            {/* Mute */}
                            <button
                                onClick={handleToggleMute}
                                disabled={actionLoading === 'mute'}
                                className="w-full flex items-center gap-3 px-3 py-2.5 text-sm text-gray-700 hover:bg-gray-50 rounded-xl transition disabled:opacity-50"
                            >
                                {actionLoading === 'mute' ? (
                                    <Loader2 size={16} className="text-gray-400 animate-spin" />
                                ) : muted ? (
                                    <BellOff size={16} className="text-gray-400" />
                                ) : (
                                    <Bell size={16} className="text-gray-400" />
                                )}
                                {muted ? 'Bật thông báo' : 'Tắt thông báo'}
                            </button>

                            {/* Block */}
                            <button
                                onClick={handleToggleBlock}
                                disabled={actionLoading === 'block'}
                                className={`w-full flex items-center gap-3 px-3 py-2.5 text-sm rounded-xl transition disabled:opacity-50 ${blocked ? 'text-red-600 hover:bg-red-50' : 'text-gray-700 hover:bg-gray-50'}`}
                            >
                                {actionLoading === 'block' ? (
                                    <Loader2 size={16} className="text-gray-400 animate-spin" />
                                ) : (
                                    <Ban size={16} className={blocked ? 'text-red-400' : 'text-gray-400'} />
                                )}
                                {blocked ? 'Bỏ chặn' : 'Chặn'}
                            </button>

                            {/* Report */}
                            <button
                                onClick={() => setShowReport(true)}
                                className="w-full flex items-center gap-3 px-3 py-2.5 text-sm text-red-600 hover:bg-red-50 rounded-xl transition"
                            >
                                <Flag size={16} className="text-red-400" />
                                Báo cáo
                            </button>
                        </div>
                    )}

                    {/* ─── Group chat sections ─── */}
                    {isGroup && (
                        <>
                            {/* Group actions */}
                            <div className="px-2 py-3 border-b border-gray-100 space-y-0.5">
                                {/* View group profile */}
                                <button
                                    onClick={() => navigate(`/group/${room._id}`)}
                                    className="w-full flex items-center gap-3 px-3 py-2.5 text-sm text-gray-700 hover:bg-gray-50 rounded-xl transition"
                                >
                                    <Eye size={16} className="text-gray-400" />
                                    Xem chi tiết nhóm
                                </button>

                                {/* Add member */}
                                <button
                                    onClick={() => setShowAddMember(true)}
                                    className="w-full flex items-center gap-3 px-3 py-2.5 text-sm text-gray-700 hover:bg-gray-50 rounded-xl transition"
                                >
                                    <UserPlus size={16} className="text-gray-400" />
                                    Thêm thành viên
                                </button>

                                {/* Set nickname for self */}
                                <button
                                    onClick={() => setNicknameTarget(myMember)}
                                    className="w-full flex items-center gap-3 px-3 py-2.5 text-sm text-gray-700 hover:bg-gray-50 rounded-xl transition"
                                >
                                    <Edit3 size={16} className="text-gray-400" />
                                    Đặt biệt danh
                                </button>

                                {/* Mute */}
                                <button
                                    onClick={handleToggleMute}
                                    disabled={actionLoading === 'mute'}
                                    className="w-full flex items-center gap-3 px-3 py-2.5 text-sm text-gray-700 hover:bg-gray-50 rounded-xl transition disabled:opacity-50"
                                >
                                    {actionLoading === 'mute' ? (
                                        <Loader2 size={16} className="text-gray-400 animate-spin" />
                                    ) : muted ? (
                                        <BellOff size={16} className="text-gray-400" />
                                    ) : (
                                        <Bell size={16} className="text-gray-400" />
                                    )}
                                    {muted ? 'Bật thông báo' : 'Tắt thông báo'}
                                </button>

                                {/* Leave group */}
                                <button
                                    onClick={handleLeave}
                                    disabled={actionLoading === 'leave'}
                                    className="w-full flex items-center gap-3 px-3 py-2.5 text-sm text-red-600 hover:bg-red-50 rounded-xl transition disabled:opacity-50"
                                >
                                    {actionLoading === 'leave' ? (
                                        <Loader2 size={16} className="text-red-400 animate-spin" />
                                    ) : (
                                        <LogOut size={16} className="text-red-400" />
                                    )}
                                    Rời nhóm
                                </button>
                            </div>

                            {/* ─── Members section ─── */}
                            <div className="px-2 py-3 border-b border-gray-100">
                                <button
                                    onClick={() => setShowMembers(!showMembers)}
                                    className="w-full flex items-center justify-between px-3 py-2 text-sm font-semibold text-gray-700"
                                >
                                    <span className="flex items-center gap-2">
                                        <Users size={16} />
                                        Thành viên ({room.members?.length || 0})
                                    </span>
                                    {showMembers ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                                </button>
                                {showMembers && (
                                    <MemberList
                                        members={room.members || []}
                                        nicknames={room.nicknames}
                                        isAdmin={isAdmin}
                                        onSetNickname={(member) => setNicknameTarget(member)}
                                        onRemoveMember={handleRemoveMember}
                                    />
                                )}
                            </div>

                            {/* ─── Pending members (admin only) ─── */}
                            {isAdmin && (
                                <div className="px-2 py-3 border-b border-gray-100">
                                    <button
                                        onClick={() => setShowPending(!showPending)}
                                        className="w-full flex items-center justify-between px-3 py-2 text-sm font-semibold text-gray-700"
                                    >
                                        <span className="flex items-center gap-2">
                                            <Shield size={16} />
                                            Chờ duyệt ({pendingMembers.length})
                                        </span>
                                        {showPending ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                                    </button>
                                    {showPending && (
                                        <div className="px-1 mt-1">
                                            <PendingMembers
                                                roomId={room._id}
                                                pendingMembers={pendingMembers}
                                                onApproved={handlePendingApproved}
                                                onRejected={handlePendingRejected}
                                            />
                                        </div>
                                    )}
                                </div>
                            )}
                        </>
                    )}
                </div>
            </div>

            {/* ─── Modals ─── */}
            {nicknameTarget && (
                <NicknameModal
                    roomId={room._id}
                    targetUser={nicknameTarget.user || nicknameTarget}
                    currentNickname={
                        room.nicknames?.get?.(nicknameTarget.user?._id || nicknameTarget._id) ||
                        room.nicknames?.[nicknameTarget.user?._id || nicknameTarget._id] || ''
                    }
                    onClose={() => setNicknameTarget(null)}
                    onSaved={handleNicknameSaved}
                />
            )}

            {showReport && (
                <ReportModal
                    reportedUserId={otherUser?._id}
                    roomId={room._id}
                    onClose={() => setShowReport(false)}
                />
            )}

            {showAddMember && (
                <AddMemberModal
                    roomId={room._id}
                    existingMemberIds={existingMemberIds}
                    onClose={() => setShowAddMember(false)}
                    onAdded={(updatedRoom) => {
                        if (updatedRoom) {
                            onRoomUpdate?.(updatedRoom);
                        }
                        setShowAddMember(false);
                    }}
                />
            )}
        </>
    );
}
