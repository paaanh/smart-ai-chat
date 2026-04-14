const Room = require('../models/Room');
const Message = require('../models/Message');
const { User } = require('../models/User');
const { translateForRoom, getTranslationForUser } = require('../services/translation.service');
const { filterMessage } = require('../utils/badWordFilter');

const STICKER_MESSAGE_PREFIX = '__smartsticker__:';
const isStickerPayload = (content) => typeof content === 'string' && content.startsWith(STICKER_MESSAGE_PREFIX);

module.exports = (io, socket) => {
    const userId = socket.user._id;

    // ─── message:send ───────────────────────────────────────────────────
    socket.on('message:send', async ({ roomId, content, type = 'text', file = null }) => {
        try {
            if (!roomId) return socket.emit('error', { message: 'roomId là bắt buộc' });
            if (type === 'text' && (!content || content.trim() === '')) {
                return socket.emit('error', { message: 'Nội dung tin nhắn không được trống' });
            }
            if (type === 'location' && (!file?.lat || !file?.lng)) {
                return socket.emit('error', { message: 'Thiếu tọa độ vị trí' });
            }

            const room = await Room.findById(roomId);
            if (!room) return socket.emit('error', { message: 'Room không tồn tại' });

            const isMember = room.members.some(m => m.user.toString() === userId.toString());
            if (!isMember) return socket.emit('error', { message: 'Bạn không phải thành viên' });

            // ── Kiểm tra block: nếu bất kỳ thành viên nào đã chặn sender → từ chối ──
            if (room.type === 'direct') {
                const otherMember = room.members.find(m => m.user.toString() !== userId.toString());
                if (otherMember) {
                    const otherUser = await User.findById(otherMember.user).select('blockedUsers').lean();
                    if (otherUser?.blockedUsers?.some(id => id.toString() === userId.toString())) {
                        return socket.emit('error', { message: 'Không thể gửi tin nhắn. Người dùng đã chặn bạn.' });
                    }
                    // Cũng kiểm tra: sender đã chặn receiver → không cho gửi
                    const senderDoc = await User.findById(userId).select('blockedUsers').lean();
                    if (senderDoc?.blockedUsers?.some(id => id.toString() === otherMember.user.toString())) {
                        return socket.emit('error', { message: 'Bạn đã chặn người này. Bỏ chặn để gửi tin nhắn.' });
                    }
                }
            }

            // ── Lấy preferredLanguage MỚI NHẤT từ DB (socket.user có thể stale) ──
            const senderFresh = await User.findById(userId).select('preferredLanguage accountStatus').lean();

            // ── Check account status ──
            if (senderFresh?.accountStatus === 'banned') {
                return socket.emit('error', { message: 'Tài khoản của bạn đã bị khóa.' });
            }
            if (senderFresh?.accountStatus === 'locked' && senderFresh?.lockUntil && new Date(senderFresh.lockUntil) > new Date()) {
                return socket.emit('error', { message: 'Tài khoản đang bị khóa tạm thời.' });
            }

            const senderLanguage = senderFresh?.preferredLanguage || socket.user.preferredLanguage || 'vi';

            // ── Bad word filter ──
            let filteredContent = content;
            if (type === 'text' && content) {
                if (!isStickerPayload(content)) {
                    const { filtered } = await filterMessage(content);
                    filteredContent = filtered;
                }
            }

            // ── Tạo message ──
            const messageData = {
                room: roomId,
                sender: userId,
                type,
                content: filteredContent || '',
                originalLanguage: senderLanguage,
            };

            if (type === 'location' && file) {
                messageData.location = {
                    lat: file.lat,
                    lng: file.lng,
                    address: file.address || '',
                };
            } else if (file) {
                messageData.file = {
                    url: file.url,
                    name: file.name,
                    size: file.size,
                    mimeType: file.mimeType,
                };
            }

            const message = await Message.create(messageData);

            const populatedMessage = await Message.findById(message._id)
                .populate('sender', 'username avatar googlePicture preferredLanguage preferredBubbleFrame');

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
            if (type === 'text' && filteredContent && filteredContent.trim().length >= 2 && !isStickerPayload(filteredContent)) {
                translateForRoom(io, roomId, message._id, filteredContent, senderLanguage)
                    .catch(err => console.error('Translation error:', err.message));
            }

            // ═════════════════════════════════════════════════════════════════
            // BƯỚC 3: (AI Bot response đã chuyển sang Mini AI ChatBox riêng)
            // AI chỉ phản hồi khi user gõ trực tiếp trong Mini AI Box
            // ═════════════════════════════════════════════════════════════════

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

    // ─── message:react ────────────────────────────────────────────────
    socket.on('message:react', async ({ messageId, roomId, emoji }) => {
        try {
            if (!messageId || !roomId || !emoji) return;

            const message = await Message.findById(messageId);
            if (!message) return socket.emit('error', { message: 'Tin nhắn không tồn tại' });

            const existingIdx = message.reactions.findIndex(
                (r) => r.user.toString() === userId.toString()
            );

            if (existingIdx !== -1) {
                if (message.reactions[existingIdx].emoji === emoji) {
                    // Same emoji → remove (toggle off)
                    message.reactions.splice(existingIdx, 1);
                } else {
                    // Different emoji → update
                    message.reactions[existingIdx].emoji = emoji;
                }
            } else {
                // New reaction
                message.reactions.push({ user: userId, emoji });
            }

            await message.save();

            // Broadcast updated reactions to room
            io.to(roomId).emit('message:reacted', {
                messageId,
                reactions: message.reactions,
            });
        } catch (error) {
            console.error('message:react error:', error.message);
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

    // ─── poll:vote ──────────────────────────────────────────────────────
    socket.on('poll:vote', async ({ messageId, roomId, optionIndex }) => {
        try {
            const message = await Message.findById(messageId);
            if (!message || !message.poll) return;

            const option = message.poll.options[optionIndex];
            if (!option) return;

            // Remove previous vote from all options
            for (const opt of message.poll.options) {
                opt.votes = opt.votes.filter(v => v.toString() !== userId.toString());
            }

            // Add vote to selected option
            option.votes.push(userId);
            await message.save();

            io.to(roomId).emit('poll:updated', {
                messageId,
                poll: message.poll,
            });
        } catch (error) {
            console.error('poll:vote error:', error.message);
        }
    });

    // ─── message:send-poll ──────────────────────────────────────────────
    socket.on('message:send-poll', async ({ roomId, question, options }) => {
        try {
            if (!roomId || !question || !options || options.length < 2) {
                return socket.emit('error', { message: 'Poll cần ít nhất 2 lựa chọn' });
            }

            const room = await Room.findById(roomId);
            if (!room) return socket.emit('error', { message: 'Room không tồn tại' });

            const message = await Message.create({
                room: roomId,
                sender: userId,
                type: 'poll',
                content: question,
                poll: {
                    question,
                    options: options.map(text => ({ text, votes: [] })),
                },
            });

            const populated = await Message.findById(message._id)
                .populate('sender', 'username avatar googlePicture preferredLanguage preferredBubbleFrame');

            await Room.findByIdAndUpdate(roomId, { lastMessage: message._id });
            io.to(roomId).emit('message:received', { message: populated });
        } catch (error) {
            console.error('message:send-poll error:', error.message);
        }
    });

    // ─── message:send-contact-card ──────────────────────────────────────
    socket.on('message:send-contact-card', async ({ roomId, contactUserId }) => {
        try {
            if (!roomId || !contactUserId) return;

            const contactUser = await User.findById(contactUserId).select('username avatar bio').lean();
            if (!contactUser) return socket.emit('error', { message: 'User không tồn tại' });

            const message = await Message.create({
                room: roomId,
                sender: userId,
                type: 'contact-card',
                content: `Đã chia sẻ liên hệ: ${contactUser.username}`,
                contactCard: {
                    userId: contactUserId,
                    username: contactUser.username,
                    avatar: contactUser.avatar || '',
                    bio: contactUser.bio || '',
                },
            });

            const populated = await Message.findById(message._id)
                .populate('sender', 'username avatar googlePicture preferredLanguage preferredBubbleFrame');

            await Room.findByIdAndUpdate(roomId, { lastMessage: message._id });
            io.to(roomId).emit('message:received', { message: populated });
        } catch (error) {
            console.error('message:send-contact-card error:', error.message);
        }
    });
};

