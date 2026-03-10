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
        isGroup: false,
        roomName: '',
    });

    // ── 1-1 call refs (backward compat) ──
    const peerRef = useRef(null);
    const remoteStreamRef = useRef(null);
    const targetUserIdRef = useRef(null);

    // ── Group call refs (mesh topology) ──
    const peersRef = useRef({}); // userId → SimplePeer instance
    const pendingSignalsGroupRef = useRef({}); // userId → signal[]

    // ── Shared refs ──
    const localStreamRef = useRef(null);
    const pendingSignalsRef = useRef([]);
    const notifRef = useRef(null);
    const acceptingRef = useRef(false);
    const screenStreamRef = useRef(null);
    const originalVideoTrackRef = useRef(null);

    // ── State ──
    const [localStream, setLocalStream] = useState(null);
    const [remoteStream, setRemoteStream] = useState(null); // 1-1 compat
    const [remoteStreams, setRemoteStreams] = useState({}); // group: userId → stream
    const [participants, setParticipants] = useState([]); // group: [{ _id, username, avatar }]
    const [callError, setCallError] = useState(null);
    const [screenSharing, setScreenSharing] = useState(false);
    const [screenStream, setScreenStream] = useState(null);
    const [remoteScreenSharing, setRemoteScreenSharing] = useState(false);
    const [pipMode, setPipMode] = useState(false);

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
        // Destroy single peer (1-1)
        if (peerRef.current) {
            peerRef.current.destroy();
            peerRef.current = null;
        }
        // Destroy all group peers
        Object.values(peersRef.current).forEach(p => {
            try { p.destroy(); } catch { /* ignore */ }
        });
        peersRef.current = {};
        pendingSignalsGroupRef.current = {};
        if (screenStreamRef.current) {
            screenStreamRef.current.getTracks().forEach((t) => t.stop());
            screenStreamRef.current = null;
        }
        originalVideoTrackRef.current = null;
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
        setRemoteStreams({});
        setParticipants([]);
        setCallError(null);
        setScreenSharing(false);
        setScreenStream(null);
        setRemoteScreenSharing(false);
        setPipMode(false);
        setCallState({
            active: false,
            incoming: false,
            outgoing: false,
            roomId: null,
            callType: null,
            caller: null,
            callee: null,
            isGroup: false,
            roomName: '',
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

    // ── Create peer for 1-1 calls (backward compat) ──
    const createPeer = useCallback(async (initiator, stream) => {
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
            config: { iceServers: iceServersRef.current },
        });

        peer.on('signal', (data) => {
            const target = targetUserIdRef.current;
            if (!target) return;
            if (data.type === 'offer') {
                emit('webrtc:offer', { targetUserId: target, sdp: data });
            } else if (data.type === 'answer') {
                emit('webrtc:answer', { targetUserId: target, sdp: data });
            } else if (data.candidate) {
                emit('webrtc:ice-candidate', { targetUserId: target, candidate: data });
            }
        });

        peer.on('stream', (remoteStr) => {
            console.log('[Peer] Remote stream received!');
            remoteStreamRef.current = remoteStr;
            setRemoteStream(remoteStr);
            setCallState((prev) => ({ ...prev, active: true, incoming: false }));
        });

        peer.on('error', (err) => console.error('[Peer] Error:', err.message || err));
        peer.on('close', () => console.log('[Peer] Connection closed'));

        if (peer._pc) {
            peer._pc.addEventListener('iceconnectionstatechange', () => {
                const state = peer._pc.iceConnectionState;
                console.log('[Peer] ICE state:', state);
                if (state === 'failed') {
                    setCallError('Không thể kết nối. Kiểm tra mạng hoặc cấu hình TURN server.');
                }
            });
        }

        peerRef.current = peer;
        return peer;
    }, [emit]);

    // ── Create peer for group calls (mesh: one peer per participant) ──
    const createPeerForUser = useCallback(async (targetId, initiator, stream) => {
        // Destroy existing peer for this user if any
        if (peersRef.current[targetId]) {
            try { peersRef.current[targetId].destroy(); } catch { /* ignore */ }
            delete peersRef.current[targetId];
        }

        const SimplePeer = await getSimplePeer();
        console.log(`[GroupCall] createPeerForUser(target=${targetId}, initiator=${initiator})`);

        const peer = new SimplePeer({
            initiator,
            trickle: true,
            stream,
            config: { iceServers: iceServersRef.current },
        });

        peer.on('signal', (data) => {
            if (data.type === 'offer') {
                emit('webrtc:offer', { targetUserId: targetId, sdp: data });
            } else if (data.type === 'answer') {
                emit('webrtc:answer', { targetUserId: targetId, sdp: data });
            } else if (data.candidate) {
                emit('webrtc:ice-candidate', { targetUserId: targetId, candidate: data });
            }
        });

        peer.on('stream', (remoteStr) => {
            console.log(`[GroupCall] Stream received from ${targetId}`);
            setRemoteStreams(prev => ({ ...prev, [targetId]: remoteStr }));
            setCallState(prev => ({ ...prev, active: true, incoming: false }));
        });

        peer.on('error', (err) => console.error(`[GroupCall] Peer error (${targetId}):`, err.message));
        peer.on('close', () => {
            console.log(`[GroupCall] Peer closed (${targetId})`);
            delete peersRef.current[targetId];
            setRemoteStreams(prev => {
                const next = { ...prev };
                delete next[targetId];
                return next;
            });
        });

        if (peer._pc) {
            peer._pc.addEventListener('iceconnectionstatechange', () => {
                const state = peer._pc.iceConnectionState;
                console.log(`[GroupCall] ICE state (${targetId}):`, state);
            });
        }

        peersRef.current[targetId] = peer;

        // Flush any pending signals for this user
        const pending = pendingSignalsGroupRef.current[targetId];
        if (pending?.length) {
            console.log(`[GroupCall] Flushing ${pending.length} pending signals for ${targetId}`);
            pending.forEach(sig => peer.signal(sig));
            delete pendingSignalsGroupRef.current[targetId];
        }

        return peer;
    }, [emit]);

    // ---- Socket listeners ----
    useEffect(() => {
        const handleIncoming = ({ caller, callType, roomId, isGroup, roomName }) => {
            console.log('[Call] Incoming call from', caller?.username, 'roomId:', roomId, 'isGroup:', isGroup);
            targetUserIdRef.current = caller?._id || null;
            startRingtone();

            if (document.hidden && Notification.permission === 'granted') {
                const callerName = caller?.username || 'Ai đó';
                const callLabel = callType === 'video' ? 'video' : 'thoại';
                const title = isGroup
                    ? `📞 ${callerName} đang gọi ${callLabel} nhóm ${roomName || ''}`
                    : `📞 ${callerName} đang gọi ${callLabel}`;
                const notif = new Notification(title, {
                    body: 'Nhấn để trả lời',
                    icon: caller?.avatar || undefined,
                    tag: 'incoming-call',
                    requireInteraction: true,
                });
                notif.onclick = () => { window.focus(); notif.close(); };
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
                isGroup: !!isGroup,
                roomName: roomName || '',
            });
        };

        const handleCancelled = () => { console.log('[Call] Call cancelled'); cleanup(); };
        const handleRejected = () => { console.log('[Call] Call rejected'); cleanup(); };
        const handleEnded = () => { console.log('[Call] Call ended'); cleanup(); };
        const handleTimeout = () => { console.log('[Call] Call timeout'); cleanup(); };

        // ── 1-1: callee accepted → caller creates initiator peer ──
        const handleAccepted = async ({ userId: acceptedUserId }) => {
            console.log('[Call] Call accepted by', acceptedUserId);
            if (acceptedUserId) targetUserIdRef.current = acceptedUserId;
            try {
                const stream = localStreamRef.current;
                if (!stream) { cleanup(); return; }
                setCallState((prev) => ({ ...prev, active: true }));
                const peer = await createPeer(true, stream);
                while (pendingSignalsRef.current.length > 0) {
                    peer.signal(pendingSignalsRef.current.shift());
                }
            } catch (err) {
                console.error('[Call] handleAccepted failed:', err);
                cleanup();
            }
        };

        // ── Group: a new participant joined → existing members create initiator peer ──
        const handleParticipantJoined = async ({ userId: joinedUserId, username, avatar }) => {
            console.log('[GroupCall] Participant joined:', username, joinedUserId);
            setParticipants(prev => {
                if (prev.some(p => p._id === joinedUserId)) return prev;
                return [...prev, { _id: joinedUserId, username, avatar }];
            });
            // Create initiator peer to the new participant
            const stream = localStreamRef.current;
            if (stream) {
                await createPeerForUser(joinedUserId, true, stream);
            }
        };

        // ── Group: I just joined → server tells me about existing participants ──
        const handleExistingParticipants = async ({ participants: existingIds }) => {
            console.log('[GroupCall] Existing participants:', existingIds);
            // I am the non-initiator for all existing participants
            // They will send me offers, so I create non-initiator peers
            const stream = localStreamRef.current;
            if (!stream) return;
            for (const pid of existingIds) {
                if (pid === user?._id) continue;
                await createPeerForUser(pid, false, stream);
            }
        };

        // ── Group: a participant left ──
        const handleParticipantLeft = ({ userId: leftUserId, username }) => {
            console.log('[GroupCall] Participant left:', username, leftUserId);
            // Destroy peer for this user
            if (peersRef.current[leftUserId]) {
                try { peersRef.current[leftUserId].destroy(); } catch { /* ignore */ }
                delete peersRef.current[leftUserId];
            }
            setRemoteStreams(prev => {
                const next = { ...prev };
                delete next[leftUserId];
                return next;
            });
            setParticipants(prev => prev.filter(p => p._id !== leftUserId));

            // If no more peers, end the call
            if (Object.keys(peersRef.current).length === 0) {
                cleanup();
            }
        };

        // ── WebRTC signaling (works for both 1-1 and group) ──
        const handleOffer = async ({ fromUserId, sdp }) => {
            console.log('[Call] Received offer from', fromUserId);
            // For group calls or if we have a peer for this user
            if (peersRef.current[fromUserId]) {
                peersRef.current[fromUserId].signal(sdp);
                return;
            }

            // If group call but no peer yet → create non-initiator peer
            // Use a ref-based check instead of stale callState
            const currentCallState = callState;
            if (currentCallState.isGroup || Object.keys(peersRef.current).length > 0) {
                const stream = localStreamRef.current;
                if (stream) {
                    const peer = await createPeerForUser(fromUserId, false, stream);
                    peer.signal(sdp);
                }
                return;
            }

            // 1-1 call flow
            targetUserIdRef.current = fromUserId;
            try {
                const stream = localStreamRef.current;
                if (!stream) { cleanup(); return; }
                const peer = await createPeer(false, stream);
                peer.signal(sdp);
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
            console.log('[Call] Received answer from', fromUserId);
            // Group: route to specific peer
            if (peersRef.current[fromUserId]) {
                peersRef.current[fromUserId].signal(sdp);
                return;
            }
            // 1-1
            if (peerRef.current) {
                peerRef.current.signal(sdp);
            } else {
                pendingSignalsRef.current.push(sdp);
            }
        };

        const handleICE = ({ fromUserId, candidate }) => {
            // Group: route to specific peer
            if (peersRef.current[fromUserId]) {
                peersRef.current[fromUserId].signal(candidate);
                return;
            }
            // 1-1
            if (peerRef.current) {
                peerRef.current.signal(candidate);
            } else {
                // Buffer for group peer that hasn't been created yet
                if (fromUserId) {
                    if (!pendingSignalsGroupRef.current[fromUserId]) {
                        pendingSignalsGroupRef.current[fromUserId] = [];
                    }
                    pendingSignalsGroupRef.current[fromUserId].push(candidate);
                } else {
                    pendingSignalsRef.current.push(candidate);
                }
            }
        };

        const handleRemoteScreenShare = ({ fromUserId, sharing }) => {
            console.log('[Call] Remote screen-share status:', sharing, 'from:', fromUserId);
            setRemoteScreenSharing(!!sharing);
        };

        on('call:incoming', handleIncoming);
        on('call:cancelled', handleCancelled);
        on('call:rejected', handleRejected);
        on('call:ended', handleEnded);
        on('call:timeout', handleTimeout);
        on('call:accepted', handleAccepted);
        on('call:participant-joined', handleParticipantJoined);
        on('call:existing-participants', handleExistingParticipants);
        on('call:participant-left', handleParticipantLeft);
        on('webrtc:offer', handleOffer);
        on('webrtc:answer', handleAnswer);
        on('webrtc:ice-candidate', handleICE);
        on('screen-share:status', handleRemoteScreenShare);

        return () => {
            off('call:incoming', handleIncoming);
            off('call:cancelled', handleCancelled);
            off('call:rejected', handleRejected);
            off('call:ended', handleEnded);
            off('call:timeout', handleTimeout);
            off('call:accepted', handleAccepted);
            off('call:participant-joined', handleParticipantJoined);
            off('call:existing-participants', handleExistingParticipants);
            off('call:participant-left', handleParticipantLeft);
            off('webrtc:offer', handleOffer);
            off('webrtc:answer', handleAnswer);
            off('webrtc:ice-candidate', handleICE);
            off('screen-share:status', handleRemoteScreenShare);
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [on, off, user, cleanup, getMediaStream, createPeer, createPeerForUser, callState.isGroup]);

    // ---- Actions ----
    const initiateCall = useCallback(async (roomId, targetUserId, callType = 'video', targetUserName = '', options = {}) => {
        if (callState.active || callState.outgoing || callState.incoming) return;
        const { isGroup = false, targetUserIds = [], roomName = '' } = options;
        try {
            console.log('[Call] initiateCall:', { roomId, targetUserId, callType, isGroup, targetUserIds });
            await getMediaStream(callType);

            if (isGroup) {
                // Group call: send all member IDs
                emit('call:initiate', { roomId, targetUserIds, callType });
                setCallState({
                    active: false,
                    incoming: false,
                    outgoing: true,
                    roomId,
                    callType,
                    caller: user,
                    callee: null,
                    isGroup: true,
                    roomName,
                });
            } else {
                // 1-1 call
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
                    isGroup: false,
                    roomName: '',
                });
            }
        } catch (err) {
            console.error('[Call] initiateCall failed:', err);
        }
    }, [emit, user, getMediaStream, callState.active, callState.outgoing, callState.incoming]);

    const acceptCall = useCallback(async () => {
        if (acceptingRef.current) return;
        acceptingRef.current = true;

        const { roomId, caller, callType, isGroup } = callState;
        console.log('[Call] acceptCall, caller:', caller?._id, 'callType:', callType, 'isGroup:', isGroup);
        targetUserIdRef.current = caller?._id || null;
        stopRingtone();
        if (notifRef.current) { notifRef.current.close(); notifRef.current = null; }

        setCallState((prev) => ({ ...prev, incoming: false, active: true }));
        setCallError(null);

        try {
            if (!localStreamRef.current) {
                if (callType === 'video') {
                    try {
                        await getMediaStream('video');
                    } catch (videoErr) {
                        console.warn('[Call] Camera failed, falling back to audio-only:', videoErr.message);
                        setCallError('Không thể truy cập camera, chuyển sang gọi thoại');
                        await getMediaStream('audio');
                        setCallState((prev) => ({ ...prev, callType: 'audio' }));
                    }
                } else {
                    await getMediaStream(callType);
                }
            }
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

    const inviteMember = useCallback((targetUserId) => {
        if (!callState.roomId || !callState.isGroup) return;
        emit('call:invite-member', { roomId: callState.roomId, targetUserId });
    }, [emit, callState.roomId, callState.isGroup]);

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

    // ── Direct stop screen share (avoids stale closure in onended) ──
    const stopScreenShareDirect = useCallback(async () => {
        const isGroup = Object.keys(peersRef.current).length > 0;
        const peers = isGroup
            ? Object.values(peersRef.current)
            : (peerRef.current ? [peerRef.current] : []);

        if (screenStreamRef.current) {
            screenStreamRef.current.getTracks().forEach((t) => t.stop());
            screenStreamRef.current = null;
        }
        const originalTrack = originalVideoTrackRef.current;
        if (originalTrack && peers.length > 0) {
            for (const peer of peers) {
                const pc = peer._pc;
                if (!pc) continue;
                const sender = pc.getSenders().find((s) => s.track?.kind === 'video');
                if (sender) await sender.replaceTrack(originalTrack);
            }
            originalVideoTrackRef.current = null;
        }
        setScreenSharing(false);
        setScreenStream(null);
        if (isGroup) {
            emit('screen-share:status', { roomId: callState.roomId, sharing: false });
        } else {
            emit('screen-share:status', { targetUserId: targetUserIdRef.current, sharing: false });
        }
        console.log('[Call] Screen share stopped (track ended or manual)');
        // Try to focus back to the chat tab
        try { window.focus(); } catch { /* ignore */ }
    }, [callState.roomId, emit]);

    const toggleScreenShare = useCallback(async () => {
        // For group calls, replace track on ALL peers
        const isGroup = Object.keys(peersRef.current).length > 0;
        const peers = isGroup
            ? Object.values(peersRef.current)
            : (peerRef.current ? [peerRef.current] : []);

        if (peers.length === 0) return;

        if (screenSharing) {
            await stopScreenShareDirect();
        } else {
            try {
                const newScreenStream = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: false });
                screenStreamRef.current = newScreenStream;
                const screenTrack = newScreenStream.getVideoTracks()[0];

                // Save original camera track (from first peer)
                const firstPc = peers[0]?._pc;
                if (firstPc) {
                    const sender = firstPc.getSenders().find((s) => s.track?.kind === 'video');
                    if (sender) originalVideoTrackRef.current = sender.track;
                }

                // Replace on all peers
                for (const peer of peers) {
                    const pc = peer._pc;
                    if (!pc) continue;
                    const sender = pc.getSenders().find((s) => s.track?.kind === 'video');
                    if (sender) await sender.replaceTrack(screenTrack);
                }

                // Listen for browser "Stop sharing" button — uses stopScreenShareDirect
                // (not toggleScreenShare) to avoid stale closure issues
                screenTrack.onended = () => { stopScreenShareDirect(); };

                setScreenSharing(true);
                setScreenStream(newScreenStream);
                if (isGroup) {
                    emit('screen-share:status', { roomId: callState.roomId, sharing: true });
                } else {
                    emit('screen-share:status', { targetUserId: targetUserIdRef.current, sharing: true });
                }
            } catch (err) {
                console.warn('[Call] Screen share cancelled or failed:', err.message);
            }
        }
    }, [screenSharing, callState.roomId, emit, stopScreenShareDirect]);

    return (
        <CallContext.Provider
            value={{
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
                initiateCall,
                acceptCall,
                rejectCall,
                cancelCall,
                endCall,
                inviteMember,
                toggleAudio,
                toggleVideo,
                toggleScreenShare,
            }}
        >
            {children}
        </CallContext.Provider>
    );
}
