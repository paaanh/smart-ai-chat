import { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import { Send, Paperclip, Smile, X, Loader2, MapPin, Mic, Square, ThumbsUp, Lock } from 'lucide-react';
import { uploadAPI } from '../../services/api';
import { useLockCountdown } from '../../hooks/useLockCountdown';
import { emitToast } from '../../utils/toast';

export default function MessageInput({ onSend, onSendLocation, onTyping, disabled, lockUntil, onLockExpire, replyContext, onCancelReply }) {
    const { isLocked, timeDisplay } = useLockCountdown(lockUntil);
    const [text, setText] = useState('');
    const [file, setFile] = useState(null);
    const [uploading, setUploading] = useState(false);
    const [isDraggingFile, setIsDraggingFile] = useState(false);
    const fileInputRef = useRef(null);
    const inputRef = useRef(null);
    const dragDepthRef = useRef(0);

    // Voice recording state
    const [recording, setRecording] = useState(false);
    const [recordingTime, setRecordingTime] = useState(0);
    const mediaRecorderRef = useRef(null);
    const chunksRef = useRef([]);
    const timerRef = useRef(null);
    const streamRef = useRef(null);

    // Image preview URL
    const previewUrl = useMemo(() => {
        if (file && file.type?.startsWith('image/')) return URL.createObjectURL(file);
        return null;
    }, [file]);

    // Cleanup object URL
    useEffect(() => {
        return () => { if (previewUrl) URL.revokeObjectURL(previewUrl); };
    }, [previewUrl]);

    // Paste image handler
    const handlePaste = (e) => {
        const items = e.clipboardData?.items;
        if (!items) return;
        for (const item of items) {
            if (item.type.startsWith('image/')) {
                e.preventDefault();
                const pastedFile = item.getAsFile();
                if (pastedFile) setFile(pastedFile);
                return;
            }
        }
    };

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
                emitToast('Upload file thành công.', { type: 'success' });
            } catch (err) {
                console.error('Upload error:', err);
                emitToast('Upload file thất bại. Vui lòng thử lại.', { type: 'error' });
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

    const applySelectedFile = useCallback((selectedFile) => {
        if (!selectedFile) return;
        if (selectedFile.size > 50 * 1024 * 1024) {
            emitToast('File tối đa 50MB.', { type: 'error' });
            return;
        }
        setFile(selectedFile);
    }, []);

    const handleFileSelect = (e) => {
        const f = e.target.files?.[0];
        applySelectedFile(f);
    };

    const hasFilePayload = (event) => Array.from(event.dataTransfer?.types || []).includes('Files');

    const handleDragEnter = (e) => {
        if (!hasFilePayload(e)) return;
        e.preventDefault();
        e.stopPropagation();
        dragDepthRef.current += 1;
        setIsDraggingFile(true);
    };

    const handleDragOver = (e) => {
        if (!hasFilePayload(e)) return;
        e.preventDefault();
        e.stopPropagation();
    };

    const handleDragLeave = (e) => {
        if (!hasFilePayload(e)) return;
        e.preventDefault();
        e.stopPropagation();
        dragDepthRef.current = Math.max(0, dragDepthRef.current - 1);
        if (dragDepthRef.current === 0) {
            setIsDraggingFile(false);
        }
    };

    const handleDrop = (e) => {
        if (!hasFilePayload(e)) return;
        e.preventDefault();
        e.stopPropagation();
        dragDepthRef.current = 0;
        setIsDraggingFile(false);
        const droppedFile = e.dataTransfer?.files?.[0];
        applySelectedFile(droppedFile);
    };

    // ── Voice recording helpers ────────────────────────────────────
    const stopStream = useCallback(() => {
        if (streamRef.current) {
            streamRef.current.getTracks().forEach(t => t.stop());
            streamRef.current = null;
        }
        if (timerRef.current) {
            clearInterval(timerRef.current);
            timerRef.current = null;
        }
    }, []);

    const startRecording = useCallback(async () => {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            streamRef.current = stream;

            const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
                ? 'audio/webm;codecs=opus'
                : 'audio/webm';
            const recorder = new MediaRecorder(stream, { mimeType });
            mediaRecorderRef.current = recorder;
            chunksRef.current = [];

            recorder.ondataavailable = (e) => {
                if (e.data.size > 0) chunksRef.current.push(e.data);
            };

            recorder.start();
            setRecording(true);
            setRecordingTime(0);
            timerRef.current = setInterval(() => setRecordingTime(t => t + 1), 1000);
        } catch {
            alert('Không thể truy cập micro.\nVui lòng vào Cài đặt trình duyệt → Quyền riêng tư → Micro để bật lại.');
        }
    }, []);

    const cancelRecording = useCallback(() => {
        if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
            mediaRecorderRef.current.onstop = null;
            mediaRecorderRef.current.stop();
        }
        stopStream();
        chunksRef.current = [];
        setRecording(false);
        setRecordingTime(0);
    }, [stopStream]);

    const sendRecording = useCallback(() => {
        const recorder = mediaRecorderRef.current;
        if (!recorder || recorder.state === 'inactive') return;

        recorder.onstop = async () => {
            stopStream();
            const blob = new Blob(chunksRef.current, { type: 'audio/webm' });
            chunksRef.current = [];
            setRecording(false);
            setRecordingTime(0);

            if (blob.size === 0) return;

            setUploading(true);
            try {
                const formData = new FormData();
                formData.append('file', blob, `voice_${Date.now()}.webm`);
                const { data } = await uploadAPI.uploadFile(formData);
                onSend(data.file.name, 'file', data.file);
                emitToast('Đã gửi ghi âm thành công.', { type: 'success' });
            } catch (err) {
                console.error('Voice upload error:', err);
                emitToast('Gửi ghi âm thất bại. Vui lòng thử lại.', { type: 'error' });
            } finally {
                setUploading(false);
            }
        };
        recorder.stop();
    }, [onSend, stopStream]);

    // Cleanup on unmount
    useEffect(() => {
        return () => {
            cancelRecording();
        };
    }, [cancelRecording]);

    // Auto re-enable when lock expires
    useEffect(() => {
        if (!isLocked && lockUntil) {
            onLockExpire?.();
        }
    }, [isLocked]); // eslint-disable-line react-hooks/exhaustive-deps

    useEffect(() => {
        if (replyContext) {
            inputRef.current?.focus();
        }
    }, [replyContext]);

    const formatRecordTime = (sec) => {
        const m = Math.floor(sec / 60);
        const s = sec % 60;
        return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
    };

    return (
        <div className="border-t border-gray-200 bg-white p-3">
            {/* Lock countdown banner */}
            {isLocked && (
                <div className="flex items-center gap-2 bg-orange-50 border border-orange-200 rounded-xl px-4 py-3">
                    <Lock size={16} className="text-orange-500 shrink-0" />
                    <p className="text-sm text-orange-700 flex-1">
                        Bạn bị khóa. Thời gian còn lại:{' '}
                        <span className="font-mono font-bold">{timeDisplay}</span>
                    </p>
                </div>
            )}
            {!isLocked && (
            <>
            {/* Quick reply banner */}
            {replyContext && (
                <div className="flex items-start gap-2 mb-2 bg-[var(--color-primary-light)] border border-[var(--color-primary-medium)] px-3 py-2 rounded-lg">
                    <div className="flex-1 min-w-0">
                        <p className="text-xs text-[var(--color-primary)] font-semibold">
                            Trả lời {replyContext.senderName}
                        </p>
                        <p className="text-xs text-[var(--color-primary-dark)] truncate">
                            {replyContext.preview}
                        </p>
                    </div>
                    <button
                        type="button"
                        onClick={onCancelReply}
                        className="text-[var(--color-primary)] hover:text-[var(--color-primary-hover)]"
                        title="Hủy trả lời"
                    >
                        <X size={15} />
                    </button>
                </div>
            )}

            {/* File preview */}
            {file && (
                <div className="flex items-center gap-2 mb-2 bg-gray-50 px-3 py-2 rounded-lg">
                    {previewUrl ? (
                        <img src={previewUrl} alt="preview" className="w-16 h-16 object-cover rounded-md" />
                    ) : (
                        <Paperclip size={14} className="text-gray-500" />
                    )}
                    <span className="text-sm text-gray-700 truncate flex-1">{file.name}</span>
                    <span className="text-xs text-gray-400">{(file.size / 1024 / 1024).toFixed(1)} MB</span>
                    <button onClick={() => setFile(null)} className="text-gray-400 hover:text-red-500">
                        <X size={16} />
                    </button>
                </div>
            )}

            {recording ? (
                <div className="flex items-center gap-2">
                    <button
                        type="button"
                        onClick={cancelRecording}
                        className="p-2 text-gray-400 hover:text-red-500 hover:bg-gray-100 rounded-full transition shrink-0"
                        title="Hủy ghi âm"
                    >
                        <X size={20} />
                    </button>

                    <div className="flex-1 flex items-center gap-3 bg-red-50 px-4 py-2.5 rounded-2xl">
                        <span className="w-2.5 h-2.5 bg-red-500 rounded-full animate-pulse" />
                        <span className="text-sm font-medium text-red-600">{formatRecordTime(recordingTime)}</span>
                        <span className="text-xs text-red-400">Đang ghi âm...</span>
                    </div>

                    <button
                        type="button"
                        onClick={sendRecording}
                        className="p-2.5 bg-[var(--color-primary)] text-white rounded-full hover:bg-[var(--color-primary-hover)] transition shrink-0"
                        title="Gửi ghi âm"
                    >
                        <Send size={18} />
                    </button>
                </div>
            ) : (
                <form
                    onSubmit={handleSubmit}
                    className={`relative flex items-end gap-2 rounded-2xl transition ${isDraggingFile ? 'ring-2 ring-[var(--color-primary-ring)] bg-[var(--color-primary-light)]/40 p-1.5' : ''}`}
                    onDragEnter={handleDragEnter}
                    onDragOver={handleDragOver}
                    onDragLeave={handleDragLeave}
                    onDrop={handleDrop}
                >
                    {isDraggingFile && (
                        <div className="absolute inset-0 z-20 flex items-center justify-center rounded-2xl border-2 border-dashed border-[var(--color-primary)] bg-white/90 text-sm font-medium text-[var(--color-primary)] pointer-events-none">
                            Thả file vào đây để gửi
                        </div>
                    )}
                    {/* File button */}
                    <button
                        type="button"
                        onClick={() => fileInputRef.current?.click()}
                        className="p-2 text-gray-400 hover:text-[var(--color-primary)] hover:bg-gray-100 rounded-full transition shrink-0"
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

                    {/* Location button */}
                    <button
                        type="button"
                        onClick={() => {
                            if (!navigator.geolocation) {
                                alert('Trình duyệt của bạn không hỗ trợ định vị.');
                                return;
                            }
                            navigator.geolocation.getCurrentPosition(
                                (pos) => {
                                    onSendLocation?.(pos.coords.latitude, pos.coords.longitude);
                                },
                                (err) => {
                                    if (err.code === 1) {
                                        alert('Bạn đã từ chối quyền truy cập vị trí.\nVui lòng vào Cài đặt trình duyệt → Quyền riêng tư → Vị trí để bật lại.');
                                    } else {
                                        alert('Không thể lấy vị trí. Vui lòng thử lại.');
                                    }
                                },
                                { enableHighAccuracy: true, timeout: 10000 }
                            );
                        }}
                        className="p-2 text-gray-400 hover:text-[var(--color-primary)] hover:bg-gray-100 rounded-full transition shrink-0"
                        disabled={disabled}
                        title="Chia sẻ vị trí"
                    >
                        <MapPin size={20} />
                    </button>

                    {/* Mic button */}
                    <button
                        type="button"
                        onClick={startRecording}
                        className="p-2 text-gray-400 hover:text-[var(--color-primary)] hover:bg-gray-100 rounded-full transition shrink-0"
                        disabled={disabled}
                        title="Ghi âm giọng nói"
                    >
                        <Mic size={20} />
                    </button>

                    {/* Text input */}
                    <div className="flex-1 relative">
                        <textarea
                            ref={inputRef}
                            value={text}
                            onChange={handleChange}
                            onKeyDown={handleKeyDown}
                            onPaste={handlePaste}
                            placeholder={replyContext ? `Trả lời ${replyContext.senderName}...` : 'Nhập tin nhắn...'}
                            disabled={disabled}
                            rows={1}
                            className="w-full resize-none px-4 py-2.5 bg-gray-100 rounded-2xl text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-primary-ring)] transition max-h-32 disabled:opacity-50"
                            style={{ minHeight: '42px' }}
                        />
                    </div>

                    {/* Send or Like button */}
                    {text.trim() || file ? (
                        <button
                            type="submit"
                            disabled={disabled || uploading}
                            className="p-2.5 bg-[var(--color-primary)] text-white rounded-full hover:bg-[var(--color-primary-hover)] transition disabled:opacity-50 disabled:hover:bg-[var(--color-primary)] shrink-0"
                        >
                            {uploading ? (
                                <Loader2 size={18} className="animate-spin" />
                            ) : (
                                <Send size={18} />
                            )}
                        </button>
                    ) : (
                        <button
                            type="button"
                            onClick={() => onSend('👍', 'text')}
                            disabled={disabled}
                            className="p-2.5 text-[var(--color-primary)] hover:bg-gray-100 rounded-full transition disabled:opacity-50 shrink-0"
                            title="Gửi like"
                        >
                            <ThumbsUp size={22} />
                        </button>
                    )}
                </form>
            )}
            </>
            )}
        </div>
    );
}
