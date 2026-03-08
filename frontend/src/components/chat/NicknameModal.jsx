import { useState } from 'react';
import { X, Loader2 } from 'lucide-react';
import { roomAPI } from '../../services/api';

export default function NicknameModal({ roomId, targetUser, currentNickname, onClose, onSaved }) {
    const [nickname, setNickname] = useState(currentNickname || '');
    const [saving, setSaving] = useState(false);

    const handleSubmit = async (e) => {
        e.preventDefault();
        setSaving(true);
        try {
            await roomAPI.setNickname(roomId, targetUser._id, nickname.trim());
            onSaved?.(targetUser._id, nickname.trim());
            onClose();
        } catch (err) {
            console.error('Set nickname error:', err);
        } finally {
            setSaving(false);
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={onClose}>
            <div className="bg-white rounded-2xl w-full max-w-sm mx-4 shadow-xl" onClick={(e) => e.stopPropagation()}>
                <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
                    <h3 className="font-semibold text-gray-900">Đặt biệt danh</h3>
                    <button onClick={onClose} className="p-1 hover:bg-gray-100 rounded-full transition">
                        <X size={18} />
                    </button>
                </div>

                <form onSubmit={handleSubmit} className="p-5 space-y-4">
                    <div>
                        <label className="text-sm text-gray-600 block mb-1">
                            Biệt danh cho <span className="font-medium text-gray-900">{targetUser.username}</span>
                        </label>
                        <input
                            type="text"
                            value={nickname}
                            onChange={(e) => setNickname(e.target.value)}
                            placeholder="Nhập biệt danh..."
                            className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-primary-ring)] focus:border-transparent"
                            maxLength={50}
                            autoFocus
                        />
                    </div>

                    <div className="flex gap-3">
                        <button
                            type="button"
                            onClick={onClose}
                            className="flex-1 py-2.5 text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-xl transition"
                        >
                            Huỷ
                        </button>
                        <button
                            type="submit"
                            disabled={saving}
                            className="flex-1 py-2.5 text-sm font-medium text-white bg-[var(--color-primary)] hover:bg-[var(--color-primary-hover)] rounded-xl transition disabled:opacity-50 flex items-center justify-center gap-2"
                        >
                            {saving && <Loader2 size={14} className="animate-spin" />}
                            Lưu
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}
