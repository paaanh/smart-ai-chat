const BadWord = require('../models/BadWord');

let cachedWords = [];
let lastFetch = 0;
const CACHE_TTL = 60000; // 1 minute

/**
 * Fetch active bad words from DB (cached)
 */
const loadBadWords = async () => {
    const now = Date.now();
    if (cachedWords.length > 0 && now - lastFetch < CACHE_TTL) {
        return cachedWords;
    }
    try {
        const words = await BadWord.find({ isActive: true }).select('word').lean();
        cachedWords = words.map(w => w.word.toLowerCase());
        lastFetch = now;
    } catch (err) {
        console.error('[BadWordFilter] Failed to load:', err.message);
    }
    return cachedWords;
};

/**
 * Clear cache (call after adding/removing words)
 */
const clearCache = () => {
    cachedWords = [];
    lastFetch = 0;
};

/**
 * Build regex from bad words list
 */
const buildRegex = (words) => {
    if (!words.length) return null;
    const escaped = words.map(w => w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
    return new RegExp(`(${escaped.join('|')})`, 'gi');
};

/**
 * Filter message content — replace bad words with asterisks
 * @param {string} content - Original message content
 * @returns {Promise<{filtered: string, hasBadWord: boolean}>}
 */
const filterMessage = async (content) => {
    if (!content || typeof content !== 'string') {
        return { filtered: content, hasBadWord: false };
    }

    const words = await loadBadWords();
    if (!words.length) return { filtered: content, hasBadWord: false };

    const regex = buildRegex(words);
    if (!regex) return { filtered: content, hasBadWord: false };

    let hasBadWord = false;
    const filtered = content.replace(regex, (match) => {
        hasBadWord = true;
        return '*'.repeat(match.length);
    });

    return { filtered, hasBadWord };
};

/**
 * Check if content contains bad words (without filtering)
 */
const containsBadWord = async (content) => {
    if (!content) return false;
    const words = await loadBadWords();
    if (!words.length) return false;
    const regex = buildRegex(words);
    return regex ? regex.test(content) : false;
};

module.exports = { filterMessage, containsBadWord, clearCache, loadBadWords };
