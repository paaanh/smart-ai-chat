import { useEffect, useRef, useState, useCallback } from 'react';
import { useCall } from '../../hooks/useCall';
import {
    PhoneOff,
    Mic,
    MicOff,
    Video as VideoIcon,
    VideoOff,
    Loader2,
} from 'lucide-react';

export default function CallModal() {
    const {
        callState,
        localStream,
        remoteStream,
        endCall,
        cancelCall,
        toggleAudio,
        toggleVideo,
    } = useCall();

    const localVideoRef = useRef(null);
    const remoteVideoRef = useRef(null);
    const [audioMuted, setAudioMuted] = useState(false);
    const [videoOff, setVideoOff] = useState(false);
    const [callDuration, setCallDuration] = useState(0);
    const [connectionWarning, setConnectionWarning] = useState(false);

    // ── Attach local stream ─────────────────────────────────────
    useEffect(() => {
        const el = localVideoRef.current;
        if (!el) return;
        if (localStream) {
            el.srcObject = localStream;
            el.play().catch(() => { });
        } else {
            el.srcObject = null;
        }
    }, [localStream]);

    // ── Attach remote stream — this is the critical fix ─────────
    useEffect(() => {
        const el = remoteVideoRef.current;
        if (!el) return;
        if (remoteStream) {
            console.log('[CallModal] Assigning remoteStream to <video>, tracks:',
                remoteStream.getTracks().map(t => `${t.kind}:${t.readyState}`).join(', '));
            el.srcObject = remoteStream;
            el.play().catch(() => { });
        } else {
            el.srcObject = null;
        }
    }, [remoteStream]);

    // ── Call timer ──────────────────────────────────────────────
    useEffect(() => {
        if (!callState.active) return;
        const interval = setInterval(() => setCallDuration((d) => d + 1), 1000);
        return () => { clearInterval(interval); setCallDuration(0); };
    }, [callState.active]);

    // ── 10s connection timeout warning ──────────────────────────
    useEffect(() => {
        if (!callState.active || remoteStream) {
            setConnectionWarning(false);
            return;
        }
        const timer = setTimeout(() => setConnectionWarning(true), 10000);
        return () => clearTimeout(timer);
    }, [callState.active, remoteStream]);

    const formatDuration = (seconds) => {
        const m = Math.floor(seconds / 60).toString().padStart(2, '0');
        const s = (seconds % 60).toString().padStart(2, '0');
        return `${m}:${s}`;
    };

    const handleToggleAudio = () => { toggleAudio(); setAudioMuted(!audioMuted); };
    const handleToggleVideo = () => { toggleVideo(); setVideoOff(!videoOff); };

    // Don't render if no active/outgoing call
    if (!callState.active && !callState.outgoing) return null;

    const isVideoCall = callState.callType === 'video';
    // Show the OTHER person's name, not your own
    const displayName = callState.outgoing
        ? (callState.callee?.username || 'Unknown')
        : (callState.caller?.username || 'Unknown');
    const hasRemote = !!remoteStream;

    return (
        <div className="fixed inset-0 bg-black z-50 flex flex-col">
            <div className="flex-1 relative bg-gray-900">
                {/* ─── Remote video: ALWAYS rendered, never unmounted ─── */}
                {isVideoCall && (
                    <video
                        ref={remoteVideoRef}
                        autoPlay
                        playsInline
                        className={`absolute inset-0 w-full h-full object-cover transition-opacity duration-300 ${hasRemote ? 'opacity-100' : 'opacity-0'
                            }`}
                    />
                )}

                {/* ─── Overlay: avatar / "Đang gọi" / duration (shown when no remote stream) ─── */}
                {(!hasRemote || !isVideoCall) && (
                    <div className="absolute inset-0 flex items-center justify-center">
                        <div className="text-center">
                            <div className="w-24 h-24 rounded-full bg-[var(--color-primary)] flex items-center justify-center text-white text-4xl font-bold mx-auto mb-4">
                                {displayName.charAt(0).toUpperCase()}
                            </div>
                            <h2 className="text-white text-xl font-semibold">{displayName}</h2>
                            {callState.outgoing && !callState.active && (
                                <div className="flex items-center gap-2 text-gray-400 mt-2 justify-center">
                                    <Loader2 size={16} className="animate-spin" />
                                    <span>Đang gọi...</span>
                                </div>
                            )}
                            {callState.active && !hasRemote && !connectionWarning && (
                                <div className="flex items-center gap-2 text-gray-400 mt-2 justify-center">
                                    <Loader2 size={16} className="animate-spin" />
                                    <span>Đang kết nối video...</span>
                                </div>
                            )}
                            {callState.active && !hasRemote && connectionWarning && (
                                <p className="text-yellow-400 mt-2 text-sm">Kết nối kém, vui lòng thử lại</p>
                            )}
                            {callState.active && hasRemote && !isVideoCall && (
                                <p className="text-gray-400 mt-2">{formatDuration(callDuration)}</p>
                            )}
                        </div>
                    </div>
                )}

                {/* ─── Local video (PiP): ALWAYS rendered when video call ─── */}
                {isVideoCall && (
                    <div className={`absolute top-4 right-4 w-32 h-44 rounded-xl overflow-hidden shadow-lg border-2 border-white/20 ${localStream ? '' : 'hidden'
                        }`}>
                        <video
                            ref={localVideoRef}
                            autoPlay
                            playsInline
                            muted
                            className="w-full h-full object-cover"
                            style={{ transform: 'scaleX(-1)' }}
                        />
                    </div>
                )}

                {/* Duration overlay for active video call */}
                {isVideoCall && callState.active && hasRemote && (
                    <div className="absolute top-4 left-4 bg-black/50 px-3 py-1 rounded-full text-white text-sm">
                        {formatDuration(callDuration)}
                    </div>
                )}
            </div>

            {/* ─── Controls ─── */}
            <div className="bg-gray-900/80 py-6 px-4">
                <div className="flex items-center justify-center gap-6">
                    <button
                        onClick={handleToggleAudio}
                        className={`p-4 rounded-full transition ${audioMuted ? 'bg-red-500 text-white' : 'bg-white/10 text-white hover:bg-white/20'}`}
                    >
                        {audioMuted ? <MicOff size={22} /> : <Mic size={22} />}
                    </button>

                    {isVideoCall && (
                        <button
                            onClick={handleToggleVideo}
                            className={`p-4 rounded-full transition ${videoOff ? 'bg-red-500 text-white' : 'bg-white/10 text-white hover:bg-white/20'}`}
                        >
                            {videoOff ? <VideoOff size={22} /> : <VideoIcon size={22} />}
                        </button>
                    )}

                    <button
                        onClick={callState.active ? endCall : cancelCall}
                        className="p-4 bg-red-600 hover:bg-red-700 text-white rounded-full transition"
                    >
                        <PhoneOff size={22} />
                    </button>
                </div>
            </div>
        </div>
    );
}
