import { useState, useRef } from 'react';
import { Send, Paperclip, Smile, X, Loader2 } from 'lucide-react';
import { uploadAPI } from '../../services/api';

export default function MessageInput({ onSend, onTyping, disabled }) {
    const [text, setText] = useState('');
    const [file, setFile] = useState(null);
    const [uploading, setUploading] = useState(false);
    const fileInputRef = useRef(null);
    const inputRef = useRef(null);

    const handleSubmit = async (e) => {
        e.preventDefault();
        const trimmed = text.trim();
        if (!trimmed && !file) return;

        if (file) {
            setUploading(true);
            try {
                const formData = new FormData();
                formData.append('file', file);
                const { data } = await uploadAPI.uploadFile(formData);
                const fileData = data.file;
                const type = fileData.mimeType?.startsWith('image/')
                    ? 'image'
                    : fileData.mimeType?.startsWith('video/')
                        ? 'video'
                        : 'file';
                onSend(trimmed || fileData.name, type, fileData);
            } catch (err) {
                console.error('Upload error:', err);
            } finally {
                setUploading(false);
                setFile(null);
            }
        } else {
            onSend(trimmed, 'text');
        }

        setText('');
        inputRef.current?.focus();
    };

    const handleKeyDown = (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleSubmit(e);
        }
    };

    const handleChange = (e) => {
        setText(e.target.value);
        onTyping?.();
    };

    const handleFileSelect = (e) => {
        const f = e.target.files?.[0];
        if (f) {
            if (f.size > 50 * 1024 * 1024) {
                alert('File tối đa 50MB');
                return;
            }
            setFile(f);
        }
    };

    return (
        <div className="border-t border-gray-200 bg-white p-3">
            {/* File preview */}
            {file && (
                <div className="flex items-center gap-2 mb-2 bg-gray-50 px-3 py-2 rounded-lg">
                    <Paperclip size={14} className="text-gray-500" />
                    <span className="text-sm text-gray-700 truncate flex-1">{file.name}</span>
                    <span className="text-xs text-gray-400">{(file.size / 1024 / 1024).toFixed(1)} MB</span>
                    <button onClick={() => setFile(null)} className="text-gray-400 hover:text-red-500">
                        <X size={16} />
                    </button>
                </div>
            )}

            <form onSubmit={handleSubmit} className="flex items-end gap-2">
                {/* File button */}
                <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="p-2 text-gray-400 hover:text-blue-500 hover:bg-gray-100 rounded-full transition shrink-0"
                    disabled={disabled}
                >
                    <Paperclip size={20} />
                </button>
                <input
                    ref={fileInputRef}
                    type="file"
                    className="hidden"
                    onChange={handleFileSelect}
                    accept="image/*,video/*,audio/*,.pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.zip,.rar"
                />

                {/* Text input */}
                <div className="flex-1 relative">
                    <textarea
                        ref={inputRef}
                        value={text}
                        onChange={handleChange}
                        onKeyDown={handleKeyDown}
                        placeholder="Nhập tin nhắn..."
                        disabled={disabled}
                        rows={1}
                        className="w-full resize-none px-4 py-2.5 bg-gray-100 rounded-2xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 transition max-h-32 disabled:opacity-50"
                        style={{ minHeight: '42px' }}
                    />
                </div>

                {/* Send button */}
                <button
                    type="submit"
                    disabled={disabled || uploading || (!text.trim() && !file)}
                    className="p-2.5 bg-blue-600 text-white rounded-full hover:bg-blue-700 transition disabled:opacity-50 disabled:hover:bg-blue-600 shrink-0"
                >
                    {uploading ? (
                        <Loader2 size={18} className="animate-spin" />
                    ) : (
                        <Send size={18} />
                    )}
                </button>
            </form>
        </div>
    );
}
