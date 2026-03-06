const Room = require('../models/Room');
const Message = require('../models/Message');
const { summarizeConversation, getAIStats } = require('../services/ai.service');

module.exports = (io, socket) => {
    const userId = socket.user._id.toString();

    // ─── ai:toggle ──────────────────────────────────────────────────────
    // Bật/tắt AI Bot cho user trong 1 room cụ thể
    socket.on('ai:toggle', async ({ roomId, enabled }) => {
        try {
            const room = await Room.findById(roomId);
            if (!room) return socket.emit('error', { message: 'Room không tồn tại' });

            const member = room.members.find(m => m.user.toString() === userId);
            if (!member) return socket.emit('error', { message: 'Bạn không phải thành viên' });

            member.aiBotEnabled = enabled;
            await room.save();

            socket.emit('ai:toggled', { roomId, enabled });

            // Thông báo cho cả room biết ai bật/tắt bot
            socket.to(roomId).emit('ai:member-toggled', {
                roomId,
                userId,
                username: socket.user.username,
                enabled,
            });

            console.log(`🤖 ${socket.user.username} ${enabled ? 'bật' : 'tắt'} AI Bot trong room ${roomId}`);

            // Nếu bật, gửi tin nhắn chào
            if (enabled) {
                io.to(socket.id).emit('ai:response', {
                    roomId,
                    message: {
                        type: 'ai-response',
                        content: `🤖 Smart AI Assistant đã sẵn sàng! Tôi sẽ hỗ trợ bạn trong cuộc trò chuyện.\n\nCác lệnh nhanh:\n• Gõ "tóm tắt" để tóm tắt cuộc trò chuyện\n• Đặt câu hỏi bất kỳ và AI sẽ phản hồi`,
                        aiMetadata: { isAIResponse: true },
                        createdAt: new Date(),
                    },
                });
            }
        } catch (error) {
            console.error('ai:toggle error:', error.message);
            socket.emit('ai:error', { roomId, error: 'Không thể thay đổi trạng thái Bot' });
        }
    });

    // ─── ai:summarize ───────────────────────────────────────────────────
    // Yêu cầu AI tóm tắt cuộc trò chuyện
    socket.on('ai:summarize', async ({ roomId, messageCount = 50 }) => {
        try {
            const room = await Room.findById(roomId);
            if (!room) return socket.emit('error', { message: 'Room không tồn tại' });

            const isMember = room.members.some(m => m.user.toString() === userId);
            if (!isMember) return socket.emit('error', { message: 'Bạn không phải thành viên' });

            io.to(roomId).emit('ai:thinking', { roomId });

            const summary = await summarizeConversation(roomId, messageCount);

            if (summary) {
                // Lưu summary dưới dạng AI message
                const aiMessage = await Message.create({
                    room: roomId,
                    sender: socket.user._id,
                    type: 'ai-response',
                    content: `📋 **Tóm tắt cuộc trò chuyện**\n\n${summary}`,
                    aiMetadata: {
                        isAIResponse: true,
                        prompt: `summarize last ${messageCount} messages`,
                        model: 'gemini-2.5-flash',
                    },
                });

                const populated = await aiMessage.populate('sender', 'username avatar preferredLanguage');

                io.to(roomId).emit('ai:response', { roomId, message: populated });
                io.to(roomId).emit('message:received', { message: populated });
            } else {
                socket.emit('ai:error', { roomId, error: 'Không thể tóm tắt cuộc trò chuyện' });
            }
        } catch (error) {
            console.error('ai:summarize error:', error.message);
            socket.emit('ai:error', { roomId, error: 'Lỗi khi tóm tắt' });
        }
    });

    // ─── ai:stats ───────────────────────────────────────────────────────
    // Lấy thống kê AI (rate limit, cache)
    socket.on('ai:stats', () => {
        socket.emit('ai:stats', getAIStats());
    });
};
