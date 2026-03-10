import { useState, useRef, useEffect } from 'react';
import { useSocket } from '../../hooks/useSocket';
import { useCall } from '../../hooks/useCall';
import { Bot, Send, Loader2, X, Trash2, Languages, FileText, Mic, Monitor, ChevronDown, ChevronUp } from 'lucide-react';

export default function MiniAIChatBox({ roomId, onClose, onAutoTranslateChange }) {
    const { emit, on, off } = useSocket();
    const { callState, localStream, remoteStream, screenSharing, screenStream } = useCall();
    const [input, setInput] = useState('');
    const [messages, setMessages] = useState([]);
    const [thinking, setThinking] = useState(false);
    const [autoTranslate, setAutoTranslate] = useState(false);
    const [callRecord, setCallRecord] = useState(false);
    const [showFeatures, setShowFeatures] = useState(true);
    const messagesEndRef = useRef(null);
    const inputRef = useRef(null);

    // Call recording refs
    const mediaRecorderRef = useRef(null);
    const audioChunksRef = useRef([]);
    const isRecordingRef = useRef(false);

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
                setMessages((prev) => [...prev, { role: 'ai', content: error || '⚠️ AI gặp lỗi, thử lại sau.', id: `err-${Date.now()}`, isError: true }]);
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
    }, [roomId, on, off]);

    // Notify parent about auto-translate changes
    useEffect(() => {
        onAutoTranslateChange?.(autoTranslate);
    }, [autoTranslate, onAutoTranslateChange]);

    // ── Call Recording: start/stop based on callState + callRecord toggle ──
    useEffect(() => {
        // Start recording when call becomes active AND callRecord is enabled
        if (callRecord && callState.active && remoteStream && !isRecordingRef.current) {
            startCallRecording();
        }
        // Stop recording when call ends
        if (isRecordingRef.current && !callState.active) {
            stopCallRecording();
        }
    }, [callState.active, remoteStream, callRecord]);

    // Cleanup recording on unmount
    useEffect(() => {
        return () => {
            if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
                mediaRecorderRef.current.stop();
            }
        };
    }, []);

    const startCallRecording = () => {
        try {
            // Mix local + remote audio into one stream
            const audioCtx = new AudioContext();
            const destination = audioCtx.createMediaStreamDestination();

            if (localStream) {
                const localSource = audioCtx.createMediaStreamSource(localStream);
                localSource.connect(destination);
            }
            if (remoteStream) {
                const remoteSource = audioCtx.createMediaStreamSource(remoteStream);
                remoteSource.connect(destination);
            }

            const mixedStream = destination.stream;
            const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
                ? 'audio/webm;codecs=opus'
                : 'audio/webm';

            const recorder = new MediaRecorder(mixedStream, { mimeType });
            audioChunksRef.current = [];

            recorder.ondataavailable = (e) => {
                if (e.data.size > 0) audioChunksRef.current.push(e.data);
            };

            recorder.onstop = () => {
                const blob = new Blob(audioChunksRef.current, { type: mimeType });
                isRecordingRef.current = false;
                if (blob.size > 0) {
                    summarizeCallAudio(blob);
                }
            };

            recorder.start(1000); // Collect data every second
            mediaRecorderRef.current = recorder;
            isRecordingRef.current = true;

            setMessages((prev) => [...prev, {
                role: 'ai', id: `rec-start-${Date.now()}`,
                content: '🎙️ Đang ghi âm cuộc gọi... Bản tóm tắt sẽ xuất hiện khi kết thúc.'
            }]);

            console.log('[MiniAI] Call recording started');
        } catch (err) {
            console.error('[MiniAI] Failed to start recording:', err);
            setMessages((prev) => [...prev, {
                role: 'ai', id: `rec-err-${Date.now()}`, isError: true,
                content: '⚠️ Không thể ghi âm cuộc gọi: ' + err.message
            }]);
        }
    };

    const stopCallRecording = () => {
        if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
            mediaRecorderRef.current.stop();
            console.log('[MiniAI] Call recording stopped');
        }
    };

    const summarizeCallAudio = async (audioBlob) => {
        setThinking(true);
        setMessages((prev) => [...prev, {
            role: 'ai', id: `rec-processing-${Date.now()}`,
            content: '📋 Cuộc gọi kết thúc. Đang xử lý và tóm tắt...'
        }]);

        try {
            // Convert blob to base64 for socket transmission
            const reader = new FileReader();
            reader.onloadend = () => {
                const base64 = reader.result.split(',')[1];
                emit('ai:summarize-call', {
                    roomId,
                    audioBase64: base64,
                    mimeType: audioBlob.type,
                });
            };
            reader.readAsDataURL(audioBlob);
        } catch (err) {
            setThinking(false);
            setMessages((prev) => [...prev, {
                role: 'ai', id: `rec-fail-${Date.now()}`, isError: true,
                content: '⚠️ Không thể xử lý audio: ' + err.message
            }]);
        }
    };

    const handleSummarize = () => {
        setThinking(true);
        setMessages((prev) => [...prev, {
            role: 'user', content: '📋 Tóm tắt cuộc trò chuyện', id: `user-sum-${Date.now()}`
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
            role: 'user', content: '💻 Phân tích nội dung màn hình đang chia sẻ', id: `user-screen-${Date.now()}`
        }]);
        setThinking(true);
        try {
            const base64 = await captureScreenFrame();
            if (!base64) {
                setThinking(false);
                setMessages((prev) => [...prev, {
                    role: 'ai', id: `err-screen-${Date.now()}`, isError: true,
                    content: '⚠️ Không thể chụp màn hình. Hãy đảm bảo bạn đang chia sẻ màn hình.'
                }]);
                return;
            }
            emit('ai:analyze-screen', { roomId, imageBase64: base64 });
        } catch (err) {
            setThinking(false);
            setMessages((prev) => [...prev, {
                role: 'ai', id: `err-screen-${Date.now()}`, isError: true,
                content: '⚠️ Lỗi khi chụp màn hình: ' + err.message
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

    return (
        <div className="flex flex-col border-b border-purple-200 bg-purple-50/50" style={{ maxHeight: '420px' }}>
            {/* Header */}
            <div className="flex items-center justify-between px-3 py-2 bg-purple-100/80 border-b border-purple-200 shrink-0">
                <div className="flex items-center gap-2">
                    <Bot size={16} className="text-purple-600" />
                    <span className="text-sm font-medium text-purple-700">AI Assistant</span>
                </div>
                <div className="flex items-center gap-1">
                    <button
                        onClick={() => setShowFeatures((v) => !v)}
                        className="p-1 hover:bg-purple-200/60 rounded text-purple-400 hover:text-purple-600 transition"
                        title={showFeatures ? 'Ẩn tính năng' : 'Hiện tính năng'}
                    >
                        {showFeatures ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
                    </button>
                    {messages.length > 0 && (
                        <button
                            onClick={() => setMessages([])}
                            className="p-1 hover:bg-purple-200/60 rounded text-purple-400 hover:text-purple-600 transition"
                            title="Xóa lịch sử"
                        >
                            <Trash2 size={13} />
                        </button>
                    )}
                    <button
                        onClick={onClose}
                        className="p-1 hover:bg-purple-200/60 rounded text-purple-400 hover:text-purple-600 transition"
                        title="Đóng AI"
                    >
                        <X size={14} />
                    </button>
                </div>
            </div>

            {/* Feature Panel */}
            {showFeatures && (
                <div className="px-3 py-2 bg-purple-50 border-b border-purple-200 space-y-1.5 shrink-0">
                    {/* Auto Translate */}
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                            <Languages size={13} className="text-purple-500" />
                            <span className="text-xs text-gray-700">Dịch tự động</span>
                        </div>
                        <button
                            onClick={() => setAutoTranslate((v) => !v)}
                            className={`relative w-8 h-4.5 rounded-full transition-colors ${autoTranslate ? 'bg-purple-500' : 'bg-gray-300'}`}
                        >
                            <span className={`absolute top-0.5 left-0.5 w-3.5 h-3.5 bg-white rounded-full shadow transition-transform ${autoTranslate ? 'translate-x-3.5' : ''}`} />
                        </button>
                    </div>

                    {/* Summarize Button */}
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                            <FileText size={13} className="text-purple-500" />
                            <span className="text-xs text-gray-700">Tóm tắt chat</span>
                        </div>
                        <button
                            onClick={handleSummarize}
                            disabled={thinking}
                            className="text-[10px] px-2 py-0.5 bg-purple-500 text-white rounded-md hover:bg-purple-600 transition disabled:opacity-50"
                        >
                            Tóm tắt
                        </button>
                    </div>

                    {/* Call Record & Summary */}
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                            <Mic size={13} className={`${isRecordingRef.current ? 'text-red-500 animate-pulse' : 'text-purple-500'}`} />
                            <span className="text-xs text-gray-700">
                                Ghi âm & Tóm tắt cuộc gọi
                                {isRecordingRef.current && <span className="text-red-500 text-[10px] ml-1">REC</span>}
                            </span>
                        </div>
                        <button
                            onClick={() => setCallRecord((v) => !v)}
                            disabled={callState.active}
                            title={callState.active ? 'Không thể thay đổi trong cuộc gọi' : ''}
                            className={`relative w-8 h-4.5 rounded-full transition-colors ${callRecord ? 'bg-red-400' : 'bg-gray-300'} ${callState.active ? 'opacity-50 cursor-not-allowed' : ''}`}
                        >
                            <span className={`absolute top-0.5 left-0.5 w-3.5 h-3.5 bg-white rounded-full shadow transition-transform ${callRecord ? 'translate-x-3.5' : ''}`} />
                        </button>
                    </div>

                    {/* Screen Analysis (visible when screen sharing) */}
                    {screenSharing && screenStream && (
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                                <Monitor size={13} className="text-blue-500" />
                                <span className="text-xs text-gray-700">Phân tích màn hình</span>
                            </div>
                            <button
                                onClick={handleAnalyzeScreen}
                                disabled={thinking}
                                className="text-[10px] px-2 py-0.5 bg-blue-500 text-white rounded-md hover:bg-blue-600 transition disabled:opacity-50"
                            >
                                Phân tích
                            </button>
                        </div>
                    )}
                </div>
            )}

            {/* Messages */}
            <div className="flex-1 overflow-y-auto px-3 py-2 space-y-2 scrollbar-thin" style={{ minHeight: '120px', maxHeight: '220px' }}>
                {messages.length === 0 && !thinking && (
                    <div className="flex flex-col items-center justify-center h-full text-purple-400 text-xs text-center gap-2 py-4">
                        <Bot size={24} className="opacity-50" />
                        <div>
                            <p className="font-medium">Hỏi AI bất kỳ điều gì!</p>
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
                                ? 'bg-purple-600 text-white rounded-br-sm'
                                : msg.isError
                                    ? 'bg-red-50 text-red-600 border border-red-200 rounded-bl-sm'
                                    : 'bg-white text-gray-800 border border-purple-100 rounded-bl-sm shadow-sm'
                                }`}
                        >
                            {msg.content}
                        </div>
                    </div>
                ))}

                {thinking && (
                    <div className="flex justify-start">
                        <div className="bg-white border border-purple-100 px-3 py-2 rounded-xl rounded-bl-sm shadow-sm">
                            <div className="flex items-center gap-2 text-purple-500 text-xs">
                                <Loader2 size={12} className="animate-spin" />
                                <span>Đang suy nghĩ...</span>
                            </div>
                        </div>
                    </div>
                )}

                <div ref={messagesEndRef} />
            </div>

            {/* Input */}
            <div className="px-3 py-2 border-t border-purple-200 bg-white/80 shrink-0">
                <div className="flex items-center gap-2">
                    <input
                        ref={inputRef}
                        type="text"
                        value={input}
                        onChange={(e) => setInput(e.target.value)}
                        onKeyDown={handleKeyDown}
                        placeholder="Hỏi AI..."
                        disabled={thinking}
                        className="flex-1 text-sm px-3 py-1.5 border border-purple-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-purple-400 disabled:opacity-50 bg-white"
                    />
                    <button
                        onClick={handleSend}
                        disabled={!input.trim() || thinking}
                        className="p-1.5 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition disabled:opacity-50 disabled:cursor-not-allowed shrink-0"
                    >
                        <Send size={14} />
                    </button>
                </div>
            </div>
        </div>
    );
}
