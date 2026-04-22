import { useState, useRef, useEffect } from 'react';
import { useSocket } from '../../hooks/useSocket';
import { useCall } from '../../hooks/useCall';
import { useTheme } from '../../hooks/useTheme';
import { useLanguage } from '../../hooks/useLanguage';
import { Bot, Send, Loader2, X, Trash2, Languages, FileText, Monitor, ChevronDown, ChevronUp } from 'lucide-react';

export default function MiniAIChatBox({ roomId, onClose, onAutoTranslateChange }) {
    const { emit, on, off } = useSocket();
    const { callState, localStream, remoteStream, screenSharing, screenStream } = useCall();
    const { themeId } = useTheme();
    const { t } = useLanguage();
    const [input, setInput] = useState('');
    const [messages, setMessages] = useState([]);
    const [thinking, setThinking] = useState(false);
    const [autoTranslate, setAutoTranslate] = useState(false);
    const [showFeatures, setShowFeatures] = useState(true);
    const messagesEndRef = useRef(null);
    const inputRef = useRef(null);

    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages, thinking]);

    useEffect(() => {
        inputRef.current?.focus();
    }, []);

    // Socket listeners for AI responses
    useEffect(() => {
        if (!roomId) return;

        const handleAIChatResponse = ({ roomId: rid, message }) => {
            if (rid === roomId) {
                setThinking(false);
                setMessages((prev) => [...prev, { role: 'ai', content: message.content, id: message._id }]);
            }
        };

        const handleAIThinking = ({ roomId: rid }) => {
            if (rid === roomId) setThinking(true);
        };

        const handleAIThinkingDone = ({ roomId: rid }) => {
            if (rid === roomId) setThinking(false);
        };

        const handleAIError = ({ roomId: rid, error }) => {
            if (rid === roomId) {
                setThinking(false);
                setMessages((prev) => [...prev, { role: 'ai', content: error || t('miniAi.aiError'), id: `err-${Date.now()}`, isError: true }]);
            }
        };

        on('ai:chat-response', handleAIChatResponse);
        on('ai:thinking', handleAIThinking);
        on('ai:thinking-done', handleAIThinkingDone);
        on('ai:error', handleAIError);

        return () => {
            off('ai:chat-response', handleAIChatResponse);
            off('ai:thinking', handleAIThinking);
            off('ai:thinking-done', handleAIThinkingDone);
            off('ai:error', handleAIError);
        };
    }, [roomId, on, off, t]);

    // Notify parent about auto-translate changes
    useEffect(() => {
        onAutoTranslateChange?.(autoTranslate);
    }, [autoTranslate, onAutoTranslateChange]);



    const handleSummarize = () => {
        setThinking(true);
        setMessages((prev) => [...prev, {
            role: 'user', content: t('miniAi.summarizeConversationRequest'), id: `user-sum-${Date.now()}`
        }]);
        emit('ai:summarize', { roomId, messageCount: 20 });
    };

    // ── Screen analysis: capture a frame from screen share and send to AI ──
    const captureScreenFrame = () => {
        const stream = screenStream;
        if (!stream) return null;
        const track = stream.getVideoTracks()[0];
        if (!track || track.readyState !== 'live') return null;
        const canvas = document.createElement('canvas');
        const video = document.createElement('video');
        video.srcObject = stream;
        video.muted = true;
        return new Promise((resolve) => {
            video.onloadedmetadata = () => {
                canvas.width = video.videoWidth;
                canvas.height = video.videoHeight;
                video.play().then(() => {
                    canvas.getContext('2d').drawImage(video, 0, 0);
                    const dataUrl = canvas.toDataURL('image/jpeg', 0.8);
                    const base64 = dataUrl.split(',')[1];
                    video.srcObject = null;
                    resolve(base64);
                });
            };
        });
    };

    const handleAnalyzeScreen = async () => {
        if (thinking) return;
        setMessages((prev) => [...prev, {
            role: 'user', content: t('miniAi.screenAnalysisRequest'), id: `user-screen-${Date.now()}`
        }]);
        setThinking(true);
        try {
            const base64 = await captureScreenFrame();
            if (!base64) {
                setThinking(false);
                setMessages((prev) => [...prev, {
                    role: 'ai', id: `err-screen-${Date.now()}`, isError: true,
                    content: t('miniAi.screenCaptureError')
                }]);
                return;
            }
            emit('ai:analyze-screen', { roomId, imageBase64: base64 });
        } catch (err) {
            setThinking(false);
            setMessages((prev) => [...prev, {
                role: 'ai', id: `err-screen-${Date.now()}`, isError: true,
                content: t('miniAi.screenCaptureErrorPrefix') + err.message
            }]);
        }
    };

    const handleSend = () => {
        const text = input.trim();
        if (!text || thinking) return;

        setMessages((prev) => [...prev, { role: 'user', content: text, id: `user-${Date.now()}` }]);
        setInput('');
        setThinking(true);
        emit('ai:chat', { roomId, message: text });
    };

    const handleKeyDown = (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleSend();
        }
    };

    const isInCall = callState.active || callState.outgoing || callState.incoming;
    const isPixelTheme = themeId === 'pixel-art';
    const isNeonTheme = themeId === 'neon-night';

    return (
        <div
            className={`flex flex-col border-b ${isPixelTheme ? 'font-pixel' : ''}`}
            style={{
                maxHeight: '420px',
                borderColor: 'var(--border-color)',
                background: 'color-mix(in srgb, var(--bg-card) 88%, transparent)',
            }}
        >
            {/* Header */}
            <div
                className="flex items-center justify-between px-3 py-2 border-b shrink-0"
                style={{
                    borderColor: 'var(--border-color)',
                    background: isNeonTheme
                        ? 'linear-gradient(120deg, color-mix(in srgb, var(--color-primary) 22%, transparent), color-mix(in srgb, var(--bg-secondary) 85%, transparent))'
                        : 'var(--bg-secondary)',
                }}
            >
                <div className="flex items-center gap-2">
                    <Bot size={16} style={{ color: 'var(--color-primary)' }} />
                    <span className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>{t('miniAi.title')}</span>
                </div>
                <div className="flex items-center gap-1">
                    <button
                        onClick={() => setShowFeatures((v) => !v)}
                        className="p-1 rounded transition"
                        style={{ color: 'var(--text-tertiary)' }}
                        title={showFeatures ? t('miniAi.hideFeatures') : t('miniAi.showFeatures')}
                    >
                        {showFeatures ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
                    </button>
                    {messages.length > 0 && (
                        <button
                            onClick={() => setMessages([])}
                            className="p-1 rounded transition"
                            style={{ color: 'var(--text-tertiary)' }}
                            title={t('miniAi.clearHistory')}
                        >
                            <Trash2 size={13} />
                        </button>
                    )}
                    <button
                        onClick={onClose}
                        className="p-1 rounded transition"
                        style={{ color: 'var(--text-tertiary)' }}
                        title={t('miniAi.closeAi')}
                    >
                        <X size={14} />
                    </button>
                </div>
            </div>

            {/* Feature Panel */}
            {showFeatures && (
                <div
                    className="px-3 py-2 border-b space-y-1.5 shrink-0"
                    style={{
                        borderColor: 'var(--border-color)',
                        background: 'color-mix(in srgb, var(--bg-secondary) 70%, var(--bg-card) 30%)',
                    }}
                >
                    {/* Auto Translate */}
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                            <Languages size={13} style={{ color: 'var(--color-primary)' }} />
                            <span className="text-xs" style={{ color: 'var(--text-secondary)' }}>{t('miniAi.autoTranslate')}</span>
                        </div>
                        <button
                            onClick={() => setAutoTranslate((v) => !v)}
                            className="relative w-8 h-4.5 rounded-full transition-colors"
                            style={{ backgroundColor: autoTranslate ? 'var(--color-primary)' : '#9ca3af' }}
                        >
                            <span className={`absolute top-0.5 left-0.5 w-3.5 h-3.5 bg-white rounded-full shadow transition-transform ${autoTranslate ? 'translate-x-3.5' : ''}`} />
                        </button>
                    </div>

                    {/* Summarize Button */}
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                            <FileText size={13} style={{ color: 'var(--color-primary)' }} />
                            <span className="text-xs" style={{ color: 'var(--text-secondary)' }}>{t('miniAi.summarizeChat')}</span>
                        </div>
                        <button
                            onClick={handleSummarize}
                            disabled={thinking}
                            className="text-[10px] px-2 py-0.5 text-white rounded-md transition disabled:opacity-50"
                            style={{ backgroundColor: 'var(--color-primary)' }}
                        >
                            {t('miniAi.summarize')}
                        </button>
                    </div>



                    {/* Screen Analysis (visible when screen sharing) */}
                    {screenSharing && screenStream && (
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                                <Monitor size={13} className="text-blue-500" />
                                <span className="text-xs" style={{ color: 'var(--text-secondary)' }}>{t('miniAi.analyzeScreen')}</span>
                            </div>
                            <button
                                onClick={handleAnalyzeScreen}
                                disabled={thinking}
                                className="text-[10px] px-2 py-0.5 bg-blue-500 text-white rounded-md hover:bg-blue-600 transition disabled:opacity-50"
                            >
                                {t('miniAi.analyze')}
                            </button>
                        </div>
                    )}
                </div>
            )}

            {/* Messages */}
            <div className="flex-1 overflow-y-auto px-3 py-2 space-y-2 scrollbar-thin" style={{ minHeight: '120px', maxHeight: '220px' }}>
                {messages.length === 0 && !thinking && (
                    <div className="flex flex-col items-center justify-center h-full text-xs text-center gap-2 py-4" style={{ color: 'var(--text-tertiary)' }}>
                        <Bot size={24} className="opacity-50" />
                        <div>
                            <p className="font-medium">{t('miniAi.askAnything')}</p>
                            <p className="mt-1 opacity-75">"Dịch câu trên sang tiếng Anh"</p>
                        </div>
                    </div>
                )}

                {messages.map((msg) => (
                    <div
                        key={msg.id}
                        className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
                    >
                        <div
                            className={`max-w-[85%] px-3 py-1.5 rounded-xl text-sm whitespace-pre-wrap ${msg.role === 'user'
                                ? 'text-white rounded-br-sm'
                                : msg.isError
                                    ? 'bg-red-50 text-red-600 border border-red-200 rounded-bl-sm'
                                    : 'rounded-bl-sm shadow-sm'
                                }`}
                            style={msg.role === 'user'
                                ? { backgroundColor: 'var(--color-primary)' }
                                : msg.isError
                                    ? undefined
                                    : { backgroundColor: 'var(--bg-card)', color: 'var(--text-primary)', borderColor: 'var(--border-color)' }}
                        >
                            {msg.content}
                        </div>
                    </div>
                ))}

                {thinking && (
                    <div className="flex justify-start">
                        <div className="px-3 py-2 rounded-xl rounded-bl-sm shadow-sm border" style={{ backgroundColor: 'var(--bg-card)', borderColor: 'var(--border-color)' }}>
                            <div className="flex items-center gap-2 text-xs" style={{ color: 'var(--color-primary)' }}>
                                <Loader2 size={12} className="animate-spin" />
                                <span>{t('miniAi.thinking')}</span>
                            </div>
                        </div>
                    </div>
                )}

                <div ref={messagesEndRef} />
            </div>

            {/* Input */}
            <div className="px-3 py-2 border-t shrink-0" style={{ borderColor: 'var(--border-color)', backgroundColor: 'var(--bg-card)' }}>
                <div className="flex items-center gap-2">
                    <input
                        ref={inputRef}
                        type="text"
                        value={input}
                        onChange={(e) => setInput(e.target.value)}
                        onKeyDown={handleKeyDown}
                        placeholder={t('miniAi.inputPlaceholder')}
                        disabled={thinking}
                        className="flex-1 text-sm px-3 py-1.5 border rounded-lg focus:outline-none focus:ring-1 disabled:opacity-50"
                        style={{ borderColor: 'var(--border-color)', backgroundColor: 'var(--bg-input)', color: 'var(--text-primary)' }}
                    />
                    <button
                        onClick={handleSend}
                        disabled={!input.trim() || thinking}
                        className="p-1.5 text-white rounded-lg transition disabled:opacity-50 disabled:cursor-not-allowed shrink-0"
                        style={{ backgroundColor: 'var(--color-primary)' }}
                    >
                        <Send size={14} />
                    </button>
                </div>
            </div>
        </div>
    );
}
