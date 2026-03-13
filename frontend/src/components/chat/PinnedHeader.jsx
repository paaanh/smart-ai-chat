import { useState, useRef, useEffect } from 'react';
import { Pin, ChevronDown, X } from 'lucide-react';

export default function PinnedHeader({ pinnedMessages, onScrollToMessage, onUnpin }) {
    const [showDropdown, setShowDropdown] = useState(false);
    const dropdownRef = useRef(null);

    // Close dropdown on outside click
    useEffect(() => {
        if (!showDropdown) return;
        const handleClick = (e) => {
            if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
                setShowDropdown(false);
            }
        };
        document.addEventListener('mousedown', handleClick);
        return () => document.removeEventListener('mousedown', handleClick);
    }, [showDropdown]);

    if (!pinnedMessages || pinnedMessages.length === 0) return null;

    // Sort by pinnedAt descending — most recent first
    const sorted = [...pinnedMessages].sort(
        (a, b) => new Date(b.pinnedAt || b.createdAt) - new Date(a.pinnedAt || a.createdAt)
    );
    const latest = sorted[0];

    const getSnippet = (msg) => {
        if (!msg) return '';
        if (msg.type === 'image') return '🖼️ Hình ảnh';
        if (msg.type === 'video') return '🎬 Video';
        if (msg.type === 'file') return '📎 Tệp đính kèm';
        if (msg.type === 'location') return '📍 Vị trí';
        if (msg.type === 'poll') return '📊 Bình chọn';
        if (msg.type === 'contact-card') return '👤 Danh thiếp';
        return msg.content?.length > 50 ? msg.content.slice(0, 50) + '…' : (msg.content || '');
    };

    return (
        <div className="relative border-b border-gray-200 bg-amber-50/60">
            <div className="flex items-center gap-2 px-4 py-2">
                {/* Pin icon */}
                <Pin size={14} className="text-amber-600 shrink-0" />

                {/* Latest pinned message — clickable to scroll */}
                <button
                    className="flex-1 min-w-0 text-left"
                    onClick={() => onScrollToMessage?.(latest._id)}
                >
                    <p className="text-xs font-medium text-amber-800 truncate">
                        {latest.sender?.username || 'Unknown'}
                    </p>
                    <p className="text-xs text-gray-600 truncate">{getSnippet(latest)}</p>
                </button>

                {/* "+N ghim" button with dropdown arrow */}
                <button
                    onClick={() => setShowDropdown((v) => !v)}
                    className="flex items-center gap-1 text-xs font-medium text-amber-700 hover:text-amber-900 bg-amber-100 hover:bg-amber-200 px-2 py-1 rounded-lg transition shrink-0"
                >
                    {pinnedMessages.length} ghim
                    <ChevronDown size={12} className={`transition-transform ${showDropdown ? 'rotate-180' : ''}`} />
                </button>
            </div>

            {/* Dropdown: all pinned messages */}
            {showDropdown && (
                <div
                    ref={dropdownRef}
                    className="absolute top-full right-2 z-50 w-80 max-h-64 overflow-y-auto bg-white border border-gray-200 rounded-xl shadow-lg mt-1"
                >
                    <div className="px-3 py-2 border-b border-gray-100">
                        <p className="text-xs font-semibold text-gray-700">Tin nhắn đã ghim ({pinnedMessages.length})</p>
                    </div>
                    {sorted.map((msg) => (
                        <div
                            key={msg._id}
                            className="flex items-center gap-2 px-3 py-2 hover:bg-gray-50 transition"
                        >
                            <button
                                className="flex-1 min-w-0 text-left"
                                onClick={() => {
                                    onScrollToMessage?.(msg._id);
                                    setShowDropdown(false);
                                }}
                            >
                                <p className="text-xs font-medium text-gray-800 truncate">
                                    {msg.sender?.username || 'Unknown'}
                                </p>
                                <p className="text-xs text-gray-500 truncate">{getSnippet(msg)}</p>
                            </button>
                            {onUnpin && (
                                <button
                                    onClick={() => onUnpin(msg)}
                                    className="p-1 text-gray-400 hover:text-red-500 transition shrink-0"
                                    title="Bỏ ghim"
                                >
                                    <X size={14} />
                                </button>
                            )}
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}
