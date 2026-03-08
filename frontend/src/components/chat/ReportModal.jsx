import { useState } from 'react';
import { X, Loader2, AlertTriangle } from 'lucide-react';
import { userActionsAPI } from '../../services/api';

const REASONS = [
    { value: 'spam', label: 'Spam' },
    { value: 'harassment', label: 'Quấy rối' },
    { value: 'hate_speech', label: 'Ngôn ngữ thù ghét' },
    { value: 'violence', label: 'Bạo lực' },
    { value: 'inappropriate_content', label: 'Nội dung không phù hợp' },
    { value: 'impersonation', label: 'Mạo danh' },
    { value: 'other', label: 'Khác' },
];

export default function ReportModal({ reportedUserId, roomId, onClose }) {
    const [reason, setReason] = useState('');
    const [description, setDescription] = useState('');
    const [sending, setSending] = useState(false);
    const [sent, setSent] = useState(false);

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!reason) return;
        setSending(true);
        try {
            await userActionsAPI.report({ reportedUserId, roomId, reason, description: description.trim() });
            setSent(true);
        } catch (err) {
            console.error('Report error:', err);
        } finally {
            setSending(false);
        }
    };

    if (sent) {
        return (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={onClose}>
                <div className="bg-white rounded-2xl w-full max-w-sm mx-4 shadow-xl p-6 text-center" onClick={(e) => e.stopPropagation()}>
                    <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-3">
                        <span className="text-green-600 text-xl">✓</span>
                    </div>
                    <p className="font-semibold text-gray-900 mb-1">Đã gửi báo cáo</p>
                    <p className="text-sm text-gray-500 mb-4">Cảm ơn bạn đã báo cáo. Chúng tôi sẽ xem xét.</p>
                    <button onClick={onClose} className="px-6 py-2 bg-[var(--color-primary)] text-white rounded-xl text-sm font-medium hover:bg-[var(--color-primary-hover)] transition">
                        Đóng
                    </button>
                </div>
            </div>
        );
    }

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={onClose}>
            <div className="bg-white rounded-2xl w-full max-w-sm mx-4 shadow-xl" onClick={(e) => e.stopPropagation()}>
                <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
                    <div className="flex items-center gap-2">
                        <AlertTriangle size={18} className="text-red-500" />
                        <h3 className="font-semibold text-gray-900">Báo cáo người dùng</h3>
                    </div>
                    <button onClick={onClose} className="p-1 hover:bg-gray-100 rounded-full transition">
                        <X size={18} />
                    </button>
                </div>

                <form onSubmit={handleSubmit} className="p-5 space-y-4">
                    <div>
                        <label className="text-sm font-medium text-gray-700 block mb-2">Lý do báo cáo</label>
                        <div className="space-y-2">
                            {REASONS.map((r) => (
                                <label key={r.value} className="flex items-center gap-2 cursor-pointer">
                                    <input
                                        type="radio"
                                        name="reason"
                                        value={r.value}
                                        checked={reason === r.value}
                                        onChange={() => setReason(r.value)}
                                        className="accent-blue-600"
                                    />
                                    <span className="text-sm text-gray-700">{r.label}</span>
                                </label>
                            ))}
                        </div>
                    </div>

                    <div>
                        <label className="text-sm font-medium text-gray-700 block mb-1">Mô tả thêm (tuỳ chọn)</label>
                        <textarea
                            value={description}
                            onChange={(e) => setDescription(e.target.value)}
                            placeholder="Mô tả chi tiết vấn đề..."
                            rows={3}
                            maxLength={500}
                            className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-primary-ring)] focus:border-transparent resize-none"
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
                            disabled={!reason || sending}
                            className="flex-1 py-2.5 text-sm font-medium text-white bg-red-600 hover:bg-red-700 rounded-xl transition disabled:opacity-50 flex items-center justify-center gap-2"
                        >
                            {sending && <Loader2 size={14} className="animate-spin" />}
                            Gửi báo cáo
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}
