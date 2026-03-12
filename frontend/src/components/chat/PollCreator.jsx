import { useState } from 'react';
import { X, Plus, Trash2 } from 'lucide-react';

export default function PollCreator({ onSend, onClose }) {
    const [question, setQuestion] = useState('');
    const [options, setOptions] = useState(['', '']);

    const addOption = () => {
        if (options.length < 10) setOptions([...options, '']);
    };

    const removeOption = (idx) => {
        if (options.length > 2) setOptions(options.filter((_, i) => i !== idx));
    };

    const handleSubmit = () => {
        const trimmedQ = question.trim();
        const trimmedOpts = options.map(o => o.trim()).filter(Boolean);
        if (!trimmedQ || trimmedOpts.length < 2) return;
        onSend({ question: trimmedQ, options: trimmedOpts });
        onClose();
    };

    return (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={onClose}>
            <div className="bg-white rounded-2xl w-full max-w-sm p-6 space-y-4" onClick={e => e.stopPropagation()}>
                <div className="flex items-center justify-between">
                    <h3 className="text-lg font-bold text-gray-800">📊 Tạo bình chọn</h3>
                    <button onClick={onClose} className="p-1 hover:bg-gray-100 rounded-lg"><X size={20} /></button>
                </div>

                <div>
                    <label className="block text-sm font-medium text-gray-600 mb-1">Câu hỏi</label>
                    <input type="text" value={question} onChange={e => setQuestion(e.target.value)}
                        placeholder="Nhập câu hỏi..." maxLength={200}
                        className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-sm" />
                </div>

                <div className="space-y-2">
                    <label className="block text-sm font-medium text-gray-600">Lựa chọn</label>
                    {options.map((opt, idx) => (
                        <div key={idx} className="flex items-center gap-2">
                            <input type="text" value={opt} onChange={e => {
                                const next = [...options]; next[idx] = e.target.value; setOptions(next);
                            }}
                                placeholder={`Lựa chọn ${idx + 1}`} maxLength={100}
                                className="flex-1 px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-sm" />
                            {options.length > 2 && (
                                <button onClick={() => removeOption(idx)} className="p-1.5 text-red-400 hover:text-red-600 hover:bg-red-50 rounded-lg">
                                    <Trash2 size={16} />
                                </button>
                            )}
                        </div>
                    ))}
                    {options.length < 10 && (
                        <button onClick={addOption} className="flex items-center gap-1 text-sm text-blue-600 hover:text-blue-700 px-1">
                            <Plus size={14} /> Thêm lựa chọn
                        </button>
                    )}
                </div>

                <div className="flex gap-3 pt-2">
                    <button onClick={onClose} className="flex-1 py-2 border border-gray-300 rounded-lg text-gray-600 hover:bg-gray-50">Hủy</button>
                    <button onClick={handleSubmit}
                        disabled={!question.trim() || options.filter(o => o.trim()).length < 2}
                        className="flex-1 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50">
                        Tạo bình chọn
                    </button>
                </div>
            </div>
        </div>
    );
}
