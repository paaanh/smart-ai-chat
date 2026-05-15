const { User } = require('../models/User');
const Message = require('../models/Message');
const Room = require('../models/Room');
const Friendship = require('../models/Friendship');

// ─── Active Calls Tracker (in-memory) ─────────────────────────────────
const activeCalls = new Map(); // roomId → { callType, callerId, participants[], startTime, isGroup, roomName }

module.exports = (io, socket) => {
    const userId = socket.user._id.toString();

    // ─── Helper: lấy socketId của target user ───────────────────────────
    const getSocketId = async (targetUserId) => {
        const user = await User.findById(targetUserId).select('socketId').lean();
        return user?.socketId || null;
    };

    const ensureFriendship = async (sourceUserId, targetUserId) => {
        if (!targetUserId || sourceUserId.toString() === targetUserId.toString()) return false;
        return Friendship.areFriends(sourceUserId, targetUserId);
    };

    // ═══════════════════════════════════════════════════════════════════
    // ─── Call Management ──────────────────────────────────────────────
    // ═══════════════════════════════════════════════════════════════════

    // ─── call:initiate ──────────────────────────────────────────────────
    socket.on('call:initiate', async ({ roomId, callType, targetUserIds, targetUserId }) => {
        try {
            console.log(`📞 ${socket.user.username} initiating ${callType} call in room ${roomId}`);

            // Normalize: accept both singular targetUserId and plural targetUserIds
            const targets = [...new Set((targetUserIds || (targetUserId ? [targetUserId] : [])).filter(Boolean))];

            if (!targets.length) {
                return socket.emit('call:error', { roomId, error: 'Không có người nhận cuộc gọi' });
            }

            // Kiểm tra nếu room đang có cuộc gọi
            if (activeCalls.has(roomId)) {
                return socket.emit('call:error', {
                    roomId,
                    error: 'Room đang có cuộc gọi khác',
                });
            }

            // Check if this is a group call
            const room = await Room.findById(roomId).lean();
            if (!room) {
                return socket.emit('call:error', { roomId, error: 'Phòng gọi không tồn tại' });
            }

            const isCallerMember = room.members?.some((member) => member.user.toString() === userId);
            if (!isCallerMember) {
                return socket.emit('call:error', { roomId, error: 'Bạn không phải thành viên của phòng' });
            }

            const isGroup = room?.type === 'group';

            // Friend-gated policy: chỉ gọi được khi đã là bạn bè accepted
            for (const targetId of targets) {
                const isFriend = await ensureFriendship(userId, targetId);
                if (!isFriend) {
                    return socket.emit('call:error', {
                        roomId,
                        error: 'Chỉ có thể gọi cho người đã là bạn bè',
                        targetUserId: targetId,
                    });
                }
            }

            // Tạo call record
            activeCalls.set(roomId, {
                callType,
                callerId: userId,
                participants: [userId],
                targetUserIds: targets,
                startTime: Date.now(),
                isGroup,
                roomName: room?.name || '',
                systemMessageId: null,
            });

            // Timeout: tự hủy nếu không ai nhận sau 30s (only for 1-1)
            if (!isGroup) {
                setTimeout(() => {
                    const call = activeCalls.get(roomId);
                    if (call && call.participants.length <= 1) {
                        activeCalls.delete(roomId);
                        io.to(socket.id).emit('call:timeout', { roomId });
                    }
                }, 30000);
            }

            // Gửi thông báo cuộc gọi đến cho từng target
            const caller = {
                _id: userId,
                username: socket.user.username,
                avatar: socket.user.avatar || '',
            };
            for (const targetId of targets) {
                const targetSocketId = await getSocketId(targetId);
                if (targetSocketId) {
                    io.to(targetSocketId).emit('call:incoming', {
                        roomId,
                        callType,
                        caller,
                        isGroup,
                        roomName: room?.name || '',
                    });
                }
            }

            // Tạo system message kèm callEvent metadata
            const callLabel = callType === 'video' ? 'video' : 'thoại';
            const prefix = isGroup ? `nhóm ${callLabel}` : callLabel;
            const sysMsg = await Message.create({
                room: roomId,
                sender: socket.user._id,
                type: 'system',
                content: `📞 ${socket.user.username} đã bắt đầu cuộc gọi ${prefix}`,
                callEvent: { kind: 'started', callType, isGroup },
            });
            // Track for later update on call:end
            const tracked = activeCalls.get(roomId);
            if (tracked) tracked.systemMessageId = sysMsg._id.toString();

            // Broadcast to room so all members see the call card immediately
            const populated = await Message.findById(sysMsg._id)
                .populate('sender', 'username avatar googlePicture preferredLanguage preferredBubbleFrame')
                .lean();
            io.to(roomId).emit('message:received', { message: populated });

        } catch (error) {
            console.error('call:initiate error:', error.message);
            socket.emit('call:error', { roomId, error: 'Không thể bắt đầu cuộc gọi' });
        }
    });

    // ─── call:accept ────────────────────────────────────────────────────
    socket.on('call:accept', async ({ roomId, callerId }) => {
        try {
            console.log(`✅ ${socket.user.username} accepted call in room ${roomId}`);

            const call = activeCalls.get(roomId);
            if (!call) {
                return socket.emit('call:error', { roomId, error: 'Cuộc gọi đã kết thúc hoặc không tồn tại' });
            }

            // Defense-in-depth: nếu không còn quan hệ bạn bè thì không cho nhận cuộc gọi
            if (callerId) {
                const isFriend = await ensureFriendship(userId, callerId);
                if (!isFriend) {
                    return socket.emit('call:error', {
                        roomId,
                        error: 'Không thể nhận cuộc gọi vì hai bên chưa là bạn bè',
                    });
                }
            }

            // Get existing participants BEFORE adding the new one
            const existingParticipants = [...call.participants];

            if (!call.participants.includes(userId)) {
                call.participants.push(userId);
            }

            if (call.isGroup) {
                // Group call: notify ALL existing participants that a new person joined
                for (const pid of existingParticipants) {
                    const pSocketId = await getSocketId(pid);
                    if (pSocketId) {
                        io.to(pSocketId).emit('call:participant-joined', {
                            roomId,
                            userId,
                            username: socket.user.username,
                            avatar: socket.user.avatar || socket.user.googlePicture || '',
                            existingParticipants: call.participants,
                        });
                    }
                }
                // Notify the new joiner about existing participants
                socket.emit('call:existing-participants', {
                    roomId,
                    participants: existingParticipants,
                });
            } else {
                // 1-1 call: notify only the caller
                const callerSocketId = await getSocketId(callerId);
                if (callerSocketId) {
                    io.to(callerSocketId).emit('call:accepted', {
                        roomId,
                        userId,
                        acceptorId: userId,
                        username: socket.user.username,
                    });
                }
            }
        } catch (error) {
            console.error('call:accept error:', error.message);
        }
    });

    // ─── call:join (user proactively joins an ongoing group call) ──────
    socket.on('call:join', async ({ roomId }) => {
        try {
            const call = activeCalls.get(roomId);
            if (!call || !call.isGroup) {
                return socket.emit('call:error', { roomId, error: 'Cuộc gọi không còn diễn ra' });
            }

            // Verify the joiner is a member of the room
            const room = await Room.findById(roomId).lean();
            if (!room) {
                return socket.emit('call:error', { roomId, error: 'Phòng không tồn tại' });
            }
            const isMember = room.members?.some(m => m.user.toString() === userId);
            if (!isMember) {
                return socket.emit('call:error', { roomId, error: 'Bạn không phải thành viên của phòng' });
            }

            if (call.participants.includes(userId)) {
                // Already in call — just resync participant list
                return socket.emit('call:existing-participants', {
                    roomId,
                    participants: call.participants.filter(id => id !== userId),
                });
            }

            console.log(`✅ ${socket.user.username} joining ongoing call in room ${roomId}`);

            const existingParticipants = [...call.participants];
            call.participants.push(userId);

            // Notify existing participants of the new joiner
            for (const pid of existingParticipants) {
                const pSocketId = await getSocketId(pid);
                if (pSocketId) {
                    io.to(pSocketId).emit('call:participant-joined', {
                        roomId,
                        userId,
                        username: socket.user.username,
                        avatar: socket.user.avatar || socket.user.googlePicture || '',
                        existingParticipants: call.participants,
                    });
                }
            }

            // Tell joiner who's already there + call meta (so they create peers as initiator)
            socket.emit('call:existing-participants', {
                roomId,
                participants: existingParticipants,
                callType: call.callType,
                roomName: call.roomName,
            });
        } catch (error) {
            console.error('call:join error:', error.message);
            socket.emit('call:error', { roomId, error: 'Không thể tham gia cuộc gọi' });
        }
    });

    // ─── call:reject ────────────────────────────────────────────────────
    socket.on('call:reject', async ({ roomId, callerId }) => {
        try {
            console.log(`❌ ${socket.user.username} rejected call in room ${roomId}`);

            const callerSocketId = await getSocketId(callerId);
            if (callerSocketId) {
                io.to(callerSocketId).emit('call:rejected', {
                    roomId,
                    userId,
                    username: socket.user.username,
                });
            }

            // Nếu tất cả reject, xóa call (only for 1-1)
            const call = activeCalls.get(roomId);
            if (call && !call.isGroup) {
                call.targetUserIds = call.targetUserIds.filter(id => id !== userId);
                if (call.targetUserIds.length === 0 && call.participants.length <= 1) {
                    activeCalls.delete(roomId);
                }
            }
        } catch (error) {
            console.error('call:reject error:', error.message);
        }
    });

    // ─── call:cancel ────────────────────────────────────────────────────
    socket.on('call:cancel', async ({ roomId }) => {
        console.log(`🚫 ${socket.user.username} cancelled call in room ${roomId}`);
        const call = activeCalls.get(roomId);
        activeCalls.delete(roomId);

        // Emit to each target's socketId directly (they may not have join'd this room)
        if (call?.targetUserIds) {
            for (const targetId of call.targetUserIds) {
                const targetSocketId = await getSocketId(targetId);
                if (targetSocketId) {
                    io.to(targetSocketId).emit('call:cancelled', { roomId, userId });
                }
            }
        }
    });

    // ─── call:end ──────────────────────────────────────────────────────
    socket.on('call:end', async ({ roomId }) => {
        try {
            const call = activeCalls.get(roomId);
            const duration = call ? Math.round((Date.now() - call.startTime) / 1000) : 0;
            const callType = call?.callType || 'audio';
            const isGroup = call?.isGroup || false;

            // Group call: participant leaving, not ending entire call
            if (isGroup && call && call.participants.length > 2) {
                call.participants = call.participants.filter(id => id !== userId);
                for (const pid of call.participants) {
                    const pSocketId = await getSocketId(pid);
                    if (pSocketId) {
                        io.to(pSocketId).emit('call:participant-left', {
                            roomId,
                            userId,
                            username: socket.user.username,
                        });
                    }
                }
                return;
            }

            // 1-1 call or last person in group → end the entire call
            activeCalls.delete(roomId);

            // Emit to each participant's socketId directly
            const participants = call?.participants || [];
            for (const pid of participants) {
                if (pid === userId) continue;
                const pSocketId = await getSocketId(pid);
                if (pSocketId) {
                    io.to(pSocketId).emit('call:ended', { roomId, userId, duration });
                }
            }

            // Update the original "started" system message to "ended" (so Join button disappears)
            const durationStr = duration > 60
                ? `${Math.floor(duration / 60)} phút ${duration % 60} giây`
                : `${duration} giây`;
            const endedContent = `📞 Cuộc gọi ${callType === 'video' ? 'video' : 'thoại'} đã kết thúc (${durationStr})`;

            if (call?.systemMessageId) {
                const updated = await Message.findByIdAndUpdate(
                    call.systemMessageId,
                    {
                        content: endedContent,
                        'callEvent.kind': 'ended',
                        'callEvent.durationSec': duration,
                    },
                    { new: true }
                );
                if (updated) {
                    io.to(roomId).emit('message:edited', {
                        messageId: updated._id.toString(),
                        content: endedContent,
                        editedAt: null,
                        callEvent: updated.callEvent,
                    });
                }
            } else {
                // Fallback (no tracked id): create a fresh ended message
                const sysMsg = await Message.create({
                    room: roomId,
                    sender: socket.user._id,
                    type: 'system',
                    content: endedContent,
                    callEvent: { kind: 'ended', callType, isGroup, durationSec: duration },
                });
                const populated = await Message.findById(sysMsg._id)
                    .populate('sender', 'username avatar googlePicture preferredLanguage preferredBubbleFrame')
                    .lean();
                io.to(roomId).emit('message:received', { message: populated });
            }

            console.log(`📞 Call ended in room ${roomId} - Duration: ${durationStr}`);
        } catch (error) {
            console.error('call:end error:', error.message);
        }
    });

    // ─── call:invite-member (Group only: invite additional members) ────
    socket.on('call:invite-member', async ({ roomId, targetUserId }) => {
        try {
            const call = activeCalls.get(roomId);
            if (!call) return socket.emit('call:error', { roomId, error: 'Cuộc gọi không tồn tại' });

            const isFriend = await ensureFriendship(userId, targetUserId);
            if (!isFriend) {
                return socket.emit('call:error', {
                    roomId,
                    error: 'Chỉ có thể mời người đã là bạn bè vào cuộc gọi',
                });
            }

            if (call.participants.includes(targetUserId)) {
                return socket.emit('call:error', { roomId, error: 'Người này đã trong cuộc gọi' });
            }

            console.log(`📞 ${socket.user.username} inviting ${targetUserId} to group call in ${roomId}`);

            const caller = {
                _id: userId,
                username: socket.user.username,
                avatar: socket.user.avatar || '',
            };

            const targetSocketId = await getSocketId(targetUserId);
            if (targetSocketId) {
                io.to(targetSocketId).emit('call:incoming', {
                    roomId,
                    callType: call.callType,
                    caller,
                    isGroup: true,
                    roomName: call.roomName || '',
                });
            }

            if (!call.targetUserIds.includes(targetUserId)) {
                call.targetUserIds.push(targetUserId);
            }
        } catch (error) {
            console.error('call:invite-member error:', error.message);
        }
    });

    // ─── call:get-participants (Get current participants list) ─────────
    socket.on('call:get-participants', async ({ roomId }) => {
        const call = activeCalls.get(roomId);
        if (!call) return;

        const participantDetails = [];
        for (const pid of call.participants) {
            const u = await User.findById(pid).select('username avatar googlePicture').lean();
            if (u) {
                participantDetails.push({
                    _id: pid,
                    username: u.username,
                    avatar: u.avatar || u.googlePicture || '',
                });
            }
        }
        socket.emit('call:participants-list', { roomId, participants: participantDetails });
    });

    // ═══════════════════════════════════════════════════════════════════
    // ─── WebRTC Signaling (P2P) ───────────────────────────────────────
    // Server chỉ làm trung gian relay SDP và ICE candidates
    // ═══════════════════════════════════════════════════════════════════

    // ─── webrtc:offer ──────────────────────────────────────────────────
    socket.on('webrtc:offer', async ({ targetUserId, sdp }) => {
        console.log(`📡 [OFFER] ${socket.user.username} (${userId}) → target ${targetUserId}`);
        if (!targetUserId || !sdp) return;

        const targetSocketId = await getSocketId(targetUserId);

        if (targetSocketId) {
            io.to(targetSocketId).emit('webrtc:offer', {
                fromUserId: userId,
                sdp,
                type: 'offer'
            });
        } else {
            console.log(`❌ [OFFER] Target ${targetUserId} has no socketId!`);
            socket.emit('webrtc:error', { code: 'USER_OFFLINE', message: 'Không thể kết nối tới người dùng này' });
        }
    });

    // ─── webrtc:answer ─────────────────────────────────────────────────
    socket.on('webrtc:answer', async ({ targetUserId, sdp }) => {
        console.log(`📡 [ANSWER] ${socket.user.username} (${userId}) → target ${targetUserId}`);
        if (!targetUserId || !sdp) return;

        const targetSocketId = await getSocketId(targetUserId);

        if (targetSocketId) {
            io.to(targetSocketId).emit('webrtc:answer', {
                fromUserId: userId,
                sdp,
                type: 'answer'
            });
        } else {
            console.log(`❌ [ANSWER] Target ${targetUserId} has no socketId!`);
            socket.emit('webrtc:error', { code: 'USER_OFFLINE', message: 'Không thể gửi phản hồi kết nối' });
        }
    });

    // ─── webrtc:ice-candidate ──────────────────────────────────────────
    socket.on('webrtc:ice-candidate', async ({ targetUserId, candidate }) => {
        // Log mức độ thấp hơn hoặc bỏ qua để tránh spam console, nhưng giữ kiểm tra
        if (!targetUserId || !candidate) return;

        const targetSocketId = await getSocketId(targetUserId);
        if (targetSocketId) {
            io.to(targetSocketId).emit('webrtc:ice-candidate', {
                fromUserId: userId,
                candidate,
            });
        } else {
            // Không emit error ở đây để tránh spam client khi ICE candidate đến dồn dập
            console.warn(`⚠️ [ICE] Failed to relay candidate from ${socket.user.username} to ${targetUserId}`);
        }
    });

    // ─── screen-share:status ─────────────────────────────────────────
    socket.on('screen-share:status', async ({ targetUserId, sharing, roomId, streamId }) => {
        if (roomId) {
            // Group call: broadcast to all participants
            const call = activeCalls.get(roomId);
            if (call) {
                for (const pid of call.participants) {
                    if (pid === userId) continue;
                    const pSocketId = await getSocketId(pid);
                    if (pSocketId) {
                        io.to(pSocketId).emit('screen-share:status', {
                            fromUserId: userId,
                            sharing,
                            streamId,
                        });
                    }
                }
            }
        } else if (targetUserId) {
            const targetSocketId = await getSocketId(targetUserId);
            if (targetSocketId) {
                io.to(targetSocketId).emit('screen-share:status', {
                    fromUserId: userId,
                    sharing,
                    streamId,
                });
            }
        }
    });

    // ─── Cleanup khi disconnect ────────────────────────────────────────
    socket.on('disconnect', async () => {
        for (const [roomId, call] of activeCalls.entries()) {
            if (call.participants.includes(userId)) {
                call.participants = call.participants.filter(id => id !== userId);
                if (call.participants.length === 0) {
                    activeCalls.delete(roomId);
                } else if (call.isGroup) {
                    // Group: notify remaining, keep call alive
                    for (const pid of call.participants) {
                        const pSocketId = await getSocketId(pid);
                        if (pSocketId) {
                            io.to(pSocketId).emit('call:participant-left', {
                                roomId,
                                userId,
                                username: socket.user.username,
                            });
                        }
                    }
                } else {
                    // 1-1: end the call
                    for (const pid of call.participants) {
                        const pSocketId = await getSocketId(pid);
                        if (pSocketId) {
                            io.to(pSocketId).emit('call:ended', {
                                roomId,
                                userId,
                                reason: 'participant-disconnected',
                            });
                        }
                    }
                    activeCalls.delete(roomId);
                }
            }
        }
    });
};

// Export cho testing
module.exports.activeCalls = activeCalls;
