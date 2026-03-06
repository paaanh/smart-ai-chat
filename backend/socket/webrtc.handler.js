const { User } = require('../models/User');
const Message = require('../models/Message');

// ─── Active Calls Tracker (in-memory) ─────────────────────────────────
const activeCalls = new Map(); // roomId → { callType, callerId, participants[], startTime }

module.exports = (io, socket) => {
    const userId = socket.user._id.toString();

    // ─── Helper: lấy socketId của target user ───────────────────────────
    const getSocketId = async (targetUserId) => {
        const user = await User.findById(targetUserId).select('socketId').lean();
        return user?.socketId || null;
    };

    // ═══════════════════════════════════════════════════════════════════
    // ─── Call Management ──────────────────────────────────────────────
    // ═══════════════════════════════════════════════════════════════════

    // ─── call:initiate ──────────────────────────────────────────────────
    socket.on('call:initiate', async ({ roomId, callType, targetUserIds, targetUserId }) => {
        try {
            console.log(`📞 ${socket.user.username} initiating ${callType} call in room ${roomId}`);

            // Normalize: accept both singular targetUserId and plural targetUserIds
            const targets = targetUserIds || (targetUserId ? [targetUserId] : []);

            // Kiểm tra nếu room đang có cuộc gọi
            if (activeCalls.has(roomId)) {
                return socket.emit('call:error', {
                    roomId,
                    error: 'Room đang có cuộc gọi khác',
                });
            }

            // Tạo call record
            activeCalls.set(roomId, {
                callType,
                callerId: userId,
                participants: [userId],
                targetUserIds: targets,
                startTime: Date.now(),
            });

            // Timeout: tự hủy nếu không ai nhận sau 30s
            setTimeout(() => {
                const call = activeCalls.get(roomId);
                if (call && call.participants.length <= 1) {
                    activeCalls.delete(roomId);
                    io.to(socket.id).emit('call:timeout', { roomId });
                }
            }, 30000);

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
                    });
                }
            }

            // Tạo system message
            await Message.create({
                room: roomId,
                sender: socket.user._id,
                type: 'system',
                content: `📞 ${socket.user.username} đã bắt đầu cuộc gọi ${callType === 'video' ? 'video' : 'thoại'}`,
            });

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
            if (call) {
                call.participants.push(userId);
            }

            const callerSocketId = await getSocketId(callerId);
            if (callerSocketId) {
                io.to(callerSocketId).emit('call:accepted', {
                    roomId,
                    userId,
                    username: socket.user.username,
                });
            }
        } catch (error) {
            console.error('call:accept error:', error.message);
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

            // Nếu tất cả reject, xóa call
            const call = activeCalls.get(roomId);
            if (call) {
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

            activeCalls.delete(roomId);

            // Emit to each participant's socketId directly
            const participants = call?.participants || [];
            for (const pid of participants) {
                if (pid === userId) continue; // don't notify self
                const pSocketId = await getSocketId(pid);
                if (pSocketId) {
                    io.to(pSocketId).emit('call:ended', { roomId, userId, duration });
                }
            }

            // System message kết thúc cuộc gọi
            const durationStr = duration > 60
                ? `${Math.floor(duration / 60)} phút ${duration % 60} giây`
                : `${duration} giây`;

            await Message.create({
                room: roomId,
                sender: socket.user._id,
                type: 'system',
                content: `📞 Cuộc gọi ${callType === 'video' ? 'video' : 'thoại'} đã kết thúc (${durationStr})`,
            });

            console.log(`📞 Call ended in room ${roomId} - Duration: ${durationStr}`);
        } catch (error) {
            console.error('call:end error:', error.message);
        }
    });

    // ═══════════════════════════════════════════════════════════════════
    // ─── WebRTC Signaling (P2P) ───────────────────────────────────────
    // Server chỉ làm trung gian relay SDP và ICE candidates
    // ═══════════════════════════════════════════════════════════════════

    // ─── webrtc:offer ──────────────────────────────────────────────────
    socket.on('webrtc:offer', async ({ targetUserId, sdp }) => {
        console.log(`📡 [OFFER] ${socket.user.username} (${userId}) → target ${targetUserId}`);
        const targetSocketId = await getSocketId(targetUserId);
        console.log(`📡 [OFFER] targetSocketId resolved: ${targetSocketId}`);
        if (targetSocketId) {
            io.to(targetSocketId).emit('webrtc:offer', {
                fromUserId: userId,
                sdp,
            });
            console.log(`📡 [OFFER] Relayed to ${targetSocketId}`);
        } else {
            console.log(`❌ [OFFER] Target ${targetUserId} has no socketId!`);
        }
    });

    // ─── webrtc:answer ─────────────────────────────────────────────────
    socket.on('webrtc:answer', async ({ targetUserId, sdp }) => {
        console.log(`📡 [ANSWER] ${socket.user.username} (${userId}) → target ${targetUserId}`);
        const targetSocketId = await getSocketId(targetUserId);
        console.log(`📡 [ANSWER] targetSocketId resolved: ${targetSocketId}`);
        if (targetSocketId) {
            io.to(targetSocketId).emit('webrtc:answer', {
                fromUserId: userId,
                sdp,
            });
            console.log(`📡 [ANSWER] Relayed to ${targetSocketId}`);
        } else {
            console.log(`❌ [ANSWER] Target ${targetUserId} has no socketId!`);
        }
    });

    // ─── webrtc:ice-candidate ──────────────────────────────────────────
    socket.on('webrtc:ice-candidate', async ({ targetUserId, candidate }) => {
        console.log(`🧳 [ICE] ${socket.user.username} (${userId}) → target ${targetUserId}`);
        const targetSocketId = await getSocketId(targetUserId);
        if (targetSocketId) {
            io.to(targetSocketId).emit('webrtc:ice-candidate', {
                fromUserId: userId,
                candidate,
            });
        } else {
            console.log(`❌ [ICE] Target ${targetUserId} has no socketId!`);
        }
    });

    // ─── Cleanup khi disconnect ────────────────────────────────────────
    socket.on('disconnect', () => {
        // Tìm và cleanup calls mà user đang tham gia
        for (const [roomId, call] of activeCalls.entries()) {
            if (call.participants.includes(userId)) {
                call.participants = call.participants.filter(id => id !== userId);
                if (call.participants.length === 0) {
                    activeCalls.delete(roomId);
                } else {
                    socket.to(roomId).emit('call:participant-left', {
                        roomId,
                        userId,
                        username: socket.user.username,
                    });
                }
            }
        }
    });
};

// Export cho testing
module.exports.activeCalls = activeCalls;
