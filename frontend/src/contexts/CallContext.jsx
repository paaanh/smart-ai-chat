import { useState, useCallback, useEffect, useRef } from 'react';
import { useSocket } from '../hooks/useSocket';
import { useAuth } from '../hooks/useAuth';
import { CallContext } from '.';
import { startRingtone, stopRingtone } from '../utils/ringtone';

// ── Lazy-load SimplePeer to avoid TDZ errors ───────────────────
let SimplePeerClass = null;
const getSimplePeer = async () => {
    if (!SimplePeerClass) {
        const mod = await import('simple-peer');
        SimplePeerClass = mod.default || mod;
    }
    return SimplePeerClass;
};

// ── Default ICE servers (STUN only — always works) ───────────────
const DEFAULT_ICE_SERVERS = [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
    { urls: 'stun:stun2.l.google.com:19302' },
];

export function CallProvider({ children }) {
    const { on, off, emit } = useSocket();
    const { user } = useAuth();

    const [callState, setCallState] = useState({
        active: false,
        incoming: false,
        outgoing: false,
        roomId: null,
        callType: null,
        caller: null,
        callee: null,
    });

    const peerRef = useRef(null);
    const localStreamRef = useRef(null);
    const remoteStreamRef = useRef(null);
    const pendingSignalsRef = useRef([]);
    // Synchronous ref for target — never rely on React render cycle for signaling
    const targetUserIdRef = useRef(null);
    const notifRef = useRef(null);
    const acceptingRef = useRef(false); // guard against double-click
    const [localStream, setLocalStream] = useState(null);
    const [remoteStream, setRemoteStream] = useState(null);
    const [callError, setCallError] = useState(null);

    // Pre-fetched ICE servers (STUN + TURN) — filled on mount
    const iceServersRef = useRef(DEFAULT_ICE_SERVERS);

    // Preload SimplePeer on mount
    useEffect(() => {
        getSimplePeer().catch(() => { });
    }, []);

    // Pre-fetch ICE servers from backend on mount (non-blocking)
    useEffect(() => {
        const fetchIceServers = async () => {
            try {
                const apiBase = import.meta.env.VITE_API_URL || '/api';
                const controller = new AbortController();
                const timeout = setTimeout(() => controller.abort(), 5000);
                const res = await fetch(`${apiBase}/ice-servers`, {
                    signal: controller.signal,
                });
                clearTimeout(timeout);
                if (res.ok) {
                    const data = await res.json();
                    if (data.iceServers?.length > 0) {
                        // Ensure STUN servers are always first
                        const hasStun = data.iceServers.some(s => {
                            const u = Array.isArray(s.urls) ? s.urls[0] : s.urls;
                            return u?.startsWith('stun:');
                        });
                        if (!hasStun) {
                            data.iceServers.unshift(...DEFAULT_ICE_SERVERS);
                        }
                        iceServersRef.current = data.iceServers;
                        console.log('[Call] Pre-fetched ICE servers:', data.iceServers.length, 'entries');
                    }
                }
            } catch (err) {
                console.warn('[Call] ICE server fetch failed (using STUN-only):', err.message);
            }
        };
        fetchIceServers();
    }, []);

    // ---- Helpers ----
    const cleanup = useCallback(() => {
        console.log('[Call] cleanup()');
        stopRingtone();
        if (notifRef.current) {
            notifRef.current.close();
            notifRef.current = null;
        }
        if (peerRef.current) {
            peerRef.current.destroy();
            peerRef.current = null;
        }
        if (localStreamRef.current) {
            localStreamRef.current.getTracks().forEach((t) => t.stop());
            localStreamRef.current = null;
        }
        remoteStreamRef.current = null;
        pendingSignalsRef.current = [];
        targetUserIdRef.current = null;
        acceptingRef.current = false;
        setLocalStream(null);
        setRemoteStream(null);
        setCallError(null);
        setCallState({
            active: false,
            incoming: false,
            outgoing: false,
            roomId: null,
            callType: null,
            caller: null,
            callee: null,
        });
    }, []);

    const getMediaStream = useCallback(async (type) => {
        console.log('[Call] getMediaStream:', type);
        const constraints = { audio: true, video: type === 'video' };
        const stream = await navigator.mediaDevices.getUserMedia(constraints);
        localStreamRef.current = stream;
        setLocalStream(stream);
        console.log('[Call] getMediaStream OK, tracks:', stream.getTracks().map(t => `${t.kind}:${t.readyState}`).join(', '));
        return stream;
    }, []);

    const createPeer = useCallback(async (initiator, stream) => {
        // Destroy any existing peer
        if (peerRef.current) {
            peerRef.current.destroy();
            peerRef.current = null;
        }

        const SimplePeer = await getSimplePeer();
        console.log(`[Call] createPeer(initiator=${initiator}), target=${targetUserIdRef.current}`);

        // Use pre-fetched ICE servers (already available — no network delay)
        const iceServers = iceServersRef.current;

        console.log('[Call] ICE servers:', iceServers.length, 'entries',
            iceServers.filter(s => {
                const u = Array.isArray(s.urls) ? s.urls[0] : s.urls;
                return u?.startsWith('turn');
            }).length, 'TURN');

        const peer = new SimplePeer({
            initiator,
            trickle: true,
            stream,
            config: { iceServers },
        });

        peer.on('signal', (data) => {
            const target = targetUserIdRef.current;
            if (!target) {
                console.error('[Peer] signal fired but targetUserIdRef is null!', data.type || 'ice');
                return;
            }
            if (data.type === 'offer') {
                console.log('[Peer] → sending offer to', target);
                emit('webrtc:offer', { targetUserId: target, sdp: data });
            } else if (data.type === 'answer') {
                console.log('[Peer] → sending answer to', target);
                emit('webrtc:answer', { targetUserId: target, sdp: data });
            } else if (data.candidate) {
                emit('webrtc:ice-candidate', { targetUserId: target, candidate: data });
            }
        });

        peer.on('connect', () => {
            console.log('[Peer] P2P connected!');
        });

        peer.on('stream', (remoteStr) => {
            console.log('[Peer] Remote stream received! tracks:', remoteStr.getTracks().map(t => `${t.kind}:${t.readyState}`).join(', '));
            remoteStreamRef.current = remoteStr;
            setRemoteStream(remoteStr);
            // Keep outgoing flag as-is — it's used for display name logic
            setCallState((prev) => ({ ...prev, active: true, incoming: false }));
        });

        peer.on('error', (err) => {
            console.error('[Peer] Error:', err.message || err);
        });

        peer.on('close', () => {
            console.log('[Peer] Connection closed');
        });

        // Monitor ICE connection state — use addEventListener to NOT override SimplePeer's internal handler
        if (peer._pc) {
            peer._pc.addEventListener('iceconnectionstatechange', () => {
                const state = peer._pc.iceConnectionState;
                console.log('[Peer] ICE state:', state);
                if (state === 'failed') {
                    console.error('[Peer] ICE connection failed — likely no TURN server available');
                    setCallError('Không thể kết nối. Kiểm tra mạng hoặc cấu hình TURN server.');
                } else if (state === 'disconnected') {
                    console.warn('[Peer] ICE disconnected — attempting reconnect...');
                }
            });
        }

        peerRef.current = peer;
        return peer;
    }, [emit]);

    // ---- Socket listeners ----
    useEffect(() => {
        const handleIncoming = ({ caller, callType, roomId }) => {
            console.log('[Call] Incoming call from', caller?.username, 'roomId:', roomId);
            targetUserIdRef.current = caller?._id || null;

            // Start ringtone
            startRingtone();

            // Browser notification when tab is not focused
            if (document.hidden && Notification.permission === 'granted') {
                const callerName = caller?.username || 'Ai đó';
                const callLabel = callType === 'video' ? 'video' : 'thoại';
                const notif = new Notification(`📞 ${callerName} đang gọi ${callLabel}`, {
                    body: 'Nhấn để trả lời',
                    icon: caller?.avatar || undefined,
                    tag: 'incoming-call',
                    requireInteraction: true,
                });
                notif.onclick = () => {
                    window.focus();
                    notif.close();
                };
                // Store ref so we can close it later
                notifRef.current = notif;
            }

            setCallState({
                active: false,
                incoming: true,
                outgoing: false,
                roomId,
                callType,
                caller,
                callee: user,
            });
        };

        const handleCancelled = () => { console.log('[Call] Call cancelled'); cleanup(); };
        const handleRejected = () => { console.log('[Call] Call rejected'); cleanup(); };
        const handleEnded = () => { console.log('[Call] Call ended'); cleanup(); };
        const handleTimeout = () => { console.log('[Call] Call timeout'); cleanup(); };

        const handleAccepted = async ({ userId: acceptedUserId }) => {
            console.log('[Call] Call accepted by', acceptedUserId, '| targetUserIdRef:', targetUserIdRef.current);
            // Ensure targetUserIdRef points to the callee who accepted
            if (acceptedUserId) {
                targetUserIdRef.current = acceptedUserId;
            }
            // Caller side: when callee accepts, create initiator peer
            try {
                const stream = localStreamRef.current;
                if (!stream) {
                    console.error('[Call] No local stream on handleAccepted!');
                    cleanup();
                    return;
                }
                setCallState((prev) => ({ ...prev, active: true }));
                const peer = await createPeer(true, stream);
                // Flush any buffered signals
                while (pendingSignalsRef.current.length > 0) {
                    peer.signal(pendingSignalsRef.current.shift());
                }
            } catch (err) {
                console.error('[Call] handleAccepted failed:', err);
                cleanup();
            }
        };

        const handleOffer = async ({ fromUserId, sdp }) => {
            console.log('[Call] Received offer from', fromUserId);
            targetUserIdRef.current = fromUserId;
            try {
                const stream = localStreamRef.current;
                if (!stream) {
                    console.error('[Call] No local stream on handleOffer!');
                    cleanup();
                    return;
                }
                const peer = await createPeer(false, stream);
                peer.signal(sdp);
                // Flush buffered ICE candidates
                console.log('[Call] Flushing', pendingSignalsRef.current.length, 'buffered signals');
                while (pendingSignalsRef.current.length > 0) {
                    peer.signal(pendingSignalsRef.current.shift());
                }
            } catch (err) {
                console.error('[Call] handleOffer failed:', err);
                pendingSignalsRef.current = [];
                cleanup();
            }
        };

        const handleAnswer = ({ fromUserId, sdp }) => {
            console.log('[Call] Received answer from', fromUserId, '| peerRef:', !!peerRef.current);
            if (peerRef.current) {
                peerRef.current.signal(sdp);
            } else {
                console.warn('[Call] No peer yet, buffering answer');
                pendingSignalsRef.current.push(sdp);
            }
        };

        const handleICE = ({ fromUserId, candidate }) => {
            if (peerRef.current) {
                peerRef.current.signal(candidate);
            } else {
                pendingSignalsRef.current.push(candidate);
            }
        };

        on('call:incoming', handleIncoming);
        on('call:cancelled', handleCancelled);
        on('call:rejected', handleRejected);
        on('call:ended', handleEnded);
        on('call:timeout', handleTimeout);
        on('call:accepted', handleAccepted);
        on('webrtc:offer', handleOffer);
        on('webrtc:answer', handleAnswer);
        on('webrtc:ice-candidate', handleICE);

        return () => {
            off('call:incoming', handleIncoming);
            off('call:cancelled', handleCancelled);
            off('call:rejected', handleRejected);
            off('call:ended', handleEnded);
            off('call:timeout', handleTimeout);
            off('call:accepted', handleAccepted);
            off('webrtc:offer', handleOffer);
            off('webrtc:answer', handleAnswer);
            off('webrtc:ice-candidate', handleICE);
        };
    }, [on, off, user, cleanup, getMediaStream, createPeer]);

    // ---- Actions ----
    const initiateCall = useCallback(async (roomId, targetUserId, callType = 'video', targetUserName = '') => {
        // Guard: prevent starting a second call while one is active/pending
        if (callState.active || callState.outgoing || callState.incoming) return;
        try {
            console.log('[Call] initiateCall:', { roomId, targetUserId, callType, targetUserName });
            const stream = await getMediaStream(callType);
            targetUserIdRef.current = targetUserId;
            emit('call:initiate', { roomId, targetUserId, callType });
            setCallState({
                active: false,
                incoming: false,
                outgoing: true,
                roomId,
                callType,
                caller: user,
                callee: { _id: targetUserId, username: targetUserName },
            });
        } catch (err) {
            console.error('[Call] initiateCall failed:', err);
        }
    }, [emit, user, getMediaStream, callState.active, callState.outgoing, callState.incoming]);

    const acceptCall = useCallback(async () => {
        // Guard against double-click
        if (acceptingRef.current) return;
        acceptingRef.current = true;

        const { roomId, caller, callType } = callState;
        console.log('[Call] acceptCall, caller:', caller?._id, 'callType:', callType);
        targetUserIdRef.current = caller?._id || null;
        // Stop ringtone + notification on accept
        stopRingtone();
        if (notifRef.current) { notifRef.current.close(); notifRef.current = null; }

        // Immediately dismiss IncomingCallModal and show CallModal ("connecting" state)
        setCallState((prev) => ({ ...prev, incoming: false, active: true }));
        setCallError(null);

        try {
            // Get media — try video first, fall back to audio if camera fails
            if (!localStreamRef.current) {
                if (callType === 'video') {
                    try {
                        await getMediaStream('video');
                    } catch (videoErr) {
                        console.warn('[Call] Camera failed, falling back to audio-only:', videoErr.message);
                        setCallError('Không thể truy cập camera, chuyển sang gọi thoại');
                        await getMediaStream('audio');
                        // Update callType to audio since video is unavailable
                        setCallState((prev) => ({ ...prev, callType: 'audio' }));
                    }
                } else {
                    await getMediaStream(callType);
                }
            }
            // Only AFTER stream is ready, tell the server we accepted
            emit('call:accept', { roomId, callerId: caller?._id });
        } catch (err) {
            console.error('[Call] acceptCall failed:', err);
            setCallError('Không thể truy cập microphone');
            cleanup();
        } finally {
            acceptingRef.current = false;
        }
    }, [emit, getMediaStream, cleanup, callState]);

    const rejectCall = useCallback(() => {
        const { roomId, caller } = callState;
        emit('call:reject', { roomId, callerId: caller?._id });
        cleanup();
    }, [emit, cleanup, callState]);

    const cancelCall = useCallback(() => {
        emit('call:cancel', { roomId: callState.roomId });
        cleanup();
    }, [emit, cleanup, callState]);

    const endCall = useCallback(() => {
        emit('call:end', { roomId: callState.roomId });
        cleanup();
    }, [emit, cleanup, callState]);

    const toggleAudio = useCallback(() => {
        if (localStreamRef.current) {
            const track = localStreamRef.current.getAudioTracks()[0];
            if (track) track.enabled = !track.enabled;
        }
    }, []);

    const toggleVideo = useCallback(() => {
        if (localStreamRef.current) {
            const track = localStreamRef.current.getVideoTracks()[0];
            if (track) track.enabled = !track.enabled;
        }
    }, []);

    return (
        <CallContext.Provider
            value={{
                callState,
                localStream,
                remoteStream,
                callError,
                initiateCall,
                acceptCall,
                rejectCall,
                cancelCall,
                endCall,
                toggleAudio,
                toggleVideo,
            }}
        >
            {children}
        </CallContext.Provider>
    );
}
