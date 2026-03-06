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
    const [localStream, setLocalStream] = useState(null);
    const [remoteStream, setRemoteStream] = useState(null);

    // Preload SimplePeer on mount
    useEffect(() => {
        getSimplePeer().catch(() => { });
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
        setLocalStream(null);
        setRemoteStream(null);
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

        const peer = new SimplePeer({
            initiator,
            trickle: true,
            stream,
            config: {
                iceServers: [
                    { urls: 'stun:stun.l.google.com:19302' },
                    { urls: 'stun:stun1.l.google.com:19302' },
                    { urls: 'stun:stun2.l.google.com:19302' },
                    { urls: 'stun:stun3.l.google.com:19302' },
                    { urls: 'stun:stun4.l.google.com:19302' },
                ],
            },
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
            // Do NOT cleanup here — transient errors should not kill the call UI
        });

        peer.on('close', () => {
            console.log('[Peer] Connection closed');
            // Only log — cleanup is handled by endCall/cancelCall actions
        });

        peerRef.current = peer;
        return peer;
    }, [emit, cleanup]);

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
            // Caller side: when callee accepts, create initiator peer
            try {
                const stream = localStreamRef.current;
                if (!stream) {
                    console.error('[Call] No local stream on handleAccepted!');
                    cleanup();
                    return;
                }
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
    }, [emit, user, getMediaStream]);

    const acceptCall = useCallback(async () => {
        const { roomId, caller, callType } = callState;
        console.log('[Call] acceptCall, caller:', caller?._id);
        targetUserIdRef.current = caller?._id || null;
        // Stop ringtone + notification on accept
        stopRingtone();
        if (notifRef.current) { notifRef.current.close(); notifRef.current = null; }
        try {
            // Get media FIRST — if we emit before stream is ready,
            // the offer arrives while localStreamRef is still null → call dies
            if (!localStreamRef.current) {
                await getMediaStream(callType);
            }
            // Only AFTER stream is ready, tell the server we accepted
            emit('call:accept', { roomId, callerId: caller?._id });
            setCallState((prev) => ({ ...prev, incoming: false, active: true }));
        } catch (err) {
            console.error('[Call] acceptCall failed:', err);
            cleanup();
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
