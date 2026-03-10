const { User } = require('../models/User');
const Room = require('../models/Room');
const Message = require('../models/Message');

module.exports = (io, socket) => {
    const userId = socket.user._id;

    // ─── room:join ──────────────────────────────────────────────────────
    socket.on('room:join', async ({ roomId }) => {
        try {
            const room = await Room.findById(roomId);
            if (!room) return socket.emit('error', { message: 'Room không tồn tại' });

            const isMember = room.members.some(m => m.user.toString() === userId.toString());
            if (!isMember) return socket.emit('error', { message: 'Bạn không phải thành viên' });

            // Join socket room
            socket.join(roomId);

            // Lấy tin nhắn gần nhất
            const messages = await Message.getByRoom(roomId, { page: 1, limit: 50 });

            // Lấy members info
            const populatedRoom = await Room.findById(roomId)
                .populate('members.user', 'username avatar googlePicture status preferredLanguage preferredLanguageLabel socketId');

            socket.emit('room:joined', {
                roomId,
                messages,
                members: populatedRoom.members,
            });

            console.log(`🚪 ${socket.user.username} joined room ${roomId}`);
        } catch (error) {
            console.error('room:join error:', error.message);
            socket.emit('error', { message: 'Lỗi khi join room' });
        }
    });

    // ─── room:leave ─────────────────────────────────────────────────────
    socket.on('room:leave', ({ roomId }) => {
        socket.leave(roomId);
        console.log(`🚪 ${socket.user.username} left room ${roomId}`);
    });

    // ─── room:create ────────────────────────────────────────────────────
    socket.on('room:create', async ({ name, type, memberIds }) => {
        try {
            // Direct chat
            if (type === 'direct' && memberIds.length === 1) {
                const existingRoom = await Room.findDirectRoom(userId, memberIds[0]);
                if (existingRoom) {
                    const populated = await existingRoom.populate('members.user', 'username avatar googlePicture status preferredLanguage preferredLanguageLabel');
                    socket.emit('room:created', { room: populated, existing: true });
                    return;
                }
            }

            const members = [
                { user: userId, role: 'admin' },
                ...memberIds.map(id => ({ user: id, role: 'member' })),
            ];

            const room = await Room.create({
                name: type === 'group' ? name : null,
                type,
                members,
            });

            const populated = await room.populate('members.user', 'username avatar googlePicture status preferredLanguage preferredLanguageLabel socketId');

            // Thông báo cho tất cả members online
            for (const member of populated.members) {
                const memberSocketId = member.user.socketId;
                if (memberSocketId) {
                    io.to(memberSocketId).emit('room:created', { room: populated });
                }
            }
        } catch (error) {
            console.error('room:create error:', error.message);
            socket.emit('error', { message: 'Lỗi khi tạo room' });
        }
    });

    // ─── room:typing ────────────────────────────────────────────────────
    socket.on('room:typing', ({ roomId }) => {
        socket.to(roomId).emit('room:typing', {
            roomId,
            userId: userId.toString(),
            username: socket.user.username,
        });
    });

    // ─── room:stop-typing ───────────────────────────────────────────────
    socket.on('room:stop-typing', ({ roomId }) => {
        socket.to(roomId).emit('room:stop-typing', {
            roomId,
            userId: userId.toString(),
        });
    });
};
