import { useState } from 'react';
import { roomAPI } from '../../services/api';
import { Check, X, Loader2, Clock } from 'lucide-react';

export default function PendingMembers({ roomId, pendingMembers, onApproved, onRejected }) {
    const [loadingId, setLoadingId] = useState(null);

    const handleApprove = async (userId) => {
        setLoadingId(userId);
        try {
            await roomAPI.approveMember(roomId, userId);
            onApproved?.(userId);
        } catch (err) {
            console.error('Approve error:', err);
        } finally {
            setLoadingId(null);
        }
    };

    const handleReject = async (userId) => {
        setLoadingId(userId);
        try {
            await roomAPI.rejectMember(roomId, userId);
            onRejected?.(userId);
        } catch (err) {
            console.error('Reject error:', err);
        } finally {
            setLoadingId(null);
        }
    };

    if (!pendingMembers?.length) {
        return (
            <div className="text-center py-4 text-sm text-gray-400">
                Không có yêu cầu tham gia nào
            </div>
        );
    }

    return (
        <div className="space-y-2">
            {pendingMembers.map((member) => {
                const u = member.user || member;
                const userId = u._id || u;
                const username = u.username || 'Unknown';
                const initial = username.charAt(0).toUpperCase();
                const isLoading = loadingId === userId;

                return (
                    <div key={userId} className="flex items-center gap-3 px-3 py-2 rounded-xl bg-yellow-50 border border-yellow-100">
                        <div className="w-8 h-8 rounded-full bg-yellow-500 flex items-center justify-center text-white text-sm font-semibold overflow-hidden shrink-0">
                            {u.avatar ? (
                                <img src={u.avatar} alt={username} className="w-full h-full object-cover" />
                            ) : (
                                initial
                            )}
                        </div>

                        <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-gray-900 truncate">{username}</p>
                            <p className="text-xs text-yellow-600 flex items-center gap-1">
                                <Clock size={10} />
                                Đang chờ duyệt
                            </p>
                        </div>

                        <div className="flex gap-1.5">
                            <button
                                onClick={() => handleApprove(userId)}
                                disabled={isLoading}
                                className="p-1.5 bg-green-100 hover:bg-green-200 text-green-600 rounded-lg transition disabled:opacity-50"
                                title="Chấp nhận"
                            >
                                {isLoading ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}
                            </button>
                            <button
                                onClick={() => handleReject(userId)}
                                disabled={isLoading}
                                className="p-1.5 bg-red-100 hover:bg-red-200 text-red-600 rounded-lg transition disabled:opacity-50"
                                title="Từ chối"
                            >
                                <X size={14} />
                            </button>
                        </div>
                    </div>
                );
            })}
        </div>
    );
}
