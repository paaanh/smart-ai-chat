const Room = require('../models/Room');
const Message = require('../models/Message');
const { summarizeConversation, getAIStats, generateAIResponse, translateText, analyzeScreenImage } = require('../services/ai.service');

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

            // Nếu bật, gửi tin nhắn chào vào Mini AI ChatBox
            if (enabled) {
                io.to(socket.id).emit('ai:chat-response', {
                    roomId,
                    message: {
                        _id: `ai-welcome-${Date.now()}`,
                        type: 'ai-response',
                        content: `🤖 Smart AI Assistant đã sẵn sàng!\n\nCác lệnh nhanh:\n• Gõ "tóm tắt" để tóm tắt cuộc trò chuyện\n• "Dịch câu trên sang tiếng Anh"\n• Đặt câu hỏi bất kỳ về cuộc trò chuyện`,
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

            socket.emit('ai:thinking', { roomId });
            console.log(`📋 [AI Summarize] Requested by ${socket.user.username} in room ${roomId} (last ${messageCount} msgs)`);

            const summary = await summarizeConversation(roomId, messageCount);

            if (summary) {
                // Tạo temporary message (KHÔNG lưu DB)
                const tempSummary = {
                    _id: `ai-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
                    room: roomId,
                    sender: {
                        _id: socket.user._id,
                        username: socket.user.username,
                        avatar: socket.user.avatar,
                    },
                    type: 'ai-response',
                    content: `📋 **Tóm tắt cuộc trò chuyện**\n\n${summary}`,
                    aiMetadata: {
                        isAIResponse: true,
                        prompt: `summarize last ${messageCount} messages`,
                        model: 'gemini-2.5-flash',
                    },
                    createdAt: new Date(),
                };

                socket.emit('ai:chat-response', { roomId, message: tempSummary });
            } else {
                console.warn(`⚠️ [AI Summarize] No summary returned for room ${roomId}`);
                socket.emit('ai:error', { roomId, error: 'AI đang bận, thử lại sau nhé!' });
            }
        } catch (error) {
            console.error(`❌ [AI Summarize] Error in room ${roomId}:`, error.message);
            console.error('❌ [AI Summarize] Stack:', error.stack);
            const isOverloaded = error.status === 429 || error.message?.includes('429');
            socket.emit('ai:error', {
                roomId,
                error: isOverloaded ? 'AI đang bận, thử lại sau nhé!' : 'AI gặp lỗi khi tóm tắt. Thử lại sau.',
            });
        }
    });

    // ─── ai:stats ───────────────────────────────────────────────────────
    // Lấy thống kê AI (rate limit, cache)
    socket.on('ai:stats', () => {
        socket.emit('ai:stats', getAIStats());
    });

    // ─── ai:chat ────────────────────────────────────────────────────────
    // Mini AI ChatBox: user gửi prompt trực tiếp, AI trả lời riêng tư
    socket.on('ai:chat', async ({ roomId, message }) => {
        try {
            if (!roomId || !message || !message.trim()) {
                return socket.emit('ai:error', { roomId, error: 'Tin nhắn không được trống' });
            }

            const room = await Room.findById(roomId);
            if (!room) return socket.emit('ai:error', { roomId, error: 'Room không tồn tại' });

            const isMember = room.members.some(m => m.user.toString() === userId);
            if (!isMember) return socket.emit('ai:error', { roomId, error: 'Bạn không phải thành viên' });

            socket.emit('ai:thinking', { roomId });
            console.log(`🤖 [AI Chat] ${socket.user.username} asked: "${message.substring(0, 80)}..." in room ${roomId}`);

            const aiResponse = await generateAIResponse(message, roomId);

            socket.emit('ai:thinking-done', { roomId });

            if (!aiResponse) {
                socket.emit('ai:error', { roomId, error: 'AI đang bận, thử lại sau nhé!' });
                return;
            }

            const tempAIMessage = {
                _id: `ai-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
                room: roomId,
                type: 'ai-response',
                content: aiResponse,
                aiMetadata: {
                    isAIResponse: true,
                    prompt: message.substring(0, 200),
                    model: 'gemini-2.5-flash',
                },
                createdAt: new Date(),
            };

            // Chỉ gửi cho người hỏi (private)
            socket.emit('ai:chat-response', { roomId, message: tempAIMessage });

            console.log(`🤖 [AI Chat] Responded privately to ${socket.user.username}: ${aiResponse.substring(0, 60)}...`);
        } catch (error) {
            console.error(`❌ [AI Chat] Error in room ${roomId}:`, error.message);
            socket.emit('ai:thinking-done', { roomId });
            const isOverloaded = error.status === 429 || error.message?.includes('429') || error.message?.includes('quota');
            socket.emit('ai:error', {
                roomId,
                error: isOverloaded ? 'AI đang bận, thử lại sau nhé!' : 'AI gặp lỗi, vui lòng thử lại sau.',
            });
        }
    });

    // ─── ai:translate ───────────────────────────────────────────────────
    // Private translation — result sent ONLY to requesting socket, NOT saved to DB
    socket.on('ai:translate', async ({ messageId, content, targetLanguage, sourceLanguage }) => {
        try {
            if (!content || !targetLanguage) return;

            const translation = await translateText(content, targetLanguage, sourceLanguage);
            if (translation && translation !== content) {
                socket.emit('ai:translate-result', {
                    messageId,
                    translation,
                });
            }
        } catch (error) {
            console.error('[AI Translate] Error:', error.message);
        }
    });



    // ─── ai:analyze-screen ────────────────────────────────────────────────
    // Analyze a screenshot from screen sharing using Gemini vision
    socket.on('ai:analyze-screen', async ({ roomId, imageBase64 }) => {
        try {
            if (!roomId || !imageBase64) {
                return socket.emit('ai:error', { roomId, error: 'Dữ liệu hình ảnh không hợp lệ' });
            }

            socket.emit('ai:thinking', { roomId });
            console.log(`💻 [AI Screen] Analyzing screen for ${socket.user.username} in room ${roomId} (${Math.round(imageBase64.length / 1024)}KB)`);

            const analysis = await analyzeScreenImage(imageBase64);

            socket.emit('ai:thinking-done', { roomId });

            if (analysis) {
                const tempMessage = {
                    _id: `ai-screen-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
                    room: roomId,
                    type: 'ai-response',
                    content: `💻 **Phân tích màn hình**\n\n${analysis}`,
                    aiMetadata: { isAIResponse: true, model: 'gemini-2.5-flash' },
                    createdAt: new Date(),
                };
                socket.emit('ai:chat-response', { roomId, message: tempMessage });
            } else {
                socket.emit('ai:error', { roomId, error: 'Không thể phân tích màn hình. Thử lại sau.' });
            }
        } catch (error) {
            console.error(`❌ [AI Screen] Error:`, error.message);
            socket.emit('ai:thinking-done', { roomId });
            socket.emit('ai:error', {
                roomId,
                error: 'AI gặp lỗi khi phân tích màn hình.',
            });
        }
    });
};
