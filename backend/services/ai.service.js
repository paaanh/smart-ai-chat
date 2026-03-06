const { GoogleGenerativeAI } = require('@google/generative-ai');
const Message = require('../models/Message');

// ─── Khởi tạo Gemini AI ──────────────────────────────────────────────
let genAI = null;
let chatModel = null;
let translationModel = null;

// ─── Translation Cache (in-memory, tránh gọi API trùng lặp) ──────────
const translationCache = new Map();
const CACHE_TTL = 30 * 60 * 1000; // 30 phút
const MAX_CACHE_SIZE = 500;

// ─── Rate Limiter (đơn giản, tránh 429) ───────────────────────────────
const rateLimiter = {
    requests: [],
    maxPerMinute: 15,       // Gemini free tier: 15 RPM
    maxPerDay: 1500,        // Gemini free tier: 1500 RPD
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

// ─── Init AI ──────────────────────────────────────────────────────────
const initAI = () => {
    if (!process.env.GEMINI_API_KEY) {
        console.warn('⚠️ GEMINI_API_KEY chưa được cấu hình. AI features sẽ bị vô hiệu hóa.');
        return;
    }

    genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

    // Model cho chat/bot responses
    chatModel = genAI.getGenerativeModel({
        model: 'gemini-2.5-flash',
        systemInstruction: `Bạn là "Smart AI Assistant" - trợ lý thông minh trong nhóm chat. Quy tắc:

1. TRẢ LỜI ngắn gọn, lịch sự, đúng trọng tâm theo ngữ cảnh cuộc trò chuyện.
2. TÓM TẮT: Khi được yêu cầu "tóm tắt" / "summary", tổng hợp lịch sử chat thành gạch đầu dòng.
3. HỖ TRỢ: Giúp nhóm trả lời câu hỏi, giải thích, gợi ý, viết nội dung.
4. NGÔN NGỮ: Trả lời bằng ngôn ngữ mà người dùng sử dụng.
5. KHÔNG bịa đặt thông tin, nếu không biết hãy nói rõ.
6. Format tin nhắn dễ đọc, dùng emoji khi phù hợp.`,
    });

    // Model riêng cho translation (lightweight, không cần system instruction nặng)
    translationModel = genAI.getGenerativeModel({
        model: 'gemini-2.5-flash',
    });

    console.log('✅ Gemini AI initialized (model: gemini-2.5-flash)');
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
    if (!translationModel) {
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

    const prompt = `Translate the following text from ${sourceLangName} to ${targetLangName}.
Rules:
- ONLY return the translated text, nothing else.
- No explanations, no quotes, no extra formatting.
- Keep proper nouns, brand names, technical terms as-is.
- If the text is already in ${targetLangName}, return it unchanged.
- Preserve line breaks and formatting.

Text:
${text}`;

    const result = await callWithRetry(async () => {
        const res = await translationModel.generateContent(prompt);
        return res.response.text().trim();
    });

    // Cache kết quả
    setCachedTranslation(cacheKey, result);
    return result;
};

// ─── Dịch song song cho nhiều ngôn ngữ ────────────────────────────────
const translateBatch = async (text, targetLanguages, sourceLanguage = null) => {
    if (!translationModel || targetLanguages.length === 0) return [];

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

    const prompt = `Translate the following text into these languages: ${langList}

Source text (${sourceLanguage ? langNames[sourceLanguage] : 'auto-detect'}):
"${text}"

Return ONLY a JSON object with language codes as keys and translations as values.
Example format: {"en": "Hello", "ja": "こんにちは"}
No markdown, no code blocks, no explanations.`;

    try {
        const result = await callWithRetry(async () => {
            const res = await translationModel.generateContent(prompt);
            return res.response.text().trim();
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
    if (!chatModel) return null;

    try {
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

        const context = recentMessages
            .reverse()
            .map(m => {
                const prefix = m.aiMetadata?.isAIResponse ? '🤖 AI' : (m.sender?.username || 'Unknown');
                return `${prefix}: ${m.content}`;
            })
            .join('\n');

        const prompt = `Lịch sử cuộc trò chuyện gần đây:
---
${context}
---

Tin nhắn mới nhất từ người dùng: "${userMessage}"

Hãy phản hồi hữu ích, ngắn gọn (tối đa 150 từ). Nếu tin nhắn là câu hỏi, trả lời trực tiếp. Nếu là "tóm tắt" / "summary", tóm tắt cuộc trò chuyện thành gạch đầu dòng.`;

        const result = await callWithRetry(async () => {
            const res = await chatModel.generateContent(prompt);
            return res.response.text().trim();
        });

        return result;
    } catch (error) {
        console.error('AI response error:', error.message);

        if (error.message?.includes('Rate limit')) {
            return '⚠️ AI đang bận, vui lòng thử lại sau ít phút.';
        }
        return null;
    }
};

// ─── AI Bot: Tóm tắt cuộc trò chuyện ─────────────────────────────────
const summarizeConversation = async (roomId, messageCount = 50) => {
    if (!chatModel) return null;

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

        const prompt = `Tóm tắt cuộc trò chuyện sau thành các điểm chính (gạch đầu dòng, ngắn gọn, dễ hiểu):

${context}

Tóm tắt:`;

        const result = await callWithRetry(async () => {
            const res = await chatModel.generateContent(prompt);
            return res.response.text().trim();
        });

        return result;
    } catch (error) {
        console.error('Summarize error:', error.message);
        return null;
    }
};

// ─── Lấy stats ────────────────────────────────────────────────────────
const getAIStats = () => ({
    isInitialized: !!chatModel,
    cacheSize: translationCache.size,
    rateLimiter: {
        requestsInLastMinute: rateLimiter.requests.filter(t => Date.now() - t < 60000).length,
        dailyRequests: rateLimiter.dailyRequests,
        maxPerMinute: rateLimiter.maxPerMinute,
        maxPerDay: rateLimiter.maxPerDay,
    },
});

module.exports = {
    initAI,
    translateText,
    translateBatch,
    generateAIResponse,
    summarizeConversation,
    getAIStats,
};
