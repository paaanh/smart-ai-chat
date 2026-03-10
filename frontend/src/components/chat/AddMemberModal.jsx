import { useState, useEffect } from 'react';
import { X, Search, Loader2, UserPlus, Check } from 'lucide-react';
import { friendAPI, roomAPI } from '../../services/api';

export default function AddMemberModal({ roomId, existingMemberIds, onClose, onAdded }) {
    const [friends, setFriends] = useState([]);
    const [search, setSearch] = useState('');
    const [loading, setLoading] = useState(true);
    const [addingId, setAddingId] = useState(null);
    const [addedIds, setAddedIds] = useState(new Set());

    useEffect(() => {
        const loadFriends = async () => {
            try {
                const { data } = await friendAPI.getAll();
                setFriends(data.friends || []);
            } catch (err) {
                console.error('Load friends error:', err);
            } finally {
                setLoading(false);
            }
        };
        loadFriends();
    }, []);

    const handleAdd = async (userId) => {
        console.log('Adding member:', userId);
        setAddingId(userId);
        try {
            const { data } = await roomAPI.addMember(roomId, userId);
            setAddedIds((prev) => new Set(prev).add(userId));
            onAdded?.(data.room);
        } catch (err) {
            console.error('Add member error:', err);
        } finally {
            setAddingId(null);
        }
    };

    // Filter: not already member, matches search
    const filtered = friends.filter((f) => {
        const friendUser = f.requester || f.recipient || f;
        const fId = friendUser._id;
        if (existingMemberIds.includes(fId)) return false;
        if (addedIds.has(fId)) return false;
        if (search && !friendUser.username?.toLowerCase().includes(search.toLowerCase())) return false;
        return true;
    });

    const getFriendUser = (f) => f.requester || f.recipient || f;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={onClose}>
            <div className="bg-white rounded-2xl w-full max-w-sm mx-4 shadow-xl max-h-[80vh] flex flex-col" onClick={(e) => e.stopPropagation()}>
                <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
                    <h3 className="font-semibold text-gray-900">Thêm thành viên</h3>
                    <button onClick={onClose} className="p-1 hover:bg-gray-100 rounded-full transition">
                        <X size={18} />
                    </button>
                </div>

                {/* Search */}
                <div className="px-5 py-3">
                    <div className="relative">
                        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                        <input
                            type="text"
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            placeholder="Tìm bạn bè..."
                            className="w-full pl-9 pr-4 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-primary-ring)] focus:border-transparent"
                            autoFocus
                        />
                    </div>
                </div>

                {/* Friend list */}
                <div className="flex-1 overflow-y-auto px-5 pb-4 space-y-1">
                    {loading ? (
                        <div className="flex justify-center py-8">
                            <Loader2 size={24} className="animate-spin text-[var(--color-primary)]" />
                        </div>
                    ) : filtered.length === 0 ? (
                        <p className="text-center text-sm text-gray-400 py-8">
                            {search ? 'Không tìm thấy' : 'Không có bạn bè để thêm'}
                        </p>
                    ) : (
                        filtered.map((f) => {
                            const u = getFriendUser(f);
                            const initial = u.username?.charAt(0).toUpperCase() || '?';
                            return (
                                <div key={u._id} className="flex items-center gap-3 py-2 px-2 rounded-xl hover:bg-gray-50">
                                    <div className="w-9 h-9 rounded-full bg-[var(--color-primary)] flex items-center justify-center text-white text-sm font-semibold overflow-hidden shrink-0">
                                        {u.avatar ? (
                                            <img src={u.avatar} alt={u.username} className="w-full h-full object-cover" />
                                        ) : (
                                            initial
                                        )}
                                    </div>
                                    <span className="flex-1 text-sm font-medium text-gray-900 truncate">{u.username}</span>
                                    <button
                                        onClick={() => handleAdd(u._id)}
                                        disabled={addingId === u._id}
                                        className="p-1.5 bg-[var(--color-primary-medium)] hover:bg-[var(--color-primary-medium)] text-[var(--color-primary)] rounded-lg transition disabled:opacity-50"
                                        title="Thêm"
                                    >
                                        {addingId === u._id ? (
                                            <Loader2 size={14} className="animate-spin" />
                                        ) : (
                                            <UserPlus size={14} />
                                        )}
                                    </button>
                                </div>
                            );
                        })
                    )}
                </div>
            </div>
        </div>
    );
}
