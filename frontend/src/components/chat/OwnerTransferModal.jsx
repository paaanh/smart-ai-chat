import { useState } from 'react';
import { X, Loader2, Crown } from 'lucide-react';
import { resolveMediaUrl } from '../../services/api';

export default function OwnerTransferModal({ members, currentUserId, onClose, onTransfer }) {
    const [selected, setSelected] = useState(null);
    const [loading, setLoading] = useState(false);

    const otherMembers = members.filter(m => {
        const id = m.user?._id || m.user;
        return id !== currentUserId;
    });

    const handleTransfer = async () => {
        if (!selected) return;
        setLoading(true);
        try {
            await onTransfer(selected);
            onClose();
        } catch {
            setLoading(false);
        }
    };

    return (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={onClose}>
            <div className="bg-white rounded-2xl w-full max-w-sm p-6 space-y-4" onClick={e => e.stopPropagation()}>
                <div className="flex items-center justify-between">
                    <h3 className="text-lg font-bold text-gray-800 flex items-center gap-2">
                        <Crown size={20} className="text-yellow-500" /> Chuyển quyền nhóm trưởng
                    </h3>
                    <button onClick={onClose} className="p-1 hover:bg-gray-100 rounded-lg"><X size={20} /></button>
                </div>

                <p className="text-sm text-gray-500">Chọn thành viên sẽ trở thành nhóm trưởng mới trước khi bạn rời nhóm:</p>

                <div className="space-y-1 max-h-60 overflow-y-auto">
                    {otherMembers.map(m => {
                        const u = m.user;
                        const id = u?._id || u;
                        const name = u?.username || 'Unknown';
                        const avatar = u?.avatar || u?.googlePicture;
                        return (
                            <button key={id} onClick={() => setSelected(id)}
                                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg transition text-left ${selected === id ? 'bg-blue-50 border border-blue-300' : 'hover:bg-gray-50 border border-transparent'}`}>
                                <div className="w-9 h-9 rounded-full bg-blue-500 flex items-center justify-center text-white font-bold overflow-hidden shrink-0">
                                    {avatar ? <img src={resolveMediaUrl(avatar)} alt="" className="w-full h-full object-cover" /> : name.charAt(0).toUpperCase()}
                                </div>
                                <span className="font-medium text-gray-800 text-sm">{name}</span>
                                {selected === id && <Crown size={16} className="text-yellow-500 ml-auto" />}
                            </button>
                        );
                    })}
                </div>

                <div className="flex gap-3 pt-2">
                    <button onClick={onClose} className="flex-1 py-2 border border-gray-300 rounded-lg text-gray-600 hover:bg-gray-50">Hủy</button>
                    <button onClick={handleTransfer} disabled={!selected || loading}
                        className="flex-1 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 flex items-center justify-center gap-2">
                        {loading && <Loader2 size={16} className="animate-spin" />} Xác nhận & Rời nhóm
                    </button>
                </div>
            </div>
        </div>
    );
}
