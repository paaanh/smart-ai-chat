import { useAuth } from '../../hooks/useAuth';
import { useSocket } from '../../hooks/useSocket';
import { Shield, Crown, MoreVertical, UserMinus, Edit3 } from 'lucide-react';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';

export default function MemberList({ members, nicknames, isAdmin, onSetNickname, onRemoveMember }) {
    const { user } = useAuth();
    const { onlineUsers } = useSocket();
    const navigate = useNavigate();
    const [menuOpen, setMenuOpen] = useState(null);

    const getMemberDisplay = (member) => {
        const u = member.user;
        const userId = u?._id || u;
        const nick = nicknames?.get?.(userId) || nicknames?.[userId];
        return {
            id: userId,
            name: nick || u?.username || 'Unknown',
            originalName: u?.username || 'Unknown',
            hasNickname: !!nick,
            avatar: u?.avatar,
            role: member.role,
            isOnline: onlineUsers.includes(userId),
            isSelf: userId === user?._id,
        };
    };

    // Sort: admin first, then online, then alphabetical
    const sorted = [...members].sort((a, b) => {
        if (a.role === 'admin' && b.role !== 'admin') return -1;
        if (b.role === 'admin' && a.role !== 'admin') return 1;
        const aOnline = onlineUsers.includes(a.user?._id || a.user);
        const bOnline = onlineUsers.includes(b.user?._id || b.user);
        if (aOnline && !bOnline) return -1;
        if (bOnline && !aOnline) return 1;
        return 0;
    });

    return (
        <div className="space-y-1">
            {sorted.map((member) => {
                const m = getMemberDisplay(member);
                const initial = m.originalName.charAt(0).toUpperCase();

                return (
                    <div key={m.id} className="flex items-center gap-3 px-3 py-2 rounded-xl hover:bg-gray-50 transition group relative">
                        {/* Avatar */}
                        <div
                            className="relative cursor-pointer shrink-0"
                            onClick={() => navigate(`/profile/${m.id}`)}
                        >
                            <div className="w-9 h-9 rounded-full bg-[var(--color-primary)] flex items-center justify-center text-white text-sm font-semibold overflow-hidden">
                                {m.avatar ? (
                                    <img src={m.avatar} alt={m.originalName} className="w-full h-full object-cover" />
                                ) : (
                                    initial
                                )}
                            </div>
                            {m.isOnline && (
                                <div className="absolute bottom-0 right-0 w-2.5 h-2.5 bg-green-500 border-2 border-white rounded-full" />
                            )}
                        </div>

                        {/* Info */}
                        <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-1.5">
                                <span className="text-sm font-medium text-gray-900 truncate">{m.name}</span>
                                {m.hasNickname && (
                                    <span className="text-xs text-gray-400 truncate">({m.originalName})</span>
                                )}
                                {m.role === 'admin' && (
                                    <Crown size={12} className="text-yellow-500 shrink-0" />
                                )}
                                {m.isSelf && (
                                    <span className="text-xs text-gray-400">(Bạn)</span>
                                )}
                            </div>
                            <p className={`text-xs ${m.isOnline ? 'text-green-500' : 'text-gray-400'}`}>
                                {m.isOnline ? 'Đang hoạt động' : 'Offline'}
                            </p>
                        </div>

                        {/* Actions */}
                        {!m.isSelf && (
                            <div className="relative">
                                <button
                                    onClick={() => setMenuOpen(menuOpen === m.id ? null : m.id)}
                                    className="p-1 hover:bg-gray-200 rounded-full transition opacity-0 group-hover:opacity-100"
                                >
                                    <MoreVertical size={14} className="text-gray-400" />
                                </button>

                                {menuOpen === m.id && (
                                    <>
                                        <div className="fixed inset-0 z-10" onClick={() => setMenuOpen(null)} />
                                        <div className="absolute right-0 top-8 z-20 bg-white border border-gray-200 rounded-xl shadow-lg py-1 w-44">
                                            <button
                                                onClick={() => { setMenuOpen(null); onSetNickname?.(member); }}
                                                className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 flex items-center gap-2"
                                            >
                                                <Edit3 size={14} />
                                                Đặt biệt danh
                                            </button>
                                            {isAdmin && m.role !== 'admin' && (
                                                <button
                                                    onClick={() => { setMenuOpen(null); onRemoveMember?.(m.id); }}
                                                    className="w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-red-50 flex items-center gap-2"
                                                >
                                                    <UserMinus size={14} />
                                                    Xoá khỏi nhóm
                                                </button>
                                            )}
                                        </div>
                                    </>
                                )}
                            </div>
                        )}
                    </div>
                );
            })}
        </div>
    );
}
