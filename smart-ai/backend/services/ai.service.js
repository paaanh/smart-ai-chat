const Groq = require('groq-sdk');
const Message = require('../models/Message');

// ─── Khởi tạo Groq AI ──────────────────────────────────────────────
let groq = null;

// ─── Translation Cache (in-memory, tránh gọi API trùng lặp) ──────────
const translationCache = new Map();
const CACHE_TTL = 30 * 60 * 1000; // 30 phút
const MAX_CACHE_SIZE = 500;

// ─── Rate Limiter (đơn giản, tránh 429) ───────────────────────────────
const rateLimiter = {
    requests: [],
    maxPerMinute: 30,       // Groq free tier: 30 RPM
    maxPerDay: 14400,       // Groq free tier: 14400 RPD
    dailyRequests: 0,
    lastDayReset: Date.now(),

    canMakeRequest() {
        const now = Date.now();

        // Reset daily counter
        if (now - this.lastDayReset > 24 * 60 * 60 * 1000) {
            this.dailyRequests = 0;
            this.lastDayReset = now;
        }

        // Xóa requests cũ hơn 1 phút
        this.requests = this.requests.filter(t => now - t < 60000);

        if (this.requests.length >= this.maxPerMinute) return false;
        if (this.dailyRequests >= this.maxPerDay) return false;
        return true;
    },

    recordRequest() {
        this.requests.push(Date.now());
        this.dailyRequests++;
    },

    getWaitTime() {
        if (this.requests.length === 0) return 0;
        const oldest = this.requests[0];
        return Math.max(0, 60000 - (Date.now() - oldest));
    }
};

// ─── Groq chat helper ─────────────────────────────────────────────────
const CHAT_MODEL = 'llama-3.3-70b-versatile';
const TRANSLATION_MODEL = 'llama-3.3-70b-versatile';

const SYSTEM_PROMPT = `Bạn là "Smart AI Assistant" - trợ lý thông minh trong nhóm chat. Quy tắc:

1. TRẢ LỜI ngắn gọn, lịch sự, đúng trọng tâm theo ngữ cảnh cuộc trò chuyện.
2. TÓM TẮT: Khi được yêu cầu "tóm tắt" / "summary", tổng hợp lịch sử chat thành gạch đầu dòng.
3. HỖ TRỢ: Giúp nhóm trả lời câu hỏi, giải thích, gợi ý, viết nội dung.
4. NGÔN NGỮ: Trả lời bằng ngôn ngữ mà người dùng sử dụng.
5. KHÔNG bịa đặt thông tin, nếu không biết hãy nói rõ.
6. Format tin nhắn dễ đọc, dùng emoji khi phù hợp.`;

// ─── Init AI ──────────────────────────────────────────────────────────
const initAI = () => {
    const apiKey = process.env.GROQ_API_KEY;
    if (!apiKey) {
        console.error('❌ [AI Init] GROQ_API_KEY is MISSING. AI features will be disabled.');
        console.error('❌ [AI Init] Set GROQ_API_KEY in environment variables.');
        return;
    }

    // Log key prefix để verify đúng key (không log toàn bộ)
    console.log(`🔑 [AI Init] GROQ_API_KEY found (starts with: ${apiKey.substring(0, 8)}..., length: ${apiKey.length})`);

    try {
        groq = new Groq({ apiKey });
        console.log(`✅ [AI Init] Groq AI initialized successfully (model: ${CHAT_MODEL})`);
    } catch (error) {
        console.error('❌ [AI Init] Failed to initialize Groq AI:', error.message);
        console.error('❌ [AI Init] Stack:', error.stack);
        groq = null;
    }
};

// ─── Groq chat completion helper ──────────────────────────────────────
const chatCompletion = async (messages, model = CHAT_MODEL) => {
    const response = await groq.chat.completions.create({
        model,
        messages,
        temperature: 0.7,
        max_tokens: 1024,
    });
    return response.choices[0]?.message?.content?.trim() || '';
};

// ─── Cache helpers ────────────────────────────────────────────────────
const getCacheKey = (text, targetLang, sourceLang) => {
    // Chỉ cache cho text ngắn (< 500 ký tự)
    if (text.length > 500) return null;
    return `${sourceLang || 'auto'}:${targetLang}:${text.substring(0, 200)}`;
};

const getCachedTranslation = (key) => {
    if (!key) return null;
    const cached = translationCache.get(key);
    if (!cached) return null;
    if (Date.now() - cached.timestamp > CACHE_TTL) {
        translationCache.delete(key);
        return null;
    }
    return cached.content;
};

const setCachedTranslation = (key, content) => {
    if (!key) return;
    // Evict oldest nếu cache đầy
    if (translationCache.size >= MAX_CACHE_SIZE) {
        const firstKey = translationCache.keys().next().value;
        translationCache.delete(firstKey);
    }
    translationCache.set(key, { content, timestamp: Date.now() });
};

// ─── Retry with exponential backoff ───────────────────────────────────
const callWithRetry = async (fn, maxRetries = 2) => {
    for (let attempt = 0; attempt <= maxRetries; attempt++) {
        try {
            // Kiểm tra rate limit
            if (!rateLimiter.canMakeRequest()) {
                const waitTime = rateLimiter.getWaitTime();
                if (attempt < maxRetries && waitTime > 0) {
                    console.warn(`⏳ Rate limit reached, waiting ${waitTime}ms...`);
                    await new Promise(r => setTimeout(r, waitTime + 100));
                    continue;
                }
                throw new Error('Rate limit exceeded. Please wait.');
            }

            rateLimiter.recordRequest();
            return await fn();
        } catch (error) {
            const isRetryable = error?.status === 429 || error?.status === 503 || error?.message?.includes('429');

            if (isRetryable && attempt < maxRetries) {
                const delay = Math.pow(2, attempt) * 1000 + Math.random() * 500;
                console.warn(`⚠️ API error (attempt ${attempt + 1}/${maxRetries + 1}), retrying in ${Math.round(delay)}ms...`);
                await new Promise(r => setTimeout(r, delay));
                continue;
            }
            throw error;
        }
    }
};

// ─── Dịch văn bản sang ngôn ngữ đích ─────────────────────────────────
const translateText = async (text, targetLanguage, sourceLanguage = null) => {
    if (!groq) {
        throw new Error('AI model chưa được khởi tạo');
    }

    // Skip nếu text quá ngắn hoặc chỉ là emoji/link
    if (!text || text.trim().length === 0) return text;
    if (/^https?:\/\/\S+$/.test(text.trim())) return text; // URL thuần
    if (/^[\p{Emoji}\s]+$/u.test(text.trim())) return text; // Chỉ emoji

    const langNames = {
        vi: 'Vietnamese', en: 'English', ja: 'Japanese', ko: 'Korean',
        zh: 'Chinese', fr: 'French', de: 'German', es: 'Spanish',
        th: 'Thai', ru: 'Russian', pt: 'Portuguese', ar: 'Arabic',
    };

    const targetLangName = langNames[targetLanguage] || targetLanguage;
    const sourceLangName = sourceLanguage ? (langNames[sourceLanguage] || sourceLanguage) : 'auto-detect';

    // Kiểm tra cache
    const cacheKey = getCacheKey(text, targetLanguage, sourceLanguage);
    const cached = getCachedTranslation(cacheKey);
    if (cached) {
        console.log(`📦 Cache hit: ${text.substring(0, 30)}... → ${targetLanguage}`);
        return cached;
    }

    const result = await callWithRetry(async () => {
        return await chatCompletion([
            {
                role: 'system',
                content: `You are a translator. Translate text from ${sourceLangName} to ${targetLangName}.
Rules:
- ONLY return the translated text, nothing else.
- No explanations, no quotes, no extra formatting.
- Keep proper nouns, brand names, technical terms as-is.
- If the text is already in ${targetLangName}, return it unchanged.
- Preserve line breaks and formatting.`
            },
            { role: 'user', content: text }
        ], TRANSLATION_MODEL);
    });

    // Cache kết quả
    setCachedTranslation(cacheKey, result);
    return result;
};

// ─── Dịch song song cho nhiều ngôn ngữ ────────────────────────────────
const translateBatch = async (text, targetLanguages, sourceLanguage = null) => {
    if (!groq || targetLanguages.length === 0) return [];

    // Tối ưu: nếu chỉ 1-2 ngôn ngữ, gọi riêng; nếu 3+, gọi batch prompt
    if (targetLanguages.length <= 2) {
        const translations = await Promise.allSettled(
            targetLanguages.map(async (lang) => {
                const translated = await translateText(text, lang, sourceLanguage);
                return { language: lang, content: translated };
            })
        );
        return translations.filter(r => r.status === 'fulfilled').map(r => r.value);
    }

    // Batch translation: 1 API call cho nhiều ngôn ngữ
    return await translateBatchSingleCall(text, targetLanguages, sourceLanguage);
};

// ─── Batch translation trong 1 API call (tối ưu khi 3+ ngôn ngữ) ─────
const translateBatchSingleCall = async (text, targetLanguages, sourceLanguage) => {
    const langNames = {
        vi: 'Vietnamese', en: 'English', ja: 'Japanese', ko: 'Korean',
        zh: 'Chinese', fr: 'French', de: 'German', es: 'Spanish',
        th: 'Thai', ru: 'Russian', pt: 'Portuguese', ar: 'Arabic',
    };

    const langList = targetLanguages.map(l => `${l}: ${langNames[l] || l}`).join(', ');

    try {
        const result = await callWithRetry(async () => {
            return await chatCompletion([
                {
                    role: 'system',
                    content: `You are a translator. Translate the given text into multiple languages.
Return ONLY a JSON object with language codes as keys and translations as values.
Example format: {"en": "Hello", "ja": "こんにちは"}
No markdown, no code blocks, no explanations.`
                },
                {
                    role: 'user',
                    content: `Translate into these languages: ${langList}\n\nSource text (${sourceLanguage ? langNames[sourceLanguage] : 'auto-detect'}):\n"${text}"`
                }
            ], TRANSLATION_MODEL);
        });

        // Parse JSON response
        const cleanResult = result.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
        const parsed = JSON.parse(cleanResult);

        const translations = [];
        for (const lang of targetLanguages) {
            if (parsed[lang]) {
                translations.push({ language: lang, content: parsed[lang] });
                // Cache từng bản dịch
                const cacheKey = getCacheKey(text, lang, sourceLanguage);
                setCachedTranslation(cacheKey, parsed[lang]);
            }
        }
        return translations;
    } catch (error) {
        console.error('Batch translation failed, falling back to individual:', error.message);
        // Fallback: gọi riêng từng ngôn ngữ
        const translations = await Promise.allSettled(
            targetLanguages.map(async (lang) => {
                const translated = await translateText(text, lang, sourceLanguage);
                return { language: lang, content: translated };
            })
        );
        return translations.filter(r => r.status === 'fulfilled').map(r => r.value);
    }
};

// ─── AI Bot: Trả lời câu hỏi dựa trên context ───────────────────────
const generateAIResponse = async (userMessage, roomId) => {
    if (!groq) {
        console.error('❌ [AI Chat] groq is null — GROQ_API_KEY missing or initAI() failed');
        return '⚠️ AI chưa được khởi tạo. Vui lòng kiểm tra cấu hình server.';
    }

    if (!rateLimiter.canMakeRequest()) {
        const waitSeconds = Math.ceil(rateLimiter.getWaitTime() / 1000);
        console.warn(`⏳ [AI Chat] Rate limit reached. Wait ~${waitSeconds}s`);
        return `⚠️ AI đang bận, thử lại sau ${waitSeconds} giây nhé!`;
    }

    try {
        console.log(`🤖 [AI Chat] Generating response for room ${roomId}, prompt: "${userMessage.substring(0, 60)}..."`);

        // Lấy 20 tin nhắn gần nhất làm context
        const recentMessages = await Message.find({
            room: roomId,
            deleted: false,
            type: { $in: ['text', 'ai-response'] },
        })
            .populate('sender', 'username')
            .sort({ createdAt: -1 })
            .limit(20)
            .lean();

        // Build messages array for Groq
        const messages = [{ role: 'system', content: SYSTEM_PROMPT }];

        recentMessages.reverse().forEach(m => {
            const isAI = m.aiMetadata?.isAIResponse;
            messages.push({
                role: isAI ? 'assistant' : 'user',
                content: isAI ? m.content : `${m.sender?.username || 'Unknown'}: ${m.content}`,
            });
        });

        // Add the current user message
        messages.push({
            role: 'user',
            content: `Tin nhắn mới nhất từ người dùng: "${userMessage}"

Hãy phản hồi hữu ích, ngắn gọn (tối đa 150 từ). Nếu tin nhắn là câu hỏi, trả lời trực tiếp. Nếu là "tóm tắt" / "summary", tóm tắt cuộc trò chuyện thành gạch đầu dòng.`
        });

        const result = await callWithRetry(async () => {
            return await chatCompletion(messages);
        });

        console.log(`✅ [AI Chat] Response generated (${result.length} chars)`);
        return result;
    } catch (error) {
        console.error('❌ [AI Chat] Error:', error.message);
        console.error('❌ [AI Chat] Status:', error.status || 'N/A');
        console.error('❌ [AI Chat] Stack:', error.stack);

        if (error.status === 429 || error.message?.includes('429') || error.message?.includes('Rate limit') || error.message?.includes('quota')) {
            return '⚠️ AI đang bận, thử lại sau nhé!';
        }
        if (error.status === 403 || error.message?.includes('403') || error.message?.includes('API key')) {
            return '⚠️ API key không hợp lệ hoặc đã bị vô hiệu hóa. Liên hệ admin.';
        }
        return '⚠️ AI gặp lỗi, vui lòng thử lại sau.';
    }
};

// ─── AI Bot: Tóm tắt cuộc trò chuyện ─────────────────────────────────
const summarizeConversation = async (roomId, messageCount = 50) => {
    if (!groq) {
        console.error('❌ [AI Summarize] groq is null — GROQ_API_KEY missing or initAI() failed');
        return '⚠️ AI chưa được khởi tạo. Vui lòng kiểm tra cấu hình server.';
    }

    if (!rateLimiter.canMakeRequest()) {
        console.warn('⏳ [AI Summarize] Rate limit reached');
        return '⚠️ AI đang bận, thử lại sau nhé!';
    }

    try {
        const messages = await Message.find({
            room: roomId,
            deleted: false,
            type: 'text',
        })
            .populate('sender', 'username')
            .sort({ createdAt: -1 })
            .limit(messageCount)
            .lean();

        if (messages.length === 0) return 'Chưa có tin nhắn nào để tóm tắt.';

        const context = messages
            .reverse()
            .map(m => `${m.sender?.username || 'Unknown'}: ${m.content}`)
            .join('\n');

        const result = await callWithRetry(async () => {
            return await chatCompletion([
                { role: 'system', content: SYSTEM_PROMPT },
                {
                    role: 'user',
                    content: `Tóm tắt cuộc trò chuyện sau thành các điểm chính (gạch đầu dòng, ngắn gọn, dễ hiểu):\n\n${context}\n\nTóm tắt:`
                }
            ]);
        });

        return result;
    } catch (error) {
        console.error('❌ [AI Summarize] Error:', error.message);
        console.error('❌ [AI Summarize] Status:', error.status || 'N/A');
        console.error('❌ [AI Summarize] Stack:', error.stack);

        if (error.status === 429 || error.message?.includes('429') || error.message?.includes('quota')) {
            return '⚠️ AI đang bận, thử lại sau nhé!';
        }
        return '⚠️ AI gặp lỗi khi tóm tắt. Vui lòng thử lại.';
    }
};

// ─── Lấy stats ────────────────────────────────────────────────────────
const getAIStats = () => ({
    isInitialized: !!groq,
    cacheSize: translationCache.size,
    rateLimiter: {
        requestsInLastMinute: rateLimiter.requests.filter(t => Date.now() - t < 60000).length,
        dailyRequests: rateLimiter.dailyRequests,
        maxPerMinute: rateLimiter.maxPerMinute,
        maxPerDay: rateLimiter.maxPerDay,
    },
});

// ─── AI: Tóm tắt cuộc gọi từ audio ──────────────────────────────────
const summarizeCallAudio = async (audioBase64, mimeType = 'audio/webm') => {
    if (!groq) {
        console.error('❌ [AI Call] groq is null');
        return '⚠️ AI chưa được khởi tạo.';
    }

    if (!rateLimiter.canMakeRequest()) {
        return '⚠️ AI đang bận, thử lại sau nhé!';
    }

    try {
        console.log(`🎙️ [AI Call] Summarizing call audio (${Math.round(audioBase64.length / 1024)}KB)`);

        // Groq hiện không hỗ trợ audio input trực tiếp như Gemini
        // Trả về thông báo phù hợp
        console.warn('⚠️ [AI Call] Audio summarization not supported with Groq. Skipping.');
        return '⚠️ Tính năng tóm tắt cuộc gọi tạm thời không khả dụng với Groq API.';
    } catch (error) {
        console.error('❌ [AI Call] Error:', error.message);
        return null;
    }
};

// ─── AI: Phân tích ảnh chụp màn hình ──────────────────────────────────────────
const analyzeScreenImage = async (imageBase64) => {
    if (!groq) {
        console.error('❌ [AI Screen] groq is null');
        return '⚠️ AI chưa được khởi tạo.';
    }

    if (!rateLimiter.canMakeRequest()) {
        return '⚠️ AI đang bận, thử lại sau nhé!';
    }

    try {
        console.log(`💻 [AI Screen] Analyzing screen image (${Math.round(imageBase64.length / 1024)}KB)`);

        const result = await callWithRetry(async () => {
            const response = await groq.chat.completions.create({
                model: 'llama-3.2-90b-vision-preview',
                messages: [
                    {
                        role: 'user',
                        content: [
                            {
                                type: 'image_url',
                                image_url: {
                                    url: `data:image/jpeg;base64,${imageBase64}`,
                                },
                            },
                            {
                                type: 'text',
                                text: `Đây là ảnh chụp màn hình đang được chia sẻ trong cuộc gọi video. Hãy:
1. Mô tả ngắn gọn nội dung hiển thị trên màn hình.
2. Nếu có văn bản, hãy trích xuất và tóm tắt các điểm chính.
3. Nếu có code, hãy nhận diện ngôn ngữ và mô tả chức năng.
4. Nếu có bảng biểu/đồ thị, hãy tóm tắt dữ liệu chính.
5. Trả lời bằng ngôn ngữ Việt Nam, dễ hiểu, ngắn gọn.`,
                            },
                        ],
                    },
                ],
                temperature: 0.5,
                max_tokens: 1024,
            });
            return response.choices[0]?.message?.content?.trim() || '';
        });

        console.log(`✅ [AI Screen] Analysis done (${result.length} chars)`);
        return result;
    } catch (error) {
        console.error('❌ [AI Screen] Error:', error.message);
        if (error.status === 429 || error.message?.includes('429')) {
            return '⚠️ AI đang bận, thử lại sau nhé!';
        }
        return null;
    }
};

module.exports = {
    initAI,
    translateText,
    translateBatch,
    generateAIResponse,
    summarizeConversation,
    summarizeCallAudio,
    analyzeScreenImage,
    getAIStats,
};
