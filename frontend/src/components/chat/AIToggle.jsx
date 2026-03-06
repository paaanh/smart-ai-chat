import { Bot, Sparkles } from 'lucide-react';

export default function AIToggle({ enabled, onToggle, onSummarize }) {
    return (
        <div className="flex items-center gap-2">
            {/* Summarize button */}
            {enabled && (
                <button
                    onClick={onSummarize}
                    className="flex items-center gap-1 px-2.5 py-1 text-xs bg-purple-50 text-purple-600 hover:bg-purple-100 rounded-full transition"
                    title="Tóm tắt cuộc trò chuyện"
                >
                    <Sparkles size={12} />
                    <span className="hidden sm:inline">Tóm tắt</span>
                </button>
            )}

            {/* Toggle */}
            <button
                onClick={() => onToggle(!enabled)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition ${enabled
                        ? 'bg-purple-100 text-purple-700 hover:bg-purple-200'
                        : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
                    }`}
                title={enabled ? 'Tắt AI Bot' : 'Bật AI Bot'}
            >
                <Bot size={14} />
                <span className="hidden sm:inline">AI Bot</span>
                <div
                    className={`w-8 h-4 rounded-full relative transition-colors ${enabled ? 'bg-purple-500' : 'bg-gray-300'
                        }`}
                >
                    <div
                        className={`absolute top-0.5 w-3 h-3 rounded-full bg-white transition-transform ${enabled ? 'translate-x-4' : 'translate-x-0.5'
                            }`}
                    />
                </div>
            </button>
        </div>
    );
}
