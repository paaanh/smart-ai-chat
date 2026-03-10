import { useEffect, useRef, useState, useMemo } from 'react';
import { useCall } from '../../hooks/useCall';
import {
    PhoneOff,
    Mic,
    MicOff,
    Video as VideoIcon,
    VideoOff,
    ScreenShare,
    ScreenShareOff,
    Minimize2,
    Maximize2,
    Loader2,
    UserPlus,
    X,
} from 'lucide-react';

// ── Smart grid: returns inline style for CSS Grid ──
// Even counts → perfectly symmetric. Odd counts → last item centered.
function getGridStyle(count) {
    if (count <= 1) return { display: 'grid', gridTemplateColumns: '1fr', gap: '4px' };
    if (count === 2) return { display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '4px' };
    const cols = count <= 4 ? 2 : count <= 9 ? 3 : 4;
    return { display: 'grid', gridTemplateColumns: `repeat(${cols}, 1fr)`, gap: '4px' };
}
// Should the last tile be centered? (odd count with cols >= 2)
function shouldCenterLast(count) {
    if (count <= 2) return false;
    const cols = count <= 4 ? 2 : count <= 9 ? 3 : 4;
    return count % cols !== 0;
}
function getLastItemStyle(count) {
    const cols = count <= 4 ? 2 : count <= 9 ? 3 : 4;
    const remainder = count % cols;
    // Center the last item by spanning the remaining empty columns
    // gridColumn: start at column that centers, span 1
    const startCol = Math.floor((cols - remainder) / 2) + 1;
    return { gridColumn: `${startCol} / span 1` };
}

// ── Single video tile component with speaking glow ──
function VideoTile({ stream, label, muted = false, mirror = false, isAudioOnly = false, avatar, style }) {
    const videoRef = useRef(null);
    const [isSpeaking, setIsSpeaking] = useState(false);

    useEffect(() => {
        const el = videoRef.current;
        if (!el) return;
        if (stream) {
            el.srcObject = stream;
            el.play().catch(() => { });
        } else {
            el.srcObject = null;
        }
    }, [stream]);

    // Speaking detection via audio analyser
    useEffect(() => {
        if (!stream || muted) return;
        const audioTracks = stream.getAudioTracks();
        if (!audioTracks.length) return;
        let ctx;
        try { ctx = new AudioContext(); } catch { return; }
        const source = ctx.createMediaStreamSource(stream);
        const analyser = ctx.createAnalyser();
        analyser.fftSize = 256;
        analyser.smoothingTimeConstant = 0.5;
        source.connect(analyser);
        const data = new Uint8Array(analyser.frequencyBinCount);
        let raf;
        const check = () => {
            analyser.getByteFrequencyData(data);
            const avg = data.reduce((a, b) => a + b, 0) / data.length;
            setIsSpeaking(avg > 18);
            raf = requestAnimationFrame(check);
        };
        check();
        return () => { cancelAnimationFrame(raf); ctx.close(); };
    }, [stream, muted]);

    const hasVideoTrack = stream?.getVideoTracks()?.some(t => t.enabled && t.readyState === 'live');

    return (
        <div
            className={`relative bg-gray-800 rounded-xl overflow-hidden min-h-0 transition-shadow duration-300 ${isSpeaking ? 'ring-2 ring-green-400 shadow-[0_0_18px_rgba(74,222,128,0.45)]' : ''
                }`}
            style={style}
        >
            {stream && (hasVideoTrack && !isAudioOnly) ? (
                <video
                    ref={videoRef}
                    autoPlay
                    playsInline
                    muted={muted}
                    className="w-full h-full object-cover"
                    style={mirror ? { transform: 'scaleX(-1)' } : undefined}
                />
            ) : (
                <div className="w-full h-full flex items-center justify-center bg-linear-to-br from-gray-700 to-gray-900">
                    <div className="w-16 h-16 rounded-full bg-blue-500 flex items-center justify-center text-white text-2xl font-bold overflow-hidden">
                        {avatar ? (
                            <img src={avatar} alt={label} className="w-full h-full object-cover" />
                        ) : (
                            (label || '?').charAt(0).toUpperCase()
                        )}
                    </div>
                </div>
            )}
            {/* Hidden video still playing for audio */}
            {stream && !hasVideoTrack && (
                <video ref={videoRef} autoPlay playsInline muted={muted} className="hidden" />
            )}
            <div className="absolute bottom-2 left-2 bg-black/50 px-2 py-0.5 rounded-full text-white text-[11px] backdrop-blur-sm flex items-center gap-1.5">
                {isSpeaking && <span className="w-2 h-2 bg-green-400 rounded-full animate-pulse" />}
                {label}
            </div>
        </div>
    );
}

export default function CallModal() {
    const {
        callState,
        localStream,
        remoteStream,
        remoteStreams,
        participants,
        callError,
        screenSharing,
        screenStream,
        remoteScreenSharing,
        pipMode,
        setPipMode,
        endCall,
        cancelCall,
        inviteMember,
        toggleAudio,
        toggleVideo,
        toggleScreenShare,
    } = useCall();

    const remoteAudioRef = useRef(null);
    const screenVideoRef = useRef(null);
    const [audioMuted, setAudioMuted] = useState(false);
    const [videoOff, setVideoOff] = useState(false);
    const [callDuration, setCallDuration] = useState(0);
    const [connectionWarning, setConnectionWarning] = useState(false);
    const [showControls, setShowControls] = useState(true);
    const [showInvitePanel, setShowInvitePanel] = useState(false);
    const controlsTimerRef = useRef(null);

    const isGroup = callState.isGroup;

    // ── For 1-1 backward compat ──
    const localVideoRef = useRef(null);
    const remoteVideoRef = useRef(null);

    // Attach local stream (1-1)
    useEffect(() => {
        const el = localVideoRef.current;
        if (!el) return;
        if (localStream) { el.srcObject = localStream; el.play().catch(() => { }); }
        else { el.srcObject = null; }
    }, [localStream]);

    // Attach remote stream (1-1)
    useEffect(() => {
        const el = remoteVideoRef.current;
        if (!el) return;
        if (remoteStream) { el.srcObject = remoteStream; el.play().catch(() => { }); }
        else { el.srcObject = null; }
    }, [remoteStream]);

    // Attach remote audio (1-1)
    useEffect(() => {
        const el = remoteAudioRef.current;
        if (!el) return;
        if (remoteStream) { el.srcObject = remoteStream; el.play().catch(() => { }); }
        else { el.srcObject = null; }
    }, [remoteStream]);

    // Attach screen share stream
    useEffect(() => {
        const el = screenVideoRef.current;
        if (!el) return;
        if (screenStream) { el.srcObject = screenStream; el.play().catch(() => { }); }
        else { el.srcObject = null; }
    }, [screenStream]);

    // Determine if we have any remote connection
    const hasRemote = isGroup
        ? Object.keys(remoteStreams).length > 0
        : !!remoteStream;

    // Call timer
    useEffect(() => {
        if (!callState.active || !hasRemote) return;
        const interval = setInterval(() => setCallDuration((d) => d + 1), 1000);
        return () => { clearInterval(interval); setCallDuration(0); };
    }, [callState.active, hasRemote]);

    // Connection timeout warning
    useEffect(() => {
        if (!callState.active || hasRemote) return;
        const timer = setTimeout(() => setConnectionWarning(true), 10000);
        return () => { clearTimeout(timer); setConnectionWarning(false); };
    }, [callState.active, hasRemote]);

    // Auto-hide controls
    useEffect(() => {
        if (pipMode) return;
        const resetTimer = () => {
            setShowControls(true);
            if (controlsTimerRef.current) clearTimeout(controlsTimerRef.current);
            controlsTimerRef.current = setTimeout(() => setShowControls(false), 3500);
        };
        resetTimer();
        window.addEventListener('mousemove', resetTimer);
        window.addEventListener('touchstart', resetTimer);
        return () => {
            window.removeEventListener('mousemove', resetTimer);
            window.removeEventListener('touchstart', resetTimer);
            if (controlsTimerRef.current) clearTimeout(controlsTimerRef.current);
        };
    }, [pipMode]);

    const formatDuration = (seconds) => {
        const m = Math.floor(seconds / 60).toString().padStart(2, '0');
        const s = (seconds % 60).toString().padStart(2, '0');
        return `${m}:${s}`;
    };

    const handleToggleAudio = () => { toggleAudio(); setAudioMuted(!audioMuted); };
    const handleToggleVideo = () => { toggleVideo(); setVideoOff(!videoOff); };

    const isVideoCall = callState.callType === 'video';
    const otherPerson = callState.outgoing ? callState.callee : callState.caller;
    const displayName = isGroup
        ? (callState.roomName || 'Cuộc gọi nhóm')
        : (otherPerson?.username || 'Unknown');
    const displayAvatar = otherPerson?.avatar || otherPerson?.googlePicture;

    // ── Build group tiles list (must be before early return to respect hooks rules) ──
    const groupTiles = useMemo(() => {
        if (!isGroup) return [];
        const tiles = [];
        // Local tile
        tiles.push({ id: 'local', stream: localStream, label: 'Bạn', muted: true, mirror: true });
        // Remote tiles
        for (const [uid, stream] of Object.entries(remoteStreams)) {
            const p = participants.find(pp => pp._id === uid);
            tiles.push({
                id: uid,
                stream,
                label: p?.username || 'User',
                avatar: p?.avatar,
                muted: false,
                mirror: false,
            });
        }
        return tiles;
    }, [isGroup, localStream, remoteStreams, participants]);

    if (!callState.active && !callState.outgoing) return null;

    // ═════════════════════════════════════════════════════════
    // ─── PiP (Picture-in-Picture) Bubble Mode ───────────────
    // ═════════════════════════════════════════════════════════
    if (pipMode) {
        return (
            <div
                className="fixed bottom-20 right-4 z-45 w-72 rounded-2xl overflow-hidden shadow-2xl border border-white/10 bg-gray-900 cursor-pointer group"
                style={{ aspectRatio: '16/10' }}
                onClick={() => setPipMode(false)}
                title="Nhấn để mở rộng"
            >
                <audio ref={remoteAudioRef} autoPlay playsInline />

                {hasRemote && isVideoCall ? (
                    isGroup ? (
                        <div className="w-full h-full grid grid-cols-2 gap-px">
                            {groupTiles.slice(0, 4).map((tile, i, arr) => (
                                <VideoTile key={tile.id} stream={tile.stream} label={tile.label} muted={tile.muted} mirror={tile.mirror} avatar={tile.avatar}
                                    style={shouldCenterLast(arr.length) && i === arr.length - 1 ? getLastItemStyle(arr.length) : undefined} />
                            ))}
                        </div>
                    ) : (
                        <video ref={remoteVideoRef} autoPlay playsInline className="w-full h-full object-cover" />
                    )
                ) : (
                    <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-gray-800 to-gray-900">
                        <div className="text-center">
                            <div className="w-12 h-12 rounded-full bg-blue-500 flex items-center justify-center text-white text-lg font-bold mx-auto mb-1 overflow-hidden">
                                {displayAvatar ? (
                                    <img src={displayAvatar} alt={displayName} className="w-full h-full object-cover" />
                                ) : displayName.charAt(0).toUpperCase()}
                            </div>
                            <p className="text-white text-xs font-medium truncate px-2">{displayName}</p>
                        </div>
                    </div>
                )}

                <div className="absolute top-0 left-0 right-0 flex items-center justify-between px-2.5 py-1.5 bg-gradient-to-b from-black/60 to-transparent">
                    <span className="text-white text-[10px] font-medium bg-green-500/80 px-1.5 py-0.5 rounded-full flex items-center gap-1">
                        <span className="w-1.5 h-1.5 bg-white rounded-full animate-pulse" />
                        {formatDuration(callDuration)}
                    </span>
                    <Maximize2 size={14} className="text-white opacity-0 group-hover:opacity-100 transition-opacity" />
                </div>

                <div className="absolute bottom-1.5 right-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button
                        onClick={(e) => { e.stopPropagation(); callState.active ? endCall() : cancelCall(); }}
                        className="p-1.5 bg-red-600 hover:bg-red-700 text-white rounded-full shadow-lg transition"
                    >
                        <PhoneOff size={14} />
                    </button>
                </div>
            </div>
        );
    }

    // ═════════════════════════════════════════════════════════
    // ─── Full-Screen Overlay Mode ───────────────────────────
    // ═════════════════════════════════════════════════════════
    return (
        <div className="fixed inset-0 bg-black z-50 flex flex-col">
            <div className="flex-1 relative bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 overflow-hidden">
                <audio ref={remoteAudioRef} autoPlay playsInline />

                {/* ═══ GROUP CALL GRID ═══ */}
                {isGroup ? (
                    groupTiles.length > 1 && isVideoCall ? (
                        screenSharing && screenStream ? (
                            /* Screen sharing in group — screen dominant center, webcams sidebar */
                            <div className="absolute inset-0 flex">
                                <div className="flex-1 relative bg-black flex items-center justify-center">
                                    <video
                                        ref={screenVideoRef}
                                        autoPlay playsInline muted
                                        style={{ objectFit: 'contain', maxWidth: '100%', maxHeight: '100%', width: 'auto', height: 'auto' }}
                                    />
                                    <div className="absolute top-3 left-3 bg-blue-600/80 text-white text-xs px-2.5 py-1 rounded-full flex items-center gap-1.5 backdrop-blur-sm z-10">
                                        <ScreenShare size={12} /> Bạn đang chia sẻ màn hình
                                    </div>
                                </div>
                                <div className="w-52 bg-gray-900/80 flex flex-col items-start p-2 gap-2 shrink-0 overflow-y-auto">
                                    {groupTiles.map(tile => (
                                        <div key={tile.id} className="w-full rounded-xl overflow-hidden border border-white/10" style={{ aspectRatio: '4/3' }}>
                                            <VideoTile stream={tile.stream} label={tile.label} muted={tile.muted} mirror={tile.mirror} avatar={tile.avatar} />
                                        </div>
                                    ))}
                                </div>
                            </div>
                        ) : (
                            /* Normal group video grid — even: symmetric, odd: last centered */
                            <div className="absolute inset-0 p-1" style={getGridStyle(groupTiles.length)}>
                                {groupTiles.map((tile, i) => (
                                    <VideoTile
                                        key={tile.id}
                                        stream={tile.stream}
                                        label={tile.label}
                                        muted={tile.muted}
                                        mirror={tile.mirror}
                                        avatar={tile.avatar}
                                        style={shouldCenterLast(groupTiles.length) && i === groupTiles.length - 1
                                            ? getLastItemStyle(groupTiles.length) : undefined}
                                    />
                                ))}
                            </div>
                        )
                    ) : (
                        /* Group call: waiting for participants or audio-only */
                        <div className="absolute inset-0 flex items-center justify-center">
                            <div className="text-center">
                                <div className="relative mx-auto mb-6 w-32 h-32">
                                    {(callState.outgoing || (callState.active && !hasRemote)) && (
                                        <div className="absolute inset-0 rounded-full border-4 border-blue-400/30 animate-ping" />
                                    )}
                                    <div className="w-32 h-32 rounded-full bg-gradient-to-br from-blue-500 to-blue-700 flex items-center justify-center text-white text-3xl font-bold shadow-2xl shadow-blue-500/30">
                                        {callState.roomName?.charAt(0)?.toUpperCase() || '👥'}
                                    </div>
                                </div>
                                <h2 className="text-white text-2xl font-semibold mb-1">{callState.roomName || 'Cuộc gọi nhóm'}</h2>
                                {participants.length > 0 && (
                                    <p className="text-gray-400 text-sm mb-2">
                                        {participants.length + 1} người tham gia
                                    </p>
                                )}
                                {callState.outgoing && !callState.active && (
                                    <div className="flex items-center gap-2 text-gray-400 mt-2 justify-center">
                                        <Loader2 size={16} className="animate-spin" />
                                        <span>Đang gọi nhóm...</span>
                                    </div>
                                )}
                                {callState.active && !hasRemote && !connectionWarning && (
                                    <div className="flex items-center gap-2 text-gray-400 mt-2 justify-center">
                                        <Loader2 size={16} className="animate-spin" />
                                        <span>Đang chờ thành viên tham gia...</span>
                                    </div>
                                )}
                                {callState.active && !hasRemote && connectionWarning && (
                                    <p className="text-yellow-400 mt-2 text-sm">Chưa có ai tham gia cuộc gọi</p>
                                )}
                                {callState.active && hasRemote && !isVideoCall && (
                                    <p className="text-gray-400 mt-3 text-lg font-mono">{formatDuration(callDuration)}</p>
                                )}

                                {/* Audio-only: show participant grid in circle */}
                                {callState.active && hasRemote && !isVideoCall && (
                                    <div className="flex flex-wrap justify-center gap-3 mt-6 max-w-sm mx-auto">
                                        {groupTiles.map(tile => (
                                            <div key={tile.id} className="text-center">
                                                <div className="w-14 h-14 rounded-full bg-blue-500 flex items-center justify-center text-white text-lg font-bold mx-auto overflow-hidden">
                                                    {tile.avatar ? (
                                                        <img src={tile.avatar} alt={tile.label} className="w-full h-full object-cover" />
                                                    ) : tile.label.charAt(0).toUpperCase()}
                                                </div>
                                                <p className="text-white text-[10px] mt-1 truncate w-16">{tile.label}</p>
                                            </div>
                                        ))}
                                    </div>
                                )}

                                {/* Local preview (video call waiting) */}
                                {isVideoCall && localStream && !hasRemote && (
                                    <div className="absolute top-4 right-4 w-36 rounded-xl overflow-hidden shadow-lg border-2 border-white/10" style={{ aspectRatio: '3/4' }}>
                                        <VideoTile stream={localStream} label="Bạn" muted mirror />
                                    </div>
                                )}
                            </div>
                        </div>
                    )
                ) : (
                    /* ═══ 1-1 CALL LAYOUT (unchanged) ═══ */
                    <>
                        {hasRemote && isVideoCall ? (
                            screenSharing && screenStream ? (
                                /* 1-1: You are sharing screen — screen dominant, webcams sidebar */
                                <div className="absolute inset-0 flex">
                                    <div className="flex-1 relative bg-black flex items-center justify-center">
                                        <video
                                            ref={screenVideoRef}
                                            autoPlay playsInline muted
                                            style={{ objectFit: 'contain', maxWidth: '100%', maxHeight: '100%', width: 'auto', height: 'auto' }}
                                        />
                                        <div className="absolute top-3 left-3 bg-blue-600/80 text-white text-xs px-2.5 py-1 rounded-full flex items-center gap-1.5 backdrop-blur-sm z-10">
                                            <ScreenShare size={12} /> Bạn đang chia sẻ màn hình
                                        </div>
                                    </div>
                                    <div className="w-52 bg-gray-900/80 flex flex-col items-start p-2 gap-3 shrink-0">
                                        <div className="w-full relative rounded-xl overflow-hidden border border-white/10 shadow-lg" style={{ aspectRatio: '4/3' }}>
                                            <video ref={remoteVideoRef} autoPlay playsInline className="w-full h-full object-cover" />
                                            <div className="absolute bottom-1.5 left-1.5 bg-black/50 px-2 py-0.5 rounded-full text-white text-[10px] backdrop-blur-sm">{displayName}</div>
                                        </div>
                                        <div className="w-full relative rounded-xl overflow-hidden border border-white/10 shadow-lg" style={{ aspectRatio: '4/3' }}>
                                            <video ref={localVideoRef} autoPlay playsInline muted className="w-full h-full object-cover" style={{ transform: 'scaleX(-1)' }} />
                                            <div className="absolute bottom-1.5 left-1.5 bg-black/50 px-2 py-0.5 rounded-full text-white text-[10px] backdrop-blur-sm">Bạn</div>
                                        </div>
                                    </div>
                                </div>
                            ) : remoteScreenSharing ? (
                                /* 1-1: Remote is sharing screen — screen dominant, your webcam sidebar */
                                <div className="absolute inset-0 flex">
                                    <div className="flex-1 relative bg-black flex items-center justify-center">
                                        <video
                                            ref={remoteVideoRef}
                                            autoPlay playsInline
                                            style={{ objectFit: 'contain', maxWidth: '100%', maxHeight: '100%', width: 'auto', height: 'auto' }}
                                        />
                                        <div className="absolute top-3 left-3 bg-green-600/80 text-white text-xs px-2.5 py-1 rounded-full flex items-center gap-1.5 backdrop-blur-sm z-10">
                                            <ScreenShare size={12} /> {displayName} đang chia sẻ màn hình
                                        </div>
                                    </div>
                                    <div className="w-52 bg-gray-900/80 flex flex-col items-start p-2 gap-3 shrink-0">
                                        <div className="w-full relative rounded-xl overflow-hidden border border-white/10 shadow-lg" style={{ aspectRatio: '4/3' }}>
                                            <video ref={localVideoRef} autoPlay playsInline muted className="w-full h-full object-cover" style={{ transform: 'scaleX(-1)' }} />
                                            <div className="absolute bottom-1.5 left-1.5 bg-black/50 px-2 py-0.5 rounded-full text-white text-[10px] backdrop-blur-sm">Bạn</div>
                                        </div>
                                    </div>
                                </div>
                            ) : (
                                <div className="absolute inset-0 grid grid-cols-1 md:grid-cols-2 gap-1 p-1">
                                    <div className="relative bg-gray-800 rounded-xl overflow-hidden">
                                        <video ref={remoteVideoRef} autoPlay playsInline className="w-full h-full object-cover" />
                                        <div className="absolute bottom-3 left-3 bg-black/50 px-2.5 py-1 rounded-full text-white text-xs backdrop-blur-sm">{displayName}</div>
                                    </div>
                                    <div className="relative bg-gray-800 rounded-xl overflow-hidden">
                                        <video ref={localVideoRef} autoPlay playsInline muted className="w-full h-full object-cover" style={{ transform: 'scaleX(-1)' }} />
                                        <div className="absolute bottom-3 left-3 bg-black/50 px-2.5 py-1 rounded-full text-white text-xs backdrop-blur-sm">Bạn</div>
                                    </div>
                                </div>
                            )
                        ) : (
                            <>
                                <video ref={remoteVideoRef} autoPlay playsInline className="hidden" />
                                <div className="absolute inset-0 flex items-center justify-center">
                                    <div className="text-center">
                                        <div className="relative mx-auto mb-6 w-32 h-32">
                                            {(callState.outgoing || (callState.active && !hasRemote)) && (
                                                <div className="absolute inset-0 rounded-full border-4 border-blue-400/30 animate-ping" />
                                            )}
                                            <div className="w-32 h-32 rounded-full bg-gradient-to-br from-blue-500 to-blue-700 flex items-center justify-center text-white text-5xl font-bold overflow-hidden shadow-2xl shadow-blue-500/30">
                                                {displayAvatar ? (
                                                    <img src={displayAvatar} alt={displayName} className="w-full h-full object-cover" />
                                                ) : displayName.charAt(0).toUpperCase()}
                                            </div>
                                        </div>
                                        <h2 className="text-white text-2xl font-semibold mb-1">{displayName}</h2>
                                        {callState.outgoing && !callState.active && (
                                            <div className="flex items-center gap-2 text-gray-400 mt-2 justify-center">
                                                <Loader2 size={16} className="animate-spin" /> <span>Đang gọi...</span>
                                            </div>
                                        )}
                                        {callState.active && !hasRemote && !connectionWarning && (
                                            <div className="flex items-center gap-2 text-gray-400 mt-2 justify-center">
                                                <Loader2 size={16} className="animate-spin" /> <span>Đang kết nối...</span>
                                            </div>
                                        )}
                                        {callState.active && !hasRemote && connectionWarning && (
                                            <p className="text-yellow-400 mt-2 text-sm">Kết nối kém, vui lòng thử lại</p>
                                        )}
                                        {callState.active && hasRemote && !isVideoCall && (
                                            <p className="text-gray-400 mt-3 text-lg font-mono">{formatDuration(callDuration)}</p>
                                        )}
                                    </div>
                                </div>
                                {isVideoCall && localStream && (
                                    <div className="absolute top-4 right-4 w-36 rounded-xl overflow-hidden shadow-lg border-2 border-white/10" style={{ aspectRatio: '3/4' }}>
                                        <video ref={localVideoRef} autoPlay playsInline muted className="w-full h-full object-cover" style={{ transform: 'scaleX(-1)' }} />
                                    </div>
                                )}
                            </>
                        )}
                    </>
                )}

                {/* ─── Top Bar ─── */}
                <div className={`absolute top-0 left-0 right-0 flex items-center justify-between px-5 py-3 bg-gradient-to-b from-black/60 to-transparent transition-opacity duration-300 ${showControls ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}>
                    <div className="flex items-center gap-3">
                        {isGroup && (
                            <span className="text-white text-sm font-medium truncate max-w-[200px]">
                                {callState.roomName || 'Cuộc gọi nhóm'}
                                {hasRemote && <span className="text-gray-400 ml-2 text-xs">({groupTiles.length} người)</span>}
                            </span>
                        )}
                        {callState.active && hasRemote && (
                            <span className="text-white text-sm font-mono bg-black/40 px-3 py-1 rounded-full backdrop-blur-sm flex items-center gap-2">
                                <span className="w-2 h-2 bg-red-500 rounded-full animate-pulse" />
                                {formatDuration(callDuration)}
                            </span>
                        )}
                    </div>
                    <button
                        onClick={() => setPipMode(true)}
                        className="p-2 bg-white/10 hover:bg-white/20 text-white rounded-full transition backdrop-blur-sm"
                        title="Thu nhỏ (Picture-in-Picture)"
                    >
                        <Minimize2 size={18} />
                    </button>
                </div>

                {/* Camera fallback warning */}
                {callError && (
                    <div className="absolute bottom-24 left-4 right-4 bg-yellow-500/90 text-white text-sm px-4 py-2.5 rounded-xl text-center shadow-lg backdrop-blur-sm">
                        {callError}
                    </div>
                )}

                {/* ─── Invite Panel (Group only) ─── */}
                {showInvitePanel && isGroup && (
                    <InvitePanel
                        roomId={callState.roomId}
                        participants={participants}
                        onInvite={(userId) => inviteMember(userId)}
                        onClose={() => setShowInvitePanel(false)}
                    />
                )}
            </div>

            {/* ═══ Floating Toolbar — always on top ═══ */}
            <div className={`absolute bottom-0 left-0 right-0 z-50 flex justify-center pb-8 pt-16 bg-linear-to-t from-black/60 to-transparent transition-opacity duration-300 ${showControls ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}>
                <div className="flex items-center gap-3 bg-white/10 backdrop-blur-2xl px-5 py-2.5 rounded-2xl border border-white/10 shadow-2xl">
                    <button
                        onClick={handleToggleAudio}
                        className={`p-3 rounded-full transition-all duration-200 ${audioMuted ? 'bg-red-500 text-white shadow-lg shadow-red-500/30' : 'bg-white/10 text-white hover:bg-white/20'}`}
                        title={audioMuted ? 'Bật micro' : 'Tắt micro'}
                    >
                        {audioMuted ? <MicOff size={20} /> : <Mic size={20} />}
                    </button>

                    {isVideoCall && (
                        <button
                            onClick={handleToggleVideo}
                            className={`p-3 rounded-full transition-all duration-200 ${videoOff ? 'bg-red-500 text-white shadow-lg shadow-red-500/30' : 'bg-white/10 text-white hover:bg-white/20'}`}
                            title={videoOff ? 'Bật camera' : 'Tắt camera'}
                        >
                            {videoOff ? <VideoOff size={20} /> : <VideoIcon size={20} />}
                        </button>
                    )}

                    <div className="w-px h-7 bg-white/15" />

                    {isVideoCall && callState.active && hasRemote && (
                        <button
                            onClick={toggleScreenShare}
                            className={`p-3 rounded-full transition-all duration-200 flex items-center gap-2 ${screenSharing ? 'bg-blue-500 text-white shadow-lg shadow-blue-500/30' : 'bg-white/10 text-white hover:bg-white/20'}`}
                            title={screenSharing ? 'Dừng chia sẻ màn hình' : 'Chia sẻ màn hình'}
                        >
                            {screenSharing ? <ScreenShareOff size={20} /> : <ScreenShare size={20} />}
                            <span className="text-xs font-medium hidden sm:inline">
                                {screenSharing ? 'Dừng' : 'Share'}
                            </span>
                        </button>
                    )}

                    {/* Invite member button (group only) */}
                    {isGroup && callState.active && (
                        <>
                            <div className="w-px h-7 bg-white/15" />
                            <button
                                onClick={() => setShowInvitePanel(!showInvitePanel)}
                                className={`p-3 rounded-full transition-all duration-200 flex items-center gap-2 ${showInvitePanel ? 'bg-green-500 text-white' : 'bg-white/10 text-white hover:bg-white/20'}`}
                                title="Mời thành viên"
                            >
                                <UserPlus size={20} />
                                <span className="text-xs font-medium hidden sm:inline">Mời</span>
                            </button>
                        </>
                    )}

                    <div className="w-px h-7 bg-white/15" />

                    <button
                        onClick={callState.active ? endCall : cancelCall}
                        className="p-3 px-6 bg-red-600 hover:bg-red-700 text-white rounded-full transition-all duration-200 shadow-lg shadow-red-600/30 flex items-center gap-2"
                        title="Kết thúc cuộc gọi"
                    >
                        <PhoneOff size={20} />
                        <span className="text-xs font-medium hidden sm:inline">
                            {isGroup ? 'Rời đi' : 'Kết thúc'}
                        </span>
                    </button>
                </div>
            </div>
        </div>
    );
}

// ── Invite Panel Component ──
function InvitePanel({ roomId, participants, onInvite, onClose }) {
    const [members, setMembers] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchMembers = async () => {
            try {
                const apiBase = import.meta.env.VITE_API_URL || '/api';
                const token = localStorage.getItem('token');
                const res = await fetch(`${apiBase}/rooms/${roomId}`, {
                    headers: { Authorization: `Bearer ${token}` },
                });
                if (res.ok) {
                    const data = await res.json();
                    const room = data.room || data;
                    const memberList = (room.members || [])
                        .map(m => m.user || m)
                        .filter(m => m._id);
                    setMembers(memberList);
                }
            } catch (err) {
                console.error('[InvitePanel] fetch error:', err);
            } finally {
                setLoading(false);
            }
        };
        fetchMembers();
    }, [roomId]);

    const participantIds = participants.map(p => p._id);
    const available = members.filter(m => !participantIds.includes(m._id));

    return (
        <div className="absolute inset-0 z-40 flex items-center justify-center bg-black/40 backdrop-blur-sm" onClick={onClose}>
            <div
                className="w-[90vw] max-w-[40vw] min-w-80 bg-gray-900/95 backdrop-blur-xl rounded-3xl border border-white/15 shadow-2xl overflow-hidden"
                onClick={e => e.stopPropagation()}
            >
                <div className="flex items-center justify-between px-6 py-4 border-b border-white/10">
                    <h3 className="text-white text-lg font-semibold">Mời thành viên</h3>
                    <button onClick={onClose} className="p-1.5 text-gray-400 hover:text-white hover:bg-white/10 rounded-full transition">
                        <X size={20} />
                    </button>
                </div>
                <div className="max-h-[50vh] overflow-y-auto p-4 space-y-1">
                    {loading ? (
                        <div className="flex items-center justify-center py-10 text-gray-400">
                            <Loader2 size={24} className="animate-spin" />
                        </div>
                    ) : available.length === 0 ? (
                        <p className="text-gray-500 text-base text-center py-8">Tất cả thành viên đã trong cuộc gọi</p>
                    ) : (
                        available.map(member => (
                            <div key={member._id} className="flex items-center justify-between px-4 py-3 rounded-2xl hover:bg-white/5 transition">
                                <div className="flex items-center gap-3">
                                    <div className="w-11 h-11 rounded-full bg-blue-500 flex items-center justify-center text-white text-base font-bold overflow-hidden shrink-0">
                                        {(member.avatar || member.googlePicture) ? (
                                            <img src={member.avatar || member.googlePicture} alt={member.username} className="w-full h-full object-cover" />
                                        ) : (member.username || '?').charAt(0).toUpperCase()}
                                    </div>
                                    <span className="text-white text-base font-medium">{member.username}</span>
                                </div>
                                <button
                                    onClick={() => onInvite(member._id)}
                                    className="px-5 py-2 bg-green-500 hover:bg-green-600 text-white text-sm rounded-full transition font-semibold shadow-lg shadow-green-500/20"
                                >
                                    Mời
                                </button>
                            </div>
                        ))
                    )}
                </div>
            </div>
        </div>
    );
}
