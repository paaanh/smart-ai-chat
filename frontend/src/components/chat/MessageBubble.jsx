import { useAuth } from '../../hooks/useAuth';
import { format } from 'date-fns';
import { Bot, Trash2, Globe, ChevronDown, ChevronUp } from 'lucide-react';
import { useState } from 'react';

export default function MessageBubble({ message, isOwn, onDelete }) {
    const { user } = useAuth();
    const [showTranslation, setShowTranslation] = useState(true);
    const [showActions, setShowActions] = useState(false);

    if (message.deleted) {
        return (
            <div className={`flex ${isOwn ? 'justify-end' : 'justify-start'} mb-2`}>
                <div className="bg-gray-100 text-gray-400 italic px-4 py-2 rounded-2xl text-sm">
                    Tin nhắn đã bị xóa
                </div>
            </div>
        );
    }

    // System message
    if (message.type === 'system') {
        return (
            <div className="flex justify-center mb-2">
                <div className="bg-gray-100 text-gray-500 text-xs px-4 py-1.5 rounded-full">
                    {message.content}
                </div>
            </div>
        );
    }

    // AI response
    const isAI = message.type === 'ai-response' || message.aiMetadata?.isAIResponse;

    // Find translation for current user's language
    const myLang = user?.preferredLanguage;
    const translation = message.translations?.find((t) => t.language === myLang);
    const senderName = message.sender?.username || 'Unknown';

    // File rendering
    const renderFile = () => {
        if (!message.file) return null;
        const { url, mimeType, name: fileName } = message.file;
        if (message.type === 'image' || mimeType?.startsWith('image/')) {
            return (
                <img
                    src={url}
                    alt={fileName}
                    className="max-w-70 rounded-lg mt-1 cursor-pointer hover:opacity-90"
                    onClick={() => window.open(url, '_blank')}
                />
            );
        }
        if (message.type === 'video' || mimeType?.startsWith('video/')) {
            return (
                <video src={url} controls className="max-w-70 rounded-lg mt-1" />
            );
        }
        return (
            <a
                href={url}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 bg-gray-100 px-3 py-2 rounded-lg mt-1 text-sm hover:bg-gray-200 transition"
            >
                📎 {fileName || 'file'}
            </a>
        );
    };

    return (
        <div
            className={`flex ${isOwn ? 'justify-end' : 'justify-start'} mb-2 group`}
            onMouseEnter={() => setShowActions(true)}
            onMouseLeave={() => setShowActions(false)}
        >
            <div className={`max-w-[75%] ${isOwn ? 'order-2' : 'order-1'}`}>
                {/* Sender name (group chats) */}
                {!isOwn && !isAI && (
                    <p className="text-xs text-gray-500 mb-0.5 ml-3">{senderName}</p>
                )}
                {isAI && (
                    <div className="flex items-center gap-1 text-xs text-purple-600 mb-0.5 ml-3">
                        <Bot size={12} />
                        <span>AI Bot</span>
                    </div>
                )}

                <div className="relative">
                    {/* Main bubble */}
                    <div
                        className={`px-4 py-2.5 rounded-2xl ${isAI
                            ? 'bg-purple-50 text-purple-900 border border-purple-100'
                            : isOwn
                                ? 'bg-blue-600 text-white'
                                : 'bg-gray-100 text-gray-900'
                            }`}
                    >
                        {message.content && (
                            <p className="text-sm whitespace-pre-wrap wrap-break-word">{message.content}</p>
                        )}
                        {renderFile()}

                        {/* Time */}
                        <p
                            className={`text-[10px] mt-1 ${isAI
                                ? 'text-purple-400'
                                : isOwn
                                    ? 'text-blue-200'
                                    : 'text-gray-400'
                                }`}
                        >
                            {format(new Date(message.createdAt), 'HH:mm')}
                        </p>
                    </div>

                    {/* Translation */}
                    {translation && !isOwn && (
                        <div className="mt-1">
                            <button
                                onClick={() => setShowTranslation(!showTranslation)}
                                className="flex items-center gap-1 text-xs text-blue-500 hover:text-blue-700 ml-3 mb-0.5"
                            >
                                <Globe size={11} />
                                <span>Bản dịch</span>
                                {showTranslation ? <ChevronUp size={11} /> : <ChevronDown size={11} />}
                            </button>
                            {showTranslation && (
                                <div className="bg-blue-50 border border-blue-100 px-3 py-2 rounded-xl text-sm text-blue-800 ml-2">
                                    {translation.content}
                                </div>
                            )}
                        </div>
                    )}

                    {/* Delete action */}
                    {isOwn && showActions && (
                        <button
                            onClick={() => onDelete?.(message._id)}
                            className="absolute -left-8 top-1/2 -translate-y-1/2 p-1 text-gray-400 hover:text-red-500 transition opacity-0 group-hover:opacity-100"
                            title="Xóa"
                        >
                            <Trash2 size={14} />
                        </button>
                    )}
                </div>
            </div>
        </div>
    );
}
