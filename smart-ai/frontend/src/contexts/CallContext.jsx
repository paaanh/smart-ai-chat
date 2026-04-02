import { useState, useCallback, useEffect, useRef } from 'react';
import { useSocket } from '../hooks/useSocket';
import { useAuth } from '../hooks/useAuth';
import { CallContext } from '.';
import { startRingtone, stopRingtone } from '../utils/ringtone';
import { emitToast } from '../utils/toast';

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

    // Ref to track isGroup for use in socket handlers (avoids stale closure)
    const isGroupRef = useRef(false);

    const safePeerSignal = useCallback((peer, signalData, label = 'signal') => {
        if (!peer || peer.destroyed || !signalData) {
            return false;
        }
        try {
            peer.signal(signalData);
            return true;
        } catch (err) {
            console.warn(`[Call] Ignored ${label} on invalid peer:`, err.message);
            return false;
        }
    }, []);

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
    const callDurationRef = useRef(0);
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

    // ── Device Selection ──
    const [availableDevices, setAvailableDevices] = useState({ audio: [], video: [] });
    const [selectedDevices, setSelectedDevices] = useState({ audioId: '', videoId: '' });

    // ── Network & Quality ──
    const [videoQuality, setVideoQuality] = useState('auto'); // 'auto', 'low', 'high'
    const [networkStats, setNetworkStats] = useState({
        bandwidth: 0,
        latency: 0,
        packetLoss: 0,
        videoResolution: '0x0',
        connectionState: 'new',
    });

    // ── Call History (session-based) ──
    const [callHistory, setCallHistory] = useState(() => {
        try {
            const stored = sessionStorage.getItem('callHistory');
            return stored ? JSON.parse(stored) : [];
        } catch {
            return [];
        }
    });

    // Refs for stats monitoring
    const statsIntervalRef = useRef(null);

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

    // ── Enumerate available devices on mount ──
    useEffect(() => {
        const enumerateDevices = async () => {
            try {
                const devices = await navigator.mediaDevices.enumerateDevices();
                const audioDevices = devices.filter(d => d.kind === 'audioinput');
                const videoDevices = devices.filter(d => d.kind === 'videoinput');
                setAvailableDevices({ audio: audioDevices, video: videoDevices });
                // Auto-select first available if not set
                if (!selectedDevices.audioId && audioDevices.length > 0) {
                    setSelectedDevices(prev => ({ ...prev, audioId: audioDevices[0].deviceId }));
                }
                if (!selectedDevices.videoId && videoDevices.length > 0) {
                    setSelectedDevices(prev => ({ ...prev, videoId: videoDevices[0].deviceId }));
                }
            } catch (err) {
                console.warn('[Call] enumerateDevices failed:', err.message);
            }
        };
        enumerateDevices();
        // Listen for device changes
        navigator.mediaDevices?.addEventListener('devicechange', enumerateDevices);
        return () => navigator.mediaDevices?.removeEventListener('devicechange', enumerateDevices);
    }, []);

    // ── Helper: Add call to history ──
    const addToCallHistory = useCallback((callInfo) => {
        setCallHistory(prev => {
            const updated = [...prev, { timestamp: Date.now(), ...callInfo }].slice(-50); // Keep last 50
            sessionStorage.setItem('callHistory', JSON.stringify(updated));
            return updated;
        });
    }, []);

    // ---- Helpers ----

    // Keep isGroupRef in sync
    useEffect(() => { isGroupRef.current = callState.isGroup; }, [callState.isGroup]);

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
        callDurationRef.current = 0;
        stopStatsMonitoring();
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
        
        // Build quality constraints
        const videoConstraints = type === 'video' ? {
            deviceId: selectedDevices.videoId ? { ideal: selectedDevices.videoId } : undefined,
            ...getVideoConstraintsByQuality(videoQuality)
        } : false;

        const constraints = {
            audio: selectedDevices.audioId ? { deviceId: { ideal: selectedDevices.audioId } } : true,
            video: videoConstraints,
        };
        
        const stream = await navigator.mediaDevices.getUserMedia(constraints);
        localStreamRef.current = stream;
        setLocalStream(stream);
        console.log('[Call] getMediaStream OK, tracks:', stream.getTracks().map(t => `${t.kind}:${t.readyState}`).join(', '));
        return stream;
    }, [selectedDevices, videoQuality]);

    // ── Helper: Get video quality constraints ──
    const getVideoConstraintsByQuality = useCallback((quality) => {
        switch (quality) {
            case 'high':
                return { width: { ideal: 1280 }, height: { ideal: 720 }, frameRate: { ideal: 30 } };
            case 'low':
                return { width: { ideal: 320 }, height: { ideal: 240 }, frameRate: { ideal: 15 } };
            case 'auto':
            default:
                return { width: { ideal: 640 }, height: { ideal: 480 }, frameRate: { ideal: 24 } };
        }
    }, []);

    // ── Helper: Change input device ──
    const changeDevice = useCallback(async (kind, deviceId) => {
        if (kind === 'audio') {
            setSelectedDevices(prev => ({ ...prev, audioId: deviceId }));
            if (localStreamRef.current) {
                const audioTrack = localStreamRef.current.getAudioTracks()[0];
                if (audioTrack && deviceId) {
                    try {
                        await audioTrack.applyConstraints({ deviceId: { exact: deviceId } });
                    } catch (err) {
                        console.error('[Call] Failed to apply audio device:', err.message);
                    }
                }
            }
        } else if (kind === 'video') {
            setSelectedDevices(prev => ({ ...prev, videoId: deviceId }));
            if (localStreamRef.current) {
                const videoTrack = localStreamRef.current.getVideoTracks()[0];
                if (videoTrack && deviceId) {
                    try {
                        await videoTrack.applyConstraints({ deviceId: { exact: deviceId } });
                    } catch (err) {
                        console.error('[Call] Failed to apply video device:', err.message);
                    }
                }
            }
        }
    }, []);

    // ── Helper: Start WebRTC stats monitoring ──
    const startStatsMonitoring = useCallback((peer) => {
        if (!peer || !peer._pc) return;
        if (statsIntervalRef.current) clearInterval(statsIntervalRef.current);

        statsIntervalRef.current = setInterval(async () => {
            try {
                const stats = await peer._pc.getStats();
                let bandwidth = 0, latency = 0, packetLoss = 0, videoResolution = '0x0', connectionState = 'new';

                stats.forEach(report => {
                    if (report.type === 'inbound-rtp' && report.kind === 'video') {
                        const bytes = report.bytesReceived;
                        const packets = report.packetsReceived;
                        const packetsLost = report.packetsLost || 0;
                        if (packets > 0) {
                            packetLoss = Math.round((packetsLost / (packets + packetsLost)) * 100);
                        }
                        bandwidth = Math.round((bytes * 8) / 1000); // kbps
                        videoResolution = `${report.frameWidth}x${report.frameHeight}`;
                    }
                    if (report.type === 'candidate-pair' && report.state === 'succeeded') {
                        latency = Math.round(report.currentRoundTripTime * 1000); // ms
                        connectionState = report.state;
                    }
                });

                setNetworkStats({ bandwidth, latency, packetLoss, videoResolution, connectionState });
            } catch (err) {
                console.warn('[Call] Stats monitoring error:', err.message);
            }
        }, 1000); // Update every second
    }, []);

    // ── Helper: Stop stats monitoring ──
    const stopStatsMonitoring = useCallback(() => {
        if (statsIntervalRef.current) {
            clearInterval(statsIntervalRef.current);
            statsIntervalRef.current = null;
        }
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
        // Start monitoring stats for this peer
        startStatsMonitoring(peer);
        return peer;
    }, [emit, startStatsMonitoring]);

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
            pending.forEach(sig => safePeerSignal(peer, sig, 'pending-group-signal'));
            delete pendingSignalsGroupRef.current[targetId];
        }

        // Start monitoring stats for this peer
        startStatsMonitoring(peer);
        return peer;
    }, [emit, safePeerSignal, startStatsMonitoring]);

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

        const handleCancelled = () => {
            console.log('[Call] Call cancelled');
            // Missed call (caller cancelled before callee answered)
            if (callState.incoming && !callState.active) {
                const caller = callState.caller;
                addToCallHistory({
                    type: 'missed',
                    from: caller?.username || 'Unknown',
                    fromId: caller?._id,
                    duration: 0,
                });
                emitToast(`📞 Cuộc gọi nhỡ từ ${caller?.username || 'ai đó'}`, { duration: 5000 });
            }
            cleanup();
        };

        const handleRejected = () => {
            console.log('[Call] Call rejected');
            if (!callState.active) {
                addToCallHistory({
                    type: 'rejected',
                    from: callState.caller?.username || 'Unknown',
                    fromId: callState.caller?._id,
                    duration: 0,
                });
            }
            cleanup();
        };

        const handleEnded = () => {
            console.log('[Call] Call ended');
            if (callState.active) {
                addToCallHistory({
                    type: 'completed',
                    from: callState.outgoing ? callState.callee?.username : callState.caller?.username,
                    fromId: callState.outgoing ? callState.callee?._id : callState.caller?._id,
                    duration: callDurationRef?.current || 0,
                });
            }
            cleanup();
        };

        const handleTimeout = () => {
            console.log('[Call] Call timeout');
            addToCallHistory({
                type: 'timeout',
                from: callState.callee?.username || callState.caller?.username || 'Unknown',
                fromId: callState.callee?._id || callState.caller?._id,
                duration: 0,
            });
            cleanup();
        };

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
                    safePeerSignal(peer, pendingSignalsRef.current.shift(), 'pending-accepted-signal');
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
            // Emit toast notification
            emitToast(`👤 ${username} đã tham gia cuộc gọi`, { duration: 3000 });
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
            // Emit toast notification
            emitToast(`👤 ${username} đã rời khỏi cuộc gọi`, { duration: 3000 });
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
            if (!sdp) return;
            // For group calls or if we have a peer for this user
            if (peersRef.current[fromUserId]) {
                safePeerSignal(peersRef.current[fromUserId], sdp, 'group-offer-existing-peer');
                return;
            }

            // If group call but no peer yet → create non-initiator peer
            // Use ref to avoid stale closure
            if (isGroupRef.current || Object.keys(peersRef.current).length > 0) {
                const stream = localStreamRef.current;
                if (stream) {
                    const peer = await createPeerForUser(fromUserId, false, stream);
                    safePeerSignal(peer, sdp, 'group-offer-new-peer');
                }
                return;
            }

            // 1-1 call flow
            targetUserIdRef.current = fromUserId;
            try {
                const stream = localStreamRef.current;
                if (!stream) { cleanup(); return; }
                const peer = await createPeer(false, stream);
                safePeerSignal(peer, sdp, 'one-to-one-offer');
                while (pendingSignalsRef.current.length > 0) {
                    safePeerSignal(peer, pendingSignalsRef.current.shift(), 'pending-offer-signal');
                }
            } catch (err) {
                console.error('[Call] handleOffer failed:', err);
                pendingSignalsRef.current = [];
                cleanup();
            }
        };

        const handleAnswer = ({ fromUserId, sdp }) => {
            console.log('[Call] Received answer from', fromUserId);
            if (!sdp) return;
            // Group: route to specific peer
            if (peersRef.current[fromUserId]) {
                safePeerSignal(peersRef.current[fromUserId], sdp, 'group-answer');
                return;
            }
            // 1-1
            if (peerRef.current) {
                safePeerSignal(peerRef.current, sdp, 'one-to-one-answer');
            } else {
                pendingSignalsRef.current.push(sdp);
            }
        };

        const handleICE = ({ fromUserId, candidate }) => {
            if (!candidate) return;
            // Group: route to specific peer
            if (peersRef.current[fromUserId]) {
                safePeerSignal(peersRef.current[fromUserId], candidate, 'group-ice');
                return;
            }
            // 1-1
            if (peerRef.current) {
                safePeerSignal(peerRef.current, candidate, 'one-to-one-ice');
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
    }, [on, off, user, cleanup, getMediaStream, createPeer, createPeerForUser, callState.isGroup, safePeerSignal]);

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

    const toggleVideo = useCallback(async () => {
        if (!localStreamRef.current) return;
        const stream = localStreamRef.current;
        const track = stream.getVideoTracks()[0];

        if (track && track.enabled) {
            // Disable: just toggle off (keep track alive for easy re-enable)
            track.enabled = false;
            // Force React re-render
            setLocalStream(new MediaStream(stream.getTracks()));
        } else if (track && !track.enabled && track.readyState === 'live') {
            // Re-enable existing live track
            track.enabled = true;
            setLocalStream(new MediaStream(stream.getTracks()));
        } else {
            // Track is ended or doesn't exist — get a fresh video track
            try {
                const newStream = await navigator.mediaDevices.getUserMedia({ video: true });
                const newTrack = newStream.getVideoTracks()[0];
                if (!newTrack) return;

                // Remove old track if exists
                if (track) {
                    stream.removeTrack(track);
                    track.stop();
                }
                stream.addTrack(newTrack);

                // Replace track in all peer connections
                const peers = Object.keys(peersRef.current).length > 0
                    ? Object.values(peersRef.current)
                    : (peerRef.current ? [peerRef.current] : []);

                for (const peer of peers) {
                    const pc = peer._pc;
                    if (!pc) continue;
                    const senders = pc.getSenders();
                    const videoSender = senders.find(s => s.track?.kind === 'video')
                        || senders.find(s => !s.track && pc.getTransceivers?.()?.some(t => t.sender === s && t.mid !== null && t.receiver?.track?.kind === 'video'));
                    if (videoSender) {
                        await videoSender.replaceTrack(newTrack);
                    } else {
                        // No video sender found — add track directly
                        try { pc.addTrack(newTrack, stream); } catch { /* ignore */ }
                    }
                }

                // Update state so React re-renders
                setLocalStream(new MediaStream(stream.getTracks()));
            } catch (err) {
                console.error('[Call] toggleVideo: failed to get new track:', err.message);
                // Last resort: just enable existing track
                if (track) {
                    track.enabled = true;
                    setLocalStream(new MediaStream(stream.getTracks()));
                }
            }
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
                // Device Selection
                availableDevices,
                selectedDevices,
                changeDevice,
                // Network & Quality
                videoQuality,
                setVideoQuality,
                networkStats,
                // Call History
                callHistory,
            }}
        >
            {children}
        </CallContext.Provider>
    );
}
