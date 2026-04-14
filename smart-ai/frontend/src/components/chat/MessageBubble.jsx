import { useAuth } from '../../hooks/useAuth';
import { format } from 'date-fns';
import { Bot, Trash2, Globe, ChevronDown, ChevronUp, FileText, FileArchive, FileSpreadsheet, FileImage, FileVideo, FileAudio, File, Download, SmilePlus, Forward, Pin, Copy, Check, ExternalLink, Smile, MoreHorizontal } from 'lucide-react';
import { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'; // eslint-disable-line no-unused-vars
import ImageModal from './ImageModal';
import LocationMessage from './LocationMessage';
import VoiceMessage from './VoiceMessage';
import StickerCard from './StickerCard';
import { getMediaUrlCandidates, resolveMediaUrl } from '../../services/api';
import { useTheme } from '../../hooks/useTheme';
import { parseStickerPayload } from '../../utils/stickers';
import { getChatBubbleFrameById } from '../../config/chatBubbleFrames';

const avatarColors = [
    'bg-red-500', 'bg-[var(--color-primary)]', 'bg-green-500', 'bg-yellow-500',
    'bg-purple-500', 'bg-pink-500', 'bg-indigo-500', 'bg-teal-500',
];

function getAvatarColor(id) {
    let hash = 0;
    for (let i = 0; i < (id || '').length; i++) hash = id.charCodeAt(i) + ((hash << 5) - hash);
    return avatarColors[Math.abs(hash) % avatarColors.length];
}

const emojiOnlyRegex = /^(?:[\p{Extended_Pictographic}\uFE0F\u200D\s])+$/u;

function getEmbeddableMedia(links = []) {
    if (!links.length) return null;
    const firstLink = links[0];
    if (!firstLink?.href) return null;

    try {
        const parsedUrl = new URL(firstLink.href);
        const host = parsedUrl.hostname.toLowerCase();

        if (host.includes('youtube.com') || host.includes('youtu.be')) {
            let videoId = '';

            if (host.includes('youtu.be')) {
                videoId = parsedUrl.pathname.slice(1).split('/')[0];
            } else if (parsedUrl.pathname.startsWith('/shorts/')) {
                videoId = parsedUrl.pathname.split('/shorts/')[1]?.split('/')[0] || '';
            } else {
                videoId = parsedUrl.searchParams.get('v') || '';
            }

            if (videoId) {
                return {
                    type: 'youtube',
                    src: `https://www.youtube.com/embed/${videoId}`,
                    title: 'YouTube video',
                };
            }
        }

        if (host.includes('tiktok.com')) {
            const tiktokMatch = parsedUrl.pathname.match(/\/video\/(\d+)/);
            const tiktokId = tiktokMatch?.[1];
            if (tiktokId) {
                return {
                    type: 'tiktok',
                    src: `https://www.tiktok.com/embed/v2/${tiktokId}`,
                    title: 'TikTok video',
                };
            }
        }
    } catch {
        // Ignore malformed URL.
    }

    return null;
}

export default function MessageBubble({
    message,
    isOwn,
    onDelete,
    onReact,
    nicknames,
    localTranslation,
    onForward,
    onPinMessage,
    onVotePoll,
    selectionMode = false,
    isSelected = false,
    onToggleSelect,
    onQuickReply,
    isClusterStart = true,
    isClusterEnd = true,
}) {
    const { user } = useAuth();
    const { themeId, bubbleFrameId } = useTheme();
    const navigate = useNavigate();
    const reduceMotion = useReducedMotion();
    const [showTranslation, setShowTranslation] = useState(false);
    const [showActions, setShowActions] = useState(false);
    const [lightbox, setLightbox] = useState(null);
    const [imgError, setImgError] = useState(false);
    const [mediaCandidateIndex, setMediaCandidateIndex] = useState(0);
    const [showEmojiPicker, setShowEmojiPicker] = useState(false);
    const [shouldShake, setShouldShake] = useState(false);
    const [copied, setCopied] = useState(false);
    const [isTouchDevice, setIsTouchDevice] = useState(() => {
        if (typeof window === 'undefined' || !window.matchMedia) return false;
        return window.matchMedia('(hover: none), (pointer: coarse)').matches;
    });
    const emojiPickerRef = useRef(null);
    const bubbleRef = useRef(null);
    const rowRef = useRef(null);
    const longPressTimerRef = useRef(null);

    const REACTION_EMOJIS = ['👍', '❤️', '😂', '😯', '😢', '😡'];

    useEffect(() => {
        if (typeof window === 'undefined' || !window.matchMedia) return;
        const media = window.matchMedia('(hover: none), (pointer: coarse)');
        const onChange = (event) => setIsTouchDevice(event.matches);

        setIsTouchDevice(media.matches);
        media.addEventListener('change', onChange);
        return () => media.removeEventListener('change', onChange);
    }, []);

    // Reset media URL fallback chain when message/file changes.
    useEffect(() => {
        setMediaCandidateIndex(0);
    }, [message._id, message.file?.url]);

    // Subtle nudge for newly arrived incoming messages.
    useEffect(() => {
        if (reduceMotion || isOwn || message.type === 'system') return;
        setShouldShake(true);
        const timeout = setTimeout(() => setShouldShake(false), 480);
        return () => clearTimeout(timeout);
    }, [message._id, message.createdAt, message.type, isOwn, reduceMotion]);

    useEffect(() => {
        return () => {
            if (longPressTimerRef.current) {
                clearTimeout(longPressTimerRef.current);
            }
        };
    }, []);

    useEffect(() => {
        if (!showActions && !showEmojiPicker) return;

        const handleOutside = (event) => {
            if (rowRef.current && !rowRef.current.contains(event.target)) {
                setShowActions(false);
                setShowEmojiPicker(false);
            }
        };

        document.addEventListener('touchstart', handleOutside);
        document.addEventListener('mousedown', handleOutside);
        return () => {
            document.removeEventListener('touchstart', handleOutside);
            document.removeEventListener('mousedown', handleOutside);
        };
    }, [showActions, showEmojiPicker]);

    const isPixelTheme = themeId === 'pixel-art';
    const isNeonTheme = themeId === 'neon-night';
    const isDarkTheme = ['dark', 'midnight-purple', 'glassmorphism', 'retro-terminal', 'neon-night'].includes(themeId);

    const trailingPunctuationRegex = /[)\].,!?;:]+$/;

    const normalizeUrlCandidate = (raw) => {
        const trailingMatch = raw.match(trailingPunctuationRegex);
        const trailing = trailingMatch ? trailingMatch[0] : '';
        const clean = trailing ? raw.slice(0, -trailing.length) : raw;
        const href = clean.startsWith('www.') ? `https://${clean}` : clean;
        return { clean, href, trailing };
    };

    const extractLinks = (text) => {
        if (!text) return [];
        const seen = new Set();
        const links = [];
        const urlRegex = /((?:https?:\/\/|www\.)[^\s<]+)/gi;
        const source = String(text);
        let match;
        while ((match = urlRegex.exec(source)) !== null) {
            const { clean, href } = normalizeUrlCandidate(match[1]);
            if (!clean || seen.has(href)) continue;
            seen.add(href);
            links.push({ text: clean, href });
            if (links.length >= 3) break;
        }
        return links;
    };

    const renderInlineTokens = (text, style = {}) => {
        if (!text) return null;
        const tokenRegex = /(`[^`\n]+`)|(\*\*[^*\n]+\*\*)|(\*[^*\n]+\*)|(@[a-zA-Z0-9_.]{2,32})|((?:https?:\/\/|www\.)[^\s<]+)|([A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,})|((?:\+?\d[\d\s().-]{7,}\d))/gi;
        const nodes = [];
        let lastIndex = 0;
        let tokenIndex = 0;

        text.replace(tokenRegex, (fullMatch, inlineCode, bold, italic, mention, url, email, phone, offset) => {
            if (offset > lastIndex) {
                nodes.push(text.slice(lastIndex, offset));
            }

            if (inlineCode) {
                nodes.push(
                    <code
                        key={`code-${tokenIndex}`}
                        className={`px-1 py-0.5 rounded text-[0.85em] ${style.inlineCodeClassName || 'bg-black/10'}`}
                    >
                        {inlineCode.slice(1, -1)}
                    </code>
                );
            } else if (bold) {
                nodes.push(<strong key={`bold-${tokenIndex}`}>{bold.slice(2, -2)}</strong>);
            } else if (italic) {
                nodes.push(<em key={`italic-${tokenIndex}`}>{italic.slice(1, -1)}</em>);
            } else if (mention) {
                nodes.push(
                    <motion.span
                        key={`mention-${tokenIndex}`}
                        className={style.mentionClassName || 'font-semibold text-sky-600'}
                        whileHover={{ scale: 1.04 }}
                        transition={{ duration: 0.12 }}
                    >
                        {mention}
                    </motion.span>
                );
            } else if (url) {
                const { clean, href, trailing } = normalizeUrlCandidate(url);
                nodes.push(
                    <motion.a
                        key={`url-${tokenIndex}`}
                        href={href}
                        target="_blank"
                        rel="noopener noreferrer"
                        className={`underline underline-offset-2 break-all hover:opacity-90 ${style.linkClassName || ''}`.trim()}
                        whileHover={{ y: -1, scale: 1.01 }}
                        whileTap={{ scale: 0.98 }}
                        transition={{ duration: 0.1 }}
                    >
                        {clean}
                    </motion.a>
                );
                if (trailing) nodes.push(trailing);
            } else if (email) {
                nodes.push(
                    <motion.a
                        key={`email-${tokenIndex}`}
                        href={`mailto:${email}`}
                        className={`underline underline-offset-2 break-all hover:opacity-90 ${style.linkClassName || ''}`.trim()}
                        whileHover={{ y: -1, scale: 1.01 }}
                        whileTap={{ scale: 0.98 }}
                        transition={{ duration: 0.1 }}
                    >
                        {email}
                    </motion.a>
                );
            } else if (phone) {
                const phoneText = phone.trim();
                const phoneHref = phoneText.replace(/[^\d+]/g, '');
                nodes.push(
                    <motion.a
                        key={`phone-${tokenIndex}`}
                        href={`tel:${phoneHref}`}
                        className={`underline underline-offset-2 break-all hover:opacity-90 ${style.linkClassName || ''}`.trim()}
                        whileHover={{ y: -1, scale: 1.01 }}
                        whileTap={{ scale: 0.98 }}
                        transition={{ duration: 0.1 }}
                    >
                        {phoneText}
                    </motion.a>
                );
            }

            tokenIndex += 1;
            lastIndex = offset + fullMatch.length;
            return fullMatch;
        });

        if (lastIndex < text.length) {
            nodes.push(text.slice(lastIndex));
        }

        return nodes;
    };

    const renderRichText = (text, style = {}) => {
        if (text == null || text === '') return null;
        const source = String(text);
        const blocks = [];
        const codeBlockRegex = /```([\s\S]*?)```/g;
        let lastIndex = 0;
        let match;
        let blockIndex = 0;

        while ((match = codeBlockRegex.exec(source)) !== null) {
            if (match.index > lastIndex) {
                const segment = source.slice(lastIndex, match.index);
                segment.split('\n').forEach((line, lineIdx) => {
                    blocks.push(
                        <span key={`line-${blockIndex}-${lineIdx}`}>
                            {renderInlineTokens(line, style)}
                            {lineIdx < segment.split('\n').length - 1 && <br />}
                        </span>
                    );
                });
            }

            blocks.push(
                <pre
                    key={`block-${blockIndex}`}
                    className={`my-1 rounded-lg px-2.5 py-2 overflow-x-auto text-xs ${style.codeBlockClassName || 'bg-black/10'}`}
                >
                    <code>{match[1].trim()}</code>
                </pre>
            );

            blockIndex += 1;
            lastIndex = codeBlockRegex.lastIndex;
        }

        if (lastIndex < source.length) {
            const tail = source.slice(lastIndex);
            const lines = tail.split('\n');
            lines.forEach((line, lineIdx) => {
                blocks.push(
                    <span key={`tail-${blockIndex}-${lineIdx}`}>
                        {renderInlineTokens(line, style)}
                        {lineIdx < lines.length - 1 && <br />}
                    </span>
                );
            });
        }

        return blocks;
    };

    const handleCopyMessage = async () => {
        const stickerPayload = parseStickerPayload(message.content);
        const copyValue = stickerPayload ? `[Sticker:${stickerPayload.stickerId}]` : message.content;
        if (!copyValue) return;
        try {
            await navigator.clipboard.writeText(copyValue);
            setCopied(true);
            setTimeout(() => setCopied(false), 1500);
        } catch {
            setCopied(false);
        }
    };

    const triggerReactionEffect = async (emoji) => {
        if (reduceMotion) return;
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
    const stickerPayload = parseStickerPayload(message.content);
    const isStickerMessage = message.type === 'text' && !!stickerPayload;

    // Prioritize translation for non-own messages
    const hasTranslation = !isStickerMessage && !!(translation && !isOwn && message.originalLanguage && message.originalLanguage !== myLang);
    const displayText = isStickerMessage ? '' : (hasTranslation ? translation.content : message.content);
    const messageLinks = extractLinks(displayText);
    const embeddableMedia = getEmbeddableMedia(messageLinks);
    const emojiMatches = [...String(displayText || '').matchAll(/\p{Extended_Pictographic}/gu)];
    const isEmojiOnlyMessage = !!displayText?.trim() && emojiOnlyRegex.test(displayText.trim()) && !message.file && message.type !== 'location' && !isStickerMessage;
    const emojiSizeClass = emojiMatches.length <= 2 ? 'text-5xl leading-tight' : emojiMatches.length <= 4 ? 'text-4xl leading-tight' : 'text-3xl leading-tight';
    const senderFrameId = isOwn
        ? bubbleFrameId
        : (message.sender?.preferredBubbleFrame || 'classic-blue');
    const senderBubbleFrame = getChatBubbleFrameById(senderFrameId);
    const senderBubbleClass = senderBubbleFrame?.bubbleClass || 'bg-[var(--color-primary)]';
    const frameIsLight = !!senderBubbleFrame?.isLightFrame;
    const senderContentTextClass = frameIsLight ? 'text-slate-900' : 'text-white';
    const senderMetaTextClass = senderBubbleFrame?.metaTextClass || (frameIsLight ? 'text-slate-700/80' : 'text-white/75');
    const senderBadgeClass = senderBubbleFrame?.badgeClass || 'bg-white/90 text-[var(--color-primary)] border-white/70';
    const useSenderFrameStyle = !isAI && !isEmojiOnlyMessage && !isStickerMessage && message.type !== 'location';
    const showSenderFrameBadge = useSenderFrameStyle && isClusterStart;
    const showCompactMeta = isClusterEnd || showActions || showEmojiPicker;

    const senderLinkClassName = frameIsLight ? 'text-slate-900' : 'text-white';
    const senderMentionClassName = frameIsLight ? 'font-semibold text-slate-900' : 'font-semibold text-white';
    const senderInlineCodeClassName = frameIsLight ? 'bg-black/10' : 'bg-white/20';
    const senderCodeBlockClassName = frameIsLight ? 'bg-black/10' : 'bg-white/15';

    const readByOthers = (message.readBy || []).filter((entry) => {
        const readerId = entry?.user?._id || entry?.user;
        const senderRef = message.sender?._id || message.sender;
        return String(readerId || '') !== String(senderRef || '');
    });
    const latestReadAt = readByOthers
        .map((entry) => entry?.readAt)
        .filter(Boolean)
        .sort((a, b) => new Date(b) - new Date(a))[0];

    const senderId = message.sender?._id;
    const senderNickname = senderId && nicknames?.[senderId];
    const senderName = senderNickname || message.sender?.username || 'Unknown';
    const showSenderAvatar = !isOwn && (isAI || isClusterEnd);

    const startLongPressMenu = () => {
        if (!isTouchDevice || selectionMode) return;
        if (longPressTimerRef.current) {
            clearTimeout(longPressTimerRef.current);
        }

        longPressTimerRef.current = setTimeout(() => {
            setShowActions(true);
        }, 360);
    };

    const clearLongPressMenu = () => {
        if (!longPressTimerRef.current) return;
        clearTimeout(longPressTimerRef.current);
        longPressTimerRef.current = null;
    };

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
                    ${useSenderFrameStyle
                        ? frameIsLight
                            ? 'bg-white/45 hover:bg-white/65'
                            : 'bg-white/15 hover:bg-white/25'
                        : 'bg-[var(--color-primary-light)] hover:bg-[var(--color-primary-medium)]'
                    }`}
                download
            >
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0
                    ${useSenderFrameStyle
                        ? frameIsLight
                            ? 'bg-white/65'
                            : 'bg-white/20'
                        : 'bg-[var(--color-primary-light)]'
                    }`}
                >
                    <IconComponent
                        size={20}
                        className={useSenderFrameStyle
                            ? (frameIsLight ? 'text-slate-900' : 'text-white')
                            : 'text-[var(--color-primary)]'
                        }
                    />
                </div>
                <div className="min-w-0 flex-1">
                    <p className={`text-sm font-medium truncate ${useSenderFrameStyle ? senderContentTextClass : 'text-[var(--text-primary)]'}`}>
                        {fileName || 'file'}
                    </p>
                    {size > 0 && (
                        <p className={`text-xs mt-0.5 ${useSenderFrameStyle ? senderMetaTextClass : 'text-[var(--text-tertiary)]'}`}>
                            {formatSize(size)}
                        </p>
                    )}
                </div>
                <Download
                    size={16}
                    className={`shrink-0 opacity-0 group-hover/file:opacity-100 transition-opacity ${useSenderFrameStyle ? senderMetaTextClass : 'text-[var(--text-tertiary)]'}`}
                />
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
                ref={rowRef}
                className={`chat-message-row ${isClusterEnd ? 'chat-cluster-end' : 'chat-cluster-mid'} flex items-end gap-2 ${isOwn ? 'justify-end' : 'justify-start'}`}
                onClick={(event) => {
                    if (selectionMode) {
                        event.preventDefault();
                        event.stopPropagation();
                        onToggleSelect?.(message._id);
                    }
                }}
                onTouchStart={startLongPressMenu}
                onTouchEnd={clearLongPressMenu}
                onTouchMove={clearLongPressMenu}
                onTouchCancel={clearLongPressMenu}
                initial={reduceMotion ? false : { opacity: 0, y: 14, scale: 0.98 }}
                animate={reduceMotion ? { opacity: 1 } : { opacity: 1, y: 0, scale: 1 }}
                transition={reduceMotion ? { duration: 0 } : { duration: 0.22, ease: 'easeOut' }}
            >
                {/* Avatar for other's messages */}
                {!isOwn && (
                    isAI ? (
                        <div className="w-8 h-8 rounded-full bg-purple-100 flex items-center justify-center flex-shrink-0">
                            <Bot size={16} className="text-purple-600" />
                        </div>
                    ) : showSenderAvatar ? (
                        <div
                            className="w-8 h-8 rounded-full flex-shrink-0 cursor-pointer overflow-hidden"
                            onClick={() => message.sender?._id && navigate(`/profile/${message.sender._id}`)}
                            title={`${senderName} · ${format(new Date(message.createdAt), 'HH:mm - dd/MM/yyyy')}`}
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
                    ) : (
                        <div className="w-8 h-8 flex-shrink-0" aria-hidden="true" />
                    )
                )}

                <div className={`max-w-[75%]`}>
                    <div className="relative">
                        {selectionMode && (
                            <button
                                type="button"
                                onClick={(e) => {
                                    e.stopPropagation();
                                    onToggleSelect?.(message._id);
                                }}
                                className={`absolute ${isOwn ? '-left-8' : '-right-8'} top-2 z-10 w-5 h-5 rounded-full border text-[10px] font-bold transition
                                    ${isSelected
                                        ? 'bg-[var(--color-primary)] border-[var(--color-primary)] text-white'
                                        : 'bg-white border-gray-300 text-transparent'
                                    }`}
                                title={isSelected ? 'Bỏ chọn' : 'Chọn tin nhắn'}
                            >
                                ✓
                            </button>
                        )}

                        {/* Main bubble */}
                        <motion.div
                            ref={bubbleRef}
                            className={`relative rounded-2xl ${message.type === 'location'
                                ? 'overflow-hidden'
                                : isEmojiOnlyMessage || isStickerMessage
                                    ? 'px-1 py-0'
                                    : 'px-4 py-2.5'
                                } ${isEmojiOnlyMessage || isStickerMessage
                                    ? 'bg-transparent border-transparent shadow-none'
                                    : isAI
                                        ? isDarkTheme
                                            ? 'bg-[var(--color-primary-light)] text-[var(--text-primary)] border border-gray-200'
                                            : 'bg-purple-50 text-purple-900 border border-purple-100'
                                        : useSenderFrameStyle
                                            ? `${senderBubbleClass} ${senderContentTextClass}`
                                            : 'theme-muted-surface text-gray-900'
                                } ${selectionMode && isSelected ? 'ring-2 ring-[var(--color-primary)] ring-offset-1' : ''} ${isPixelTheme ? 'pixel-bubble font-pixel' : ''} ${isNeonTheme ? 'neon-bubble' : ''}`}
                            onDoubleClick={() => {
                                if (!selectionMode) {
                                    onQuickReply?.(message);
                                }
                            }}
                            animate={reduceMotion ? { x: 0 } : (shouldShake ? { x: [0, -2, 2, -1, 1, 0] } : { x: 0 })}
                            transition={reduceMotion ? { duration: 0 } : { duration: 0.36, ease: 'easeInOut' }}
                        >
                            {showSenderFrameBadge && (
                                <span
                                    className={`absolute -top-2 -right-2 z-[2] w-6 h-6 rounded-full border text-[11px] leading-none flex items-center justify-center shadow-sm ${senderBadgeClass}`}
                                    title={senderBubbleFrame?.name || 'Khung chat'}
                                >
                                    {senderBubbleFrame?.icon || '💬'}
                                </span>
                            )}

                            {/* Forward indicator */}
                            {message.forwardedFrom && (
                                <p className={`text-[10px] mb-1 flex items-center gap-1 ${useSenderFrameStyle ? senderMetaTextClass : 'text-gray-400'}`}>
                                    <Forward size={10} /> Chuyển tiếp từ {message.forwardedFrom.senderName || 'Unknown'}
                                </p>
                            )}

                            {/* Pin indicator */}
                            {message.pinned && (
                                <p className={`text-[10px] mb-1 flex items-center gap-1 ${useSenderFrameStyle ? senderMetaTextClass : 'text-gray-400'}`}>
                                    <Pin size={10} /> Đã ghim
                                </p>
                            )}
                            {/* Reply to Note quote */}
                            {message.replyToNote && (
                                <div className="mb-1.5">
                                    <p className={`text-[10px] mb-1 ${useSenderFrameStyle ? senderMetaTextClass : 'text-gray-400'}`}>
                                        Bạn đã trả lời ghi chú của họ
                                    </p>
                                    <div className={`px-3 py-1.5 rounded-lg text-xs ${useSenderFrameStyle
                                        ? frameIsLight
                                            ? 'bg-white/45 text-slate-800'
                                            : 'bg-white/15 text-white/85'
                                        : 'bg-gray-200/70 text-gray-600'
                                    }`}>
                                        {renderRichText(
                                            message.replyToNote,
                                            {
                                                linkClassName: useSenderFrameStyle ? senderLinkClassName : 'text-[var(--color-primary)]',
                                                mentionClassName: useSenderFrameStyle ? senderMentionClassName : 'font-semibold text-sky-700',
                                                inlineCodeClassName: useSenderFrameStyle ? senderInlineCodeClassName : 'bg-black/10',
                                                codeBlockClassName: useSenderFrameStyle ? senderCodeBlockClassName : 'bg-black/10',
                                            }
                                        )}
                                    </div>
                                </div>
                            )}
                            {isStickerMessage && stickerPayload?.sticker && (
                                <div className="py-0.5">
                                    <StickerCard sticker={stickerPayload.sticker} size="lg" />
                                </div>
                            )}
                            {displayText && message.type !== 'location' && (
                                <p className={`${isEmojiOnlyMessage ? `${emojiSizeClass} text-center` : 'text-sm'} whitespace-pre-wrap wrap-break-word`}>
                                    {renderRichText(
                                        displayText,
                                        {
                                            linkClassName: useSenderFrameStyle
                                                ? senderLinkClassName
                                                : isAI
                                                    ? isDarkTheme
                                                        ? 'text-[var(--color-primary-dark)]'
                                                        : 'text-purple-600'
                                                    : 'text-[var(--color-primary)]',
                                            mentionClassName: useSenderFrameStyle ? senderMentionClassName : 'font-semibold text-sky-700',
                                            inlineCodeClassName: useSenderFrameStyle ? senderInlineCodeClassName : 'bg-black/10',
                                            codeBlockClassName: useSenderFrameStyle ? senderCodeBlockClassName : 'bg-black/10',
                                        }
                                    )}
                                </p>
                            )}
                            {messageLinks.length > 0 && message.type !== 'location' && (
                                <div className="mt-2 space-y-1.5">
                                    {messageLinks.map((link) => {
                                        let hostname = link.href;
                                        let pathname = '';
                                        try {
                                            const parsed = new URL(link.href);
                                            hostname = parsed.hostname;
                                            pathname = parsed.pathname === '/' ? '' : parsed.pathname;
                                        } catch {
                                            // Keep fallback values.
                                        }

                                        return (
                                            <motion.a
                                                key={link.href}
                                                href={link.href}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                className={`flex items-center gap-2 rounded-xl px-2.5 py-2 border text-xs transition hover:opacity-90
                                                    ${useSenderFrameStyle
                                                        ? frameIsLight
                                                            ? 'border-black/10 bg-white/45 text-slate-900'
                                                            : 'border-white/30 bg-white/10 text-white'
                                                        : 'border-gray-200 bg-white text-gray-700'
                                                    }`}
                                                whileHover={{ y: -1, scale: 1.01 }}
                                                whileTap={{ scale: 0.985 }}
                                                transition={{ duration: 0.12 }}
                                            >
                                                <img
                                                    src={`https://www.google.com/s2/favicons?domain=${encodeURIComponent(hostname)}&sz=32`}
                                                    alt=""
                                                    className="w-4 h-4 rounded-sm"
                                                />
                                                <div className="min-w-0 flex-1">
                                                    <p className="font-medium truncate">{hostname}</p>
                                                    <p className={`truncate ${useSenderFrameStyle ? senderMetaTextClass : 'text-gray-500'}`}>
                                                        {pathname || link.text}
                                                    </p>
                                                </div>
                                                <ExternalLink size={12} className={useSenderFrameStyle ? senderMetaTextClass : 'text-gray-500'} />
                                            </motion.a>
                                        );
                                    })}
                                </div>
                            )}
                            {embeddableMedia && (
                                <motion.div
                                    className={`mt-2 overflow-hidden rounded-xl border ${useSenderFrameStyle
                                        ? frameIsLight ? 'border-black/10' : 'border-white/30'
                                        : 'border-gray-200'
                                    }`}
                                    initial={{ opacity: 0, y: 8 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    transition={{ duration: reduceMotion ? 0 : 0.2 }}
                                >
                                    <iframe
                                        src={embeddableMedia.src}
                                        title={embeddableMedia.title}
                                        className="w-full"
                                        style={{ height: embeddableMedia.type === 'tiktok' ? 470 : 230 }}
                                        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                                        allowFullScreen
                                    />
                                </motion.div>
                            )}
                            {message.type === 'location' && message.location && (
                                <LocationMessage location={message.location} isOwn={isOwn} />
                            )}
                            {renderFile()}

                            {/* Time */}
                            {showCompactMeta && (
                                <p
                                    className={`text-[10px] mt-1 ${message.type === 'location' ? 'px-3 pb-1' : ''} ${isAI
                                        ? isDarkTheme
                                            ? 'text-gray-400'
                                            : 'text-purple-400'
                                        : useSenderFrameStyle
                                            ? senderMetaTextClass
                                            : 'text-gray-400'
                                        }`}
                                    title={format(new Date(message.createdAt), 'HH:mm:ss - dd/MM/yyyy')}
                                >
                                    {format(new Date(message.createdAt), 'HH:mm')}
                                </p>
                            )}
                            {isOwn && message.type !== 'system' && (message.pending || showCompactMeta) && (
                                <p
                                    className={`text-[10px] ${useSenderFrameStyle ? senderMetaTextClass : 'text-gray-400'}`}
                                    title={message.pending ? 'Tin nhắn đang chờ xác nhận từ server' : 'Trạng thái xem tin nhắn'}
                                >
                                    {message.pending
                                        ? 'Đang gửi...'
                                        : readByOthers.length > 0
                                            ? `Đã xem${readByOthers.length > 1 ? ` (${readByOthers.length})` : ''}${latestReadAt ? ` · ${format(new Date(latestReadAt), 'HH:mm')}` : ''}`
                                            : 'Đã gửi'}
                                </p>
                            )}
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
                                        {renderRichText(message.content, {
                                            linkClassName: 'text-[var(--color-primary-dark)]',
                                            mentionClassName: 'font-semibold text-sky-700',
                                            inlineCodeClassName: 'bg-black/10',
                                            codeBlockClassName: 'bg-black/10',
                                        })}
                                    </div>
                                )}
                            </div>
                        )}

                        {/* Local auto-translate (private, not stored in DB) */}
                        {localTranslation && !isOwn && !hasTranslation && (
                            <div className="mt-1 ml-2">
                                <div className={`flex items-center gap-1 text-[10px] mb-0.5 ${isDarkTheme ? 'text-[var(--text-secondary)]' : 'text-purple-500'}`}>
                                    <Globe size={10} />
                                    <span>Dịch tự động</span>
                                </div>
                                <div className={`px-3 py-1.5 rounded-xl text-sm ${isDarkTheme ? 'bg-[var(--bg-card)] border border-gray-200 text-[var(--text-primary)]' : 'bg-purple-50 border border-purple-100 text-purple-800'}`}>
                                    {renderRichText(localTranslation, {
                                        linkClassName: isDarkTheme ? 'text-[var(--color-primary-dark)]' : 'text-purple-800',
                                        mentionClassName: isDarkTheme ? 'font-semibold text-[var(--color-primary-dark)]' : 'font-semibold text-purple-700',
                                        inlineCodeClassName: isDarkTheme ? 'bg-[var(--bg-hover)]' : 'bg-purple-100',
                                        codeBlockClassName: isDarkTheme ? 'bg-[var(--bg-hover)]' : 'bg-purple-100',
                                    })}
                                </div>
                            </div>
                        )}

                        {/* Message actions */}
                        {!selectionMode && message.type !== 'system' && (
                            <button
                                type="button"
                                onClick={(event) => {
                                    event.stopPropagation();
                                    setShowEmojiPicker(false);
                                    setShowActions((prev) => !prev);
                                }}
                                className={`absolute ${isOwn ? '-left-8' : '-right-8'} top-0 p-1 rounded-full transition ${showActions
                                    ? 'bg-[var(--color-primary-light)] text-[var(--color-primary)] opacity-100'
                                    : 'text-[var(--text-tertiary)] opacity-80 hover:bg-[var(--bg-hover)]'
                                }`}
                                title="Mở menu hành động"
                            >
                                <MoreHorizontal size={14} />
                            </button>
                        )}

                        {!selectionMode && message.type !== 'system' && (
                            <div
                                className={`absolute ${isTouchDevice
                                    ? (isOwn ? 'left-0 -top-10' : 'right-0 -top-10')
                                    : (isOwn ? '-left-24 bottom-1' : '-right-20 bottom-1')
                                } flex items-center gap-1 rounded-full bg-white border border-gray-200 px-1 py-0.5 shadow-sm transition ${showActions
                                    ? 'opacity-100 pointer-events-auto'
                                    : 'opacity-0 pointer-events-none'
                                }`}
                            >
                                {isOwn && onDelete && (
                                    <motion.button
                                        onClick={() => {
                                            onDelete?.(message._id);
                                            if (isTouchDevice) setShowActions(false);
                                        }}
                                        className="p-1 text-[var(--text-tertiary)] hover:text-red-500 transition"
                                        title="Xóa"
                                        whileHover={{ scale: 1.08 }}
                                        whileTap={{ scale: 0.92 }}
                                    >
                                        <Trash2 size={14} />
                                    </motion.button>
                                )}
                                <motion.button
                                    onClick={() => {
                                        handleCopyMessage();
                                        if (isTouchDevice) setShowActions(false);
                                    }}
                                    className="p-1 text-[var(--text-tertiary)] hover:text-emerald-500 transition"
                                    title="Sao chép"
                                    whileHover={{ scale: 1.08 }}
                                    whileTap={{ scale: 0.92 }}
                                >
                                    {copied ? <Check size={14} /> : <Copy size={14} />}
                                </motion.button>
                                {onForward && (
                                    <motion.button
                                        onClick={() => {
                                            onForward?.(message);
                                            if (isTouchDevice) setShowActions(false);
                                        }}
                                        className="p-1 text-[var(--text-tertiary)] hover:text-blue-500 transition"
                                        title="Chuyển tiếp"
                                        whileHover={{ scale: 1.08 }}
                                        whileTap={{ scale: 0.92 }}
                                    >
                                        <Forward size={14} />
                                    </motion.button>
                                )}
                                {onPinMessage && (
                                    <motion.button
                                        onClick={() => {
                                            onPinMessage?.(message);
                                            if (isTouchDevice) setShowActions(false);
                                        }}
                                        className="p-1 text-[var(--text-tertiary)] hover:text-orange-500 transition"
                                        title={message.pinned ? 'Bỏ ghim' : 'Ghim'}
                                        whileHover={{ scale: 1.08 }}
                                        whileTap={{ scale: 0.92 }}
                                    >
                                        <Pin size={14} />
                                    </motion.button>
                                )}
                                <motion.button
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        setShowActions(false);
                                        setShowEmojiPicker(false);
                                        window.dispatchEvent(new CustomEvent('chat:open-bubble-frame-picker'));
                                    }}
                                    className="p-1 text-[var(--text-tertiary)] hover:text-fuchsia-500 transition"
                                    title="Đổi khung chat"
                                    whileHover={{ scale: 1.08 }}
                                    whileTap={{ scale: 0.92 }}
                                >
                                    <Smile size={14} />
                                </motion.button>
                            </div>
                        )}

                        {/* Reaction button */}
                        {!selectionMode && (showActions || showEmojiPicker) && message.type !== 'system' && (
                            <div className={`absolute ${isOwn ? '-left-8 top-0' : '-right-8 top-0'}`} ref={emojiPickerRef}>
                                <motion.button
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        setShowEmojiPicker((v) => !v);
                                    }}
                                    className={`p-1 text-[var(--text-tertiary)] hover:text-[var(--color-primary)] transition ${showEmojiPicker || showActions
                                        ? 'opacity-100 text-[var(--color-primary)]'
                                        : 'opacity-0 pointer-events-none'
                                    }`}
                                    title="Thả cảm xúc"
                                    whileHover={{ scale: 1.08 }}
                                    whileTap={{ scale: 0.92 }}
                                >
                                    <SmilePlus size={14} />
                                </motion.button>

                                {/* Emoji picker popover */}
                                <AnimatePresence>
                                    {showEmojiPicker && (
                                        <motion.div
                                        className={`absolute ${isOwn ? 'right-0' : 'left-0'} bottom-full mb-1 flex items-center gap-1 bg-white rounded-full shadow-lg border border-gray-200 px-2 py-1.5 z-[9999]`}
                                        onClick={(e) => e.stopPropagation()}
                                        initial={{ opacity: 0, y: 8, scale: 0.9 }}
                                        animate={{ opacity: 1, y: 0, scale: 1 }}
                                        exit={{ opacity: 0, y: 8, scale: 0.9 }}
                                        transition={{ duration: reduceMotion ? 0 : 0.16, ease: 'easeOut' }}
                                    >
                                        {REACTION_EMOJIS.map((emoji) => (
                                            <motion.button
                                                key={emoji}
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    onReact?.(message._id, emoji);
                                                    triggerReactionEffect(emoji);
                                                    setShowEmojiPicker(false);
                                                    setShowActions(false);
                                                }}
                                                className="text-lg hover:scale-125 transition-transform px-0.5 cursor-pointer"
                                                whileHover={{ scale: 1.18 }}
                                                whileTap={{ scale: 0.88 }}
                                            >
                                                {emoji}
                                            </motion.button>
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
                                        <motion.button
                                            key={emoji}
                                            onClick={() => onReact?.(message._id, emoji)}
                                            className={`flex items-center gap-0.5 text-xs px-1.5 py-0.5 rounded-full border transition-colors
                                                ${isMine
                                                    ? 'bg-[var(--color-primary-light)] border-[var(--color-primary)] text-[var(--color-primary)]'
                                                    : 'bg-gray-50 border-gray-200 text-gray-600 hover:bg-gray-100'
                                                }`}
                                            whileHover={{ y: -1, scale: 1.03 }}
                                            whileTap={{ scale: 0.96 }}
                                        >
                                            <span>{emoji}</span>
                                            {users.length > 1 && <span>{users.length}</span>}
                                        </motion.button>
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
