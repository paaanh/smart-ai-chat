import { useAuth } from '../../hooks/useAuth';
import { format } from 'date-fns';
import { Bot, Trash2, Globe, ChevronDown, ChevronUp, FileText, FileArchive, FileSpreadsheet, FileImage, FileVideo, FileAudio, File, Download, SmilePlus, Forward, Pin } from 'lucide-react';
import { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import ImageModal from './ImageModal';
import LocationMessage from './LocationMessage';
import VoiceMessage from './VoiceMessage';
import { getMediaUrlCandidates, resolveMediaUrl } from '../../services/api';
import { useTheme } from '../../hooks/useTheme';

const avatarColors = [
    'bg-red-500', 'bg-[var(--color-primary)]', 'bg-green-500', 'bg-yellow-500',
    'bg-purple-500', 'bg-pink-500', 'bg-indigo-500', 'bg-teal-500',
];

function getAvatarColor(id) {
    let hash = 0;
    for (let i = 0; i < (id || '').length; i++) hash = id.charCodeAt(i) + ((hash << 5) - hash);
    return avatarColors[Math.abs(hash) % avatarColors.length];
}

export default function MessageBubble({ message, isOwn, onDelete, onReact, nicknames, localTranslation, onForward, onPinMessage, onVotePoll }) {
    const { user } = useAuth();
    const { themeId } = useTheme();
    const navigate = useNavigate();
    const [showTranslation, setShowTranslation] = useState(false);
    const [showActions, setShowActions] = useState(false);
    const [lightbox, setLightbox] = useState(null);
    const [imgError, setImgError] = useState(false);
    const [mediaCandidateIndex, setMediaCandidateIndex] = useState(0);
    const [showEmojiPicker, setShowEmojiPicker] = useState(false);
    const [shouldShake, setShouldShake] = useState(false);
    const emojiPickerRef = useRef(null);
    const bubbleRef = useRef(null);

    const REACTION_EMOJIS = ['👍', '❤️', '😂', '😯', '😢', '😡'];

    // Close emoji picker on outside click
    useEffect(() => {
        if (!showEmojiPicker) return;
        const handleClick = (e) => {
            if (emojiPickerRef.current && !emojiPickerRef.current.contains(e.target)) {
                setShowEmojiPicker(false);
                setShowActions(false);
            }
        };
        document.addEventListener('mousedown', handleClick);
        return () => document.removeEventListener('mousedown', handleClick);
    }, [showEmojiPicker]);

    // Reset media URL fallback chain when message/file changes.
    useEffect(() => {
        setMediaCandidateIndex(0);
    }, [message._id, message.file?.url]);

    // Subtle nudge for newly arrived incoming messages.
    useEffect(() => {
        if (isOwn || message.type === 'system') return;
        setShouldShake(true);
        const timeout = setTimeout(() => setShouldShake(false), 480);
        return () => clearTimeout(timeout);
    }, [message._id, message.createdAt, message.type, isOwn]);

    const isPixelTheme = themeId === 'pixel-art';
    const isNeonTheme = themeId === 'neon-night';

    const triggerReactionEffect = async (emoji) => {
        if (!['❤️', '👍', '😂', '😯'].includes(emoji)) return;
        try {
            const { default: confetti } = await import('canvas-confetti');
            const rect = bubbleRef.current?.getBoundingClientRect();
            const x = rect ? (rect.left + rect.width / 2) / window.innerWidth : 0.5;
            const y = rect ? (rect.top + rect.height / 2) / window.innerHeight : 0.5;

            confetti({
                particleCount: emoji === '❤️' ? 30 : 18,
                spread: emoji === '❤️' ? 78 : 54,
                startVelocity: 24,
                gravity: 1,
                scalar: emoji === '❤️' ? 0.9 : 0.72,
                origin: { x, y },
                colors: ['#22d3ee', '#f59e0b', '#fb7185', '#a3e635', '#f8fafc'],
            });
        } catch {
            // Ignore if confetti cannot be loaded in constrained environments.
        }
    };

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
    const myLang = user?.preferredLanguage || localStorage.getItem('preferredLanguage') || 'vi';
    const translation = message.translations?.find((t) => t.language === myLang);

    // Prioritize translation for non-own messages
    const hasTranslation = !!(translation && !isOwn && message.originalLanguage && message.originalLanguage !== myLang);
    const displayText = hasTranslation ? translation.content : message.content;

    const senderId = message.sender?._id;
    const senderNickname = senderId && nicknames?.[senderId];
    const senderName = senderNickname || message.sender?.username || 'Unknown';

    // Format file size
    const formatSize = (bytes) => {
        if (!bytes) return '';
        if (bytes < 1024) return `${bytes} B`;
        if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
        return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
    };

    // Pick icon based on mimeType
    const getFileIcon = (mimeType) => {
        if (!mimeType) return File;
        if (mimeType.startsWith('image/')) return FileImage;
        if (mimeType.startsWith('video/')) return FileVideo;
        if (mimeType.startsWith('audio/')) return FileAudio;
        if (mimeType.includes('zip') || mimeType.includes('rar') || mimeType.includes('7z') || mimeType.includes('tar') || mimeType.includes('gz')) return FileArchive;
        if (mimeType.includes('sheet') || mimeType.includes('excel') || mimeType.includes('csv')) return FileSpreadsheet;
        if (mimeType.includes('pdf') || mimeType.includes('doc') || mimeType.includes('text')) return FileText;
        return File;
    };

    // File rendering
    const renderFile = () => {
        if (!message.file) return null;
        const { url, mimeType, name: rawName, size } = message.file;
        const mediaCandidates = getMediaUrlCandidates(url);
        const resolvedUrl = mediaCandidates[mediaCandidateIndex] || resolveMediaUrl(url);
        const tryNextMediaUrl = () => {
            setMediaCandidateIndex((prev) => (
                prev < mediaCandidates.length - 1 ? prev + 1 : prev
            ));
        };
        let fileName = rawName;
        try { fileName = decodeURIComponent(rawName); } catch { /* already decoded */ }

        if (message.type === 'image' || mimeType?.startsWith('image/')) {
            return (
                <img
                    src={resolvedUrl}
                    alt={fileName}
                    className="max-w-70 rounded-lg mt-1 cursor-pointer hover:opacity-90"
                    onError={tryNextMediaUrl}
                    onClick={() => setLightbox({ src: resolvedUrl, alt: fileName })}
                />
            );
        }
        if (message.type === 'video' || mimeType?.startsWith('video/')) {
            return (
                <video src={resolvedUrl} controls className="max-w-70 rounded-lg mt-1" onError={tryNextMediaUrl} />
            );
        }
        if (mimeType?.startsWith('audio/')) {
            return <VoiceMessage url={resolvedUrl} isOwn={isOwn} />;
        }

        const IconComponent = getFileIcon(mimeType);

        return (
            <a
                href={resolvedUrl}
                target="_blank"
                rel="noopener noreferrer"
                className={`flex items-center gap-3 mt-1 px-3 py-2.5 rounded-2xl max-w-[280px] w-fit cursor-pointer transition-all duration-150 group/file
                    ${isOwn
                        ? 'bg-white/15 hover:bg-white/25'
                        : 'bg-[var(--color-primary-light)] hover:bg-[var(--color-primary-medium)]'
                    }`}
                download
            >
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0
                    ${isOwn
                        ? 'bg-white/20'
                        : 'bg-[var(--color-primary-light)]'
                    }`}
                >
                    <IconComponent size={20} className={isOwn ? 'text-white' : 'text-[var(--color-primary)]'} />
                </div>
                <div className="min-w-0 flex-1">
                    <p className={`text-sm font-medium truncate ${isOwn ? 'text-white' : 'text-[var(--text-primary)]'}`}>
                        {fileName || 'file'}
                    </p>
                    {size > 0 && (
                        <p className={`text-xs mt-0.5 ${isOwn ? 'text-white/60' : 'text-[var(--text-tertiary)]'}`}>
                            {formatSize(size)}
                        </p>
                    )}
                </div>
                <Download size={16} className={`shrink-0 opacity-0 group-hover/file:opacity-100 transition-opacity ${isOwn ? 'text-white/70' : 'text-[var(--text-tertiary)]'}`} />
            </a>
        );
    };

    // ─── Poll rendering ─────────────────────────────────────────────
    if (message.type === 'poll' && message.poll) {
        const totalVotes = message.poll.options.reduce((sum, o) => sum + (o.votes?.length || 0), 0);
        return (
            <div className={`flex ${isOwn ? 'justify-end' : 'justify-start'} mb-2`}>
                {!isOwn && (
                    <div className="w-8 h-8 rounded-full flex-shrink-0 mr-2 overflow-hidden cursor-pointer"
                        onClick={() => message.sender?._id && navigate(`/profile/${message.sender._id}`)}>
                        {(message.sender?.avatar || message.sender?.googlePicture) ? (
                            <img src={resolveMediaUrl(message.sender.avatar || message.sender.googlePicture)} alt="" className="w-full h-full object-cover" />
                        ) : (
                            <div className={`w-full h-full ${getAvatarColor(message.sender?._id)} flex items-center justify-center text-white text-xs font-bold`}>
                                {senderName.charAt(0).toUpperCase()}
                            </div>
                        )}
                    </div>
                )}
                <div className="max-w-[75%] bg-white border border-gray-200 rounded-2xl p-4 shadow-sm">
                    <p className="text-xs text-gray-500 mb-1">{senderName}</p>
                    <p className="font-medium text-gray-800 mb-3">📊 {message.poll.question}</p>
                    <div className="space-y-2">
                        {message.poll.options.map((opt, idx) => {
                            const voteCount = opt.votes?.length || 0;
                            const pct = totalVotes > 0 ? Math.round((voteCount / totalVotes) * 100) : 0;
                            const myVote = opt.votes?.some(v => (v?._id || v)?.toString() === user?._id);
                            return (
                                <button key={idx} onClick={() => onVotePoll?.(message._id, idx)}
                                    className={`w-full text-left relative overflow-hidden rounded-lg border px-3 py-2 text-sm transition ${myVote ? 'border-blue-400 bg-blue-50' : 'border-gray-200 hover:bg-gray-50'}`}>
                                    <div className="absolute inset-0 bg-blue-100 rounded-lg transition-all" style={{ width: `${pct}%`, opacity: 0.3 }} />
                                    <div className="relative flex justify-between items-center">
                                        <span>{opt.text}</span>
                                        <span className="text-xs text-gray-500 ml-2">{voteCount} ({pct}%)</span>
                                    </div>
                                </button>
                            );
                        })}
                    </div>
                    <p className="text-[10px] text-gray-400 mt-2">{totalVotes} lượt bình chọn · {format(new Date(message.createdAt), 'HH:mm')}</p>
                </div>
            </div>
        );
    }

    // ─── Contact card rendering ──────────────────────────────────────
    if (message.type === 'contact-card' && message.contactCard) {
        const card = message.contactCard;
        return (
            <div className={`flex ${isOwn ? 'justify-end' : 'justify-start'} mb-2`}>
                <div className="max-w-[280px] bg-white border border-gray-200 rounded-2xl p-4 shadow-sm">
                    <p className="text-xs text-gray-500 mb-2">{senderName} đã chia sẻ liên hệ</p>
                    <div className="flex items-center gap-3 cursor-pointer hover:bg-gray-50 rounded-lg p-2 -mx-2 transition"
                        onClick={() => card.userId && navigate(`/profile/${card.userId}`)}>
                        <div className="w-12 h-12 rounded-full bg-blue-500 flex items-center justify-center text-white font-bold overflow-hidden shrink-0">
                            {card.avatar ? <img src={resolveMediaUrl(card.avatar)} alt="" className="w-full h-full object-cover" /> : card.username?.charAt(0).toUpperCase()}
                        </div>
                        <div className="min-w-0">
                            <p className="font-medium text-gray-800 truncate">{card.username}</p>
                            {card.bio && <p className="text-xs text-gray-500 truncate">{card.bio}</p>}
                        </div>
                    </div>
                    <p className="text-[10px] text-gray-400 mt-2 text-right">{format(new Date(message.createdAt), 'HH:mm')}</p>
                </div>
            </div>
        );
    }

    return (
        <>
            {lightbox && (
                <ImageModal
                    src={lightbox.src}
                    alt={lightbox.alt}
                    onClose={() => setLightbox(null)}
                />
            )}
            <motion.div
                className={`flex items-end gap-2 ${isOwn ? 'justify-end' : 'justify-start'} mb-2 group`}
                onMouseEnter={() => setShowActions(true)}
                onMouseLeave={() => { if (!showEmojiPicker) setShowActions(false); }}
                initial={{ opacity: 0, y: 14, scale: 0.98 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                transition={{ duration: 0.22, ease: 'easeOut' }}
            >
                {/* Avatar for other's messages */}
                {!isOwn && (
                    isAI ? (
                        <div className="w-8 h-8 rounded-full bg-purple-100 flex items-center justify-center flex-shrink-0">
                            <Bot size={16} className="text-purple-600" />
                        </div>
                    ) : (
                        <div
                            className="w-8 h-8 rounded-full flex-shrink-0 cursor-pointer overflow-hidden"
                            onClick={() => message.sender?._id && navigate(`/profile/${message.sender._id}`)}
                            title={senderName}
                        >
                            {(message.sender?.avatar || message.sender?.googlePicture) && !imgError ? (
                                <img
                                    src={resolveMediaUrl(message.sender.avatar || message.sender.googlePicture)}
                                    alt={senderName}
                                    className="w-full h-full object-cover"
                                    onError={() => setImgError(true)}
                                />
                            ) : (
                                <div className={`w-full h-full ${getAvatarColor(message.sender?._id)} flex items-center justify-center text-white text-xs font-bold`}>
                                    {senderName.charAt(0).toUpperCase()}
                                </div>
                            )}
                        </div>
                    )
                )}

                <div className={`max-w-[75%]`}>
                    <div className="relative">
                        {/* Main bubble */}
                        <motion.div
                            ref={bubbleRef}
                            className={`rounded-2xl ${message.type === 'location'
                                ? 'overflow-hidden'
                                : 'px-4 py-2.5'
                                } ${isAI
                                    ? 'bg-purple-50 text-purple-900 border border-purple-100'
                                    : isOwn
                                        ? 'bg-[var(--color-primary)] text-white'
                                        : 'bg-gray-100 text-gray-900'
                                } ${isPixelTheme ? 'pixel-bubble font-pixel' : ''} ${isNeonTheme ? 'neon-bubble' : ''}`}
                            animate={shouldShake ? { x: [0, -2, 2, -1, 1, 0] } : { x: 0 }}
                            transition={{ duration: 0.36, ease: 'easeInOut' }}
                        >
                            {/* Forward indicator */}
                            {message.forwardedFrom && (
                                <p className={`text-[10px] mb-1 flex items-center gap-1 ${isOwn ? 'text-white/60' : 'text-gray-400'}`}>
                                    <Forward size={10} /> Chuyển tiếp từ {message.forwardedFrom.senderName || 'Unknown'}
                                </p>
                            )}

                            {/* Pin indicator */}
                            {message.pinned && (
                                <p className={`text-[10px] mb-1 flex items-center gap-1 ${isOwn ? 'text-white/60' : 'text-gray-400'}`}>
                                    <Pin size={10} /> Đã ghim
                                </p>
                            )}
                            {/* Reply to Note quote */}
                            {message.replyToNote && (
                                <div className="mb-1.5">
                                    <p className={`text-[10px] mb-1 ${isOwn ? 'text-white/60' : 'text-gray-400'}`}>
                                        Bạn đã trả lời ghi chú của họ
                                    </p>
                                    <div className={`px-3 py-1.5 rounded-lg text-xs ${isOwn ? 'bg-white/15 text-white/80' : 'bg-gray-200/70 text-gray-600'}`}>
                                        {message.replyToNote}
                                    </div>
                                </div>
                            )}
                            {displayText && message.type !== 'location' && (
                                <p className="text-sm whitespace-pre-wrap wrap-break-word">{displayText}</p>
                            )}
                            {message.type === 'location' && message.location && (
                                <LocationMessage location={message.location} isOwn={isOwn} />
                            )}
                            {renderFile()}

                            {/* Time */}
                            <p
                                className={`text-[10px] mt-1 ${message.type === 'location' ? 'px-3 pb-1' : ''} ${isAI
                                    ? 'text-purple-400'
                                    : isOwn
                                        ? 'text-white/70'
                                        : 'text-gray-400'
                                    }`}
                            >
                                {format(new Date(message.createdAt), 'HH:mm')}
                            </p>
                        </motion.div>

                        {/* Show original text when translation is being displayed */}
                        {hasTranslation && (
                            <div className="mt-1">
                                <button
                                    onClick={() => setShowTranslation(!showTranslation)}
                                    className="flex items-center gap-1 text-xs text-[var(--color-primary)] hover:text-[var(--color-primary-hover)] ml-3 mb-0.5"
                                >
                                    <Globe size={11} />
                                    <span>Bản gốc</span>
                                    {showTranslation ? <ChevronUp size={11} /> : <ChevronDown size={11} />}
                                </button>
                                {showTranslation && (
                                    <div className="bg-[var(--color-primary-light)] border border-[var(--color-primary-medium)] px-3 py-2 rounded-xl text-sm text-[var(--color-primary-dark)] ml-2">
                                        {message.content}
                                    </div>
                                )}
                            </div>
                        )}

                        {/* Local auto-translate (private, not stored in DB) */}
                        {localTranslation && !isOwn && !hasTranslation && (
                            <div className="mt-1 ml-2">
                                <div className="flex items-center gap-1 text-[10px] text-purple-500 mb-0.5">
                                    <Globe size={10} />
                                    <span>Dịch tự động</span>
                                </div>
                                <div className="bg-purple-50 border border-purple-100 px-3 py-1.5 rounded-xl text-sm text-purple-800">
                                    {localTranslation}
                                </div>
                            </div>
                        )}

                        {/* Message actions */}
                        {showActions && message.type !== 'system' && (
                            <div
                                className={`absolute ${isOwn ? '-left-24' : '-right-20'} bottom-1 flex items-center gap-1 rounded-full bg-white/95 px-1 py-0.5 shadow-sm ring-1 ring-black/5 opacity-0 group-hover:opacity-100 transition`}
                            >
                                {isOwn && onDelete && (
                                    <button
                                        onClick={() => onDelete?.(message._id)}
                                        className="p-1 text-gray-400 hover:text-red-500 transition"
                                        title="Xóa"
                                    >
                                        <Trash2 size={14} />
                                    </button>
                                )}
                                {onForward && (
                                    <button
                                        onClick={() => onForward?.(message)}
                                        className="p-1 text-gray-400 hover:text-blue-500 transition"
                                        title="Chuyển tiếp"
                                    >
                                        <Forward size={14} />
                                    </button>
                                )}
                                {onPinMessage && (
                                    <button
                                        onClick={() => onPinMessage?.(message)}
                                        className="p-1 text-gray-400 hover:text-orange-500 transition"
                                        title={message.pinned ? 'Bỏ ghim' : 'Ghim'}
                                    >
                                        <Pin size={14} />
                                    </button>
                                )}
                            </div>
                        )}

                        {/* Reaction button */}
                        {(showActions || showEmojiPicker) && message.type !== 'system' && (
                            <div className={`absolute ${isOwn ? '-left-8 top-0' : '-right-8 top-0'}`} ref={emojiPickerRef}>
                                <button
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        setShowEmojiPicker((v) => !v);
                                    }}
                                    className={`p-1 text-gray-400 hover:text-[var(--color-primary)] transition
                                        ${showEmojiPicker ? 'opacity-100 text-[var(--color-primary)]' : 'opacity-0 group-hover:opacity-100'}`}
                                    title="Thả cảm xúc"
                                >
                                    <SmilePlus size={14} />
                                </button>

                                {/* Emoji picker popover */}
                                <AnimatePresence>
                                    {showEmojiPicker && (
                                        <motion.div
                                        className={`absolute ${isOwn ? 'right-0' : 'left-0'} bottom-full mb-1 flex items-center gap-1 bg-white rounded-full shadow-lg border border-gray-200 px-2 py-1.5 z-[9999]`}
                                        onClick={(e) => e.stopPropagation()}
                                        initial={{ opacity: 0, y: 8, scale: 0.9 }}
                                        animate={{ opacity: 1, y: 0, scale: 1 }}
                                        exit={{ opacity: 0, y: 8, scale: 0.9 }}
                                        transition={{ duration: 0.16, ease: 'easeOut' }}
                                    >
                                        {REACTION_EMOJIS.map((emoji) => (
                                            <button
                                                key={emoji}
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    onReact?.(message._id, emoji);
                                                    triggerReactionEffect(emoji);
                                                    setShowEmojiPicker(false);
                                                    setShowActions(false);
                                                }}
                                                className="text-lg hover:scale-125 transition-transform px-0.5 cursor-pointer"
                                            >
                                                {emoji}
                                            </button>
                                        ))}
                                        </motion.div>
                                    )}
                                </AnimatePresence>
                            </div>
                        )}
                    </div>

                    {/* Reactions display */}
                    {message.reactions?.length > 0 && (() => {
                        const grouped = {};
                        message.reactions.forEach((r) => {
                            if (!grouped[r.emoji]) grouped[r.emoji] = [];
                            grouped[r.emoji].push(r.user?.toString?.() || r.user);
                        });
                        const myId = user?._id;
                        return (
                            <div className={`flex flex-wrap gap-1 mt-1 ${isOwn ? 'justify-end' : 'justify-start'}`}>
                                {Object.entries(grouped).map(([emoji, users]) => {
                                    const isMine = users.includes(myId);
                                    return (
                                        <button
                                            key={emoji}
                                            onClick={() => onReact?.(message._id, emoji)}
                                            className={`flex items-center gap-0.5 text-xs px-1.5 py-0.5 rounded-full border transition-colors
                                                ${isMine
                                                    ? 'bg-[var(--color-primary-light)] border-[var(--color-primary)] text-[var(--color-primary)]'
                                                    : 'bg-gray-50 border-gray-200 text-gray-600 hover:bg-gray-100'
                                                }`}
                                        >
                                            <span>{emoji}</span>
                                            {users.length > 1 && <span>{users.length}</span>}
                                        </button>
                                    );
                                })}
                            </div>
                        );
                    })()}
                </div>
            </motion.div>
        </>
    );
}
