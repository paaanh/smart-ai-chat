const Room = require('../models/Room');
const Message = require('../models/Message');
const { User } = require('../models/User');
const { translateForRoom, getTranslationForUser } = require('../services/translation.service');
const { generateAIResponse } = require('../services/ai.service');

module.exports = (io, socket) => {
    const userId = socket.user._id;

    // ─── message:send ───────────────────────────────────────────────────
    socket.on('message:send', async ({ roomId, content, type = 'text', file = null }) => {
        try {
            if (!roomId) return socket.emit('error', { message: 'roomId là bắt buộc' });
            if (type === 'text' && (!content || content.trim() === '')) {
                return socket.emit('error', { message: 'Nội dung tin nhắn không được trống' });
            }

            const room = await Room.findById(roomId);
            if (!room) return socket.emit('error', { message: 'Room không tồn tại' });

            const isMember = room.members.some(m => m.user.toString() === userId.toString());
            if (!isMember) return socket.emit('error', { message: 'Bạn không phải thành viên' });

            // ── Tạo message ──
            const messageData = {
                room: roomId,
                sender: userId,
                type,
                content: content || '',
                originalLanguage: socket.user.preferredLanguage || 'vi',
            };

            if (file) {
                messageData.file = {
                    url: file.url,
                    name: file.name,
                    size: file.size,
                    mimeType: file.mimeType,
                };
            }

            const message = await Message.create(messageData);

            const populatedMessage = await Message.findById(message._id)
                .populate('sender', 'username avatar preferredLanguage');

            // Cập nhật lastMessage
            await Room.findByIdAndUpdate(roomId, { lastMessage: message._id });

            // ═════════════════════════════════════════════════════════════════
            // BƯỚC 1: Broadcast tin nhắn GỐC ngay lập tức (không chờ AI)
            // ═════════════════════════════════════════════════════════════════
            io.to(roomId).emit('message:received', { message: populatedMessage });

            // ═════════════════════════════════════════════════════════════════
            // BƯỚC 1.5: Notify ALL room members (sidebar update + unread)
            // io.to(roomId) only reaches users who socket.join(roomId).
            // Sidebar needs updates for rooms the user has NOT joined.
            // ═════════════════════════════════════════════════════════════════
            for (const member of room.members) {
                if (member.user.toString() === userId.toString()) continue;
                const memberDoc = await User.findById(member.user).select('socketId').lean();
                if (memberDoc?.socketId) {
                    io.to(memberDoc.socketId).emit('room:new-message', {
                        roomId,
                        lastMessage: populatedMessage,
                        senderId: userId.toString(),
                    });
                }
            }

            console.log(`💬 ${socket.user.username} → room ${roomId}: ${content?.substring(0, 50) || '[file]'}`);

            // ═════════════════════════════════════════════════════════════════
            // BƯỚC 2: Dịch thuật ASYNC (fire-and-forget, không block UX)
            // ═════════════════════════════════════════════════════════════════
            if (type === 'text' && content && content.trim().length >= 2) {
                translateForRoom(io, roomId, message._id, content, socket.user.preferredLanguage)
                    .catch(err => console.error('Translation error:', err.message));
            }

            // ═════════════════════════════════════════════════════════════════
            // BƯỚC 3: AI Bot response (nếu có member bật bot trong room)
            // ═════════════════════════════════════════════════════════════════
            if (type === 'text') {
                const botEnabledMembers = room.members.filter(m => m.aiBotEnabled);

                if (botEnabledMembers.length > 0) {
                    // Fire-and-forget: không block message flow
                    handleAIBotResponse(io, socket, roomId, content, userId)
                        .catch(err => console.error('AI Bot error:', err.message));
                }
            }

        } catch (error) {
            console.error('message:send error:', error.message);
            socket.emit('error', { message: 'Lỗi khi gửi tin nhắn' });
        }
    });

    // ─── message:read ───────────────────────────────────────────────────
    socket.on('message:read', async ({ roomId, messageId }) => {
        try {
            await Message.findByIdAndUpdate(messageId, {
                $addToSet: {
                    readBy: { user: userId, readAt: new Date() },
                },
            });

            socket.to(roomId).emit('message:read-update', {
                messageId,
                userId: userId.toString(),
            });
        } catch (error) {
            console.error('message:read error:', error.message);
        }
    });

    // ─── message:delete ─────────────────────────────────────────────────
    socket.on('message:delete', async ({ messageId, roomId }) => {
        try {
            const message = await Message.findById(messageId);
            if (!message) return;

            if (message.sender.toString() !== userId.toString()) {
                return socket.emit('error', { message: 'Bạn không thể xóa tin nhắn của người khác' });
            }

            message.deleted = true;
            message.content = '';
            await message.save();

            io.to(roomId).emit('message:deleted', { messageId });
        } catch (error) {
            console.error('message:delete error:', error.message);
        }
    });

    // ─── message:get-translation ────────────────────────────────────────
    // Client request bản dịch cho 1 message cụ thể (khi load history)
    socket.on('message:get-translation', async ({ messageId }) => {
        try {
            const translation = await getTranslationForUser(messageId, socket.user.preferredLanguage);
            if (translation) {
                socket.emit('message:translated', {
                    messageId,
                    translation: {
                        language: translation.language,
                        content: translation.content,
                    },
                });
            }
        } catch (error) {
            console.error('message:get-translation error:', error.message);
        }
    });
};

// ─── Helper: Xử lý AI Bot response ───────────────────────────────────
async function handleAIBotResponse(io, socket, roomId, userMessage, triggeredByUserId) {
    try {
        // Emit "AI đang suy nghĩ..." cho room
        io.to(roomId).emit('ai:thinking', { roomId });

        const aiResponse = await generateAIResponse(userMessage, roomId);

        if (!aiResponse) {
            io.to(roomId).emit('ai:thinking-done', { roomId });
            return;
        }

        // Tạo AI message
        const aiMessage = await Message.create({
            room: roomId,
            sender: triggeredByUserId,
            type: 'ai-response',
            content: aiResponse,
            aiMetadata: {
                isAIResponse: true,
                prompt: userMessage.substring(0, 200),
                model: 'gemini-2.5-flash',
            },
        });

        const populatedAI = await aiMessage.populate('sender', 'username avatar preferredLanguage');

        // Broadcast AI response
        io.to(roomId).emit('ai:response', {
            roomId,
            message: populatedAI,
        });

        // Cũng gửi như message thường để lưu trong chat
        io.to(roomId).emit('message:received', {
            message: populatedAI,
        });

        console.log(`🤖 AI responded in room ${roomId}: ${aiResponse.substring(0, 60)}...`);

    } catch (error) {
        console.error('handleAIBotResponse error:', error.message);
        io.to(roomId).emit('ai:error', {
            roomId,
            error: 'AI không thể phản hồi. Vui lòng thử lại.',
        });
    }
}
