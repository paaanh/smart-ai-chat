const Room = require('../models/Room');
const Message = require('../models/Message');
const { User } = require('../models/User');
const { translateBatch } = require('./ai.service');

/**
 * Dịch thuật real-time cá nhân hóa cho tất cả members trong room.
 *
 * Luồng xử lý:
 * 1. Lấy danh sách members trong room (populate thông tin user)
 * 2. Filter: chỉ dịch cho members có preferredLanguage ≠ senderLanguage
 * 3. Nhóm theo ngôn ngữ đích (N users cùng ngôn ngữ = 1 lần gọi API)
 * 4. Kiểm tra cache: nếu message đã có bản dịch cho ngôn ngữ đó → skip
 * 5. Gọi Gemini API dịch song song (Promise.allSettled, có retry)
 * 6. Lưu translations[] vào Message document (persistent cache)
 * 7. Emit 'message:translated' RIÊNG cho từng user qua socketId
 */
const translateForRoom = async (io, roomId, messageId, content, senderLanguage) => {
    try {
        // ── Guard: text quá ngắn hoặc chỉ emoji/link → skip ──
        if (!content || content.trim().length < 2) return;
        if (/^https?:\/\/\S+$/.test(content.trim())) return;
        if (/^[\p{Emoji}\s]+$/u.test(content.trim())) return;

        // 1. Lấy room + populate members
        const room = await Room.findById(roomId)
            .populate('members.user', 'preferredLanguage socketId username');

        if (!room) return;
        if (room.settings?.aiTranslationEnabled === false) return;

        // 2. Filter members cần dịch (ngôn ngữ khác sender)
        const membersToTranslate = room.members.filter(m => {
            if (!m.user || !m.user.preferredLanguage) return false;
            return m.user.preferredLanguage !== senderLanguage;
        });

        if (membersToTranslate.length === 0) return;

        // 3. Nhóm members theo ngôn ngữ đích
        const languageGroups = {};
        for (const member of membersToTranslate) {
            const lang = member.user.preferredLanguage;
            if (!languageGroups[lang]) {
                languageGroups[lang] = [];
            }
            languageGroups[lang].push(member.user);
        }

        // 4. Kiểm tra nếu message đã có bản dịch cached trong DB
        const existingMsg = await Message.findById(messageId).select('translations').lean();
        const existingLangs = new Set((existingMsg?.translations || []).map(t => t.language));

        const targetLanguages = Object.keys(languageGroups).filter(lang => !existingLangs.has(lang));

        if (targetLanguages.length === 0) {
            // Tất cả đã có bản dịch, chỉ cần emit cho user online
            emitCachedTranslations(io, existingMsg.translations, languageGroups, messageId, roomId);
            return;
        }

        console.log(`🌐 Translating "${content.substring(0, 40)}..." → [${targetLanguages.join(', ')}]`);

        // 5. Gọi Gemini API dịch song song
        const newTranslations = await translateBatch(content, targetLanguages, senderLanguage);

        if (newTranslations.length === 0) {
            console.warn(`⚠️ No translations returned for message ${messageId}`);
            return;
        }

        // 6. Merge & lưu translations vào Message (kết hợp cache cũ + mới)
        const allTranslations = [
            ...(existingMsg?.translations || []),
            ...newTranslations,
        ];

        await Message.findByIdAndUpdate(messageId, {
            $set: { translations: allTranslations },
        });

        // 7. Emit bản dịch MỚI cho từng user
        for (const translation of newTranslations) {
            const usersForThisLang = languageGroups[translation.language] || [];

            for (const user of usersForThisLang) {
                if (user.socketId) {
                    io.to(user.socketId).emit('message:translated', {
                        messageId: messageId.toString(),
                        roomId: roomId.toString(),
                        translation: {
                            language: translation.language,
                            content: translation.content,
                        },
                    });
                }
            }
        }

        console.log(`✅ Translated message ${messageId} → ${newTranslations.length} language(s)`);

    } catch (error) {
        console.error('translateForRoom error:', error.message);
        // Không throw — translation failure không nên crash message flow
    }
};

/**
 * Emit bản dịch đã cache cho users online (khi user reconnect hoặc join room)
 */
const emitCachedTranslations = (io, translations, languageGroups, messageId, roomId) => {
    if (!translations || translations.length === 0) return;

    for (const translation of translations) {
        const users = languageGroups[translation.language] || [];
        for (const user of users) {
            if (user.socketId) {
                io.to(user.socketId).emit('message:translated', {
                    messageId: messageId.toString(),
                    roomId: roomId.toString(),
                    translation: {
                        language: translation.language,
                        content: translation.content,
                    },
                });
            }
        }
    }
};

/**
 * Lấy bản dịch cho 1 message cụ thể (khi user load history)
 * Trả về bản dịch phù hợp với preferredLanguage của user.
 */
const getTranslationForUser = async (messageId, userPreferredLanguage) => {
    try {
        const message = await Message.findById(messageId).select('translations originalLanguage').lean();
        if (!message || !message.translations) return null;

        // Nếu ngôn ngữ gốc = ngôn ngữ user → không cần dịch
        if (message.originalLanguage === userPreferredLanguage) return null;

        return message.translations.find(t => t.language === userPreferredLanguage) || null;
    } catch (error) {
        console.error('getTranslationForUser error:', error.message);
        return null;
    }
};

module.exports = { translateForRoom, getTranslationForUser, emitCachedTranslations };
