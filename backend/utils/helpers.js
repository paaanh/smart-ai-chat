/**
 * Trì hoãn thực thi (Promise-based setTimeout)
 */
const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

/**
 * Retry function với exponential backoff
 */
const retryWithBackoff = async (fn, maxRetries = 3, baseDelay = 1000) => {
    for (let i = 0; i < maxRetries; i++) {
        try {
            return await fn();
        } catch (error) {
            if (i === maxRetries - 1) throw error;
            const waitTime = baseDelay * Math.pow(2, i);
            console.warn(`Retry ${i + 1}/${maxRetries} after ${waitTime}ms...`);
            await delay(waitTime);
        }
    }
};

/**
 * Truncate text (cho log an toàn)
 */
const truncate = (str, maxLength = 100) => {
    if (!str) return '';
    return str.length > maxLength ? str.substring(0, maxLength) + '...' : str;
};

module.exports = { delay, retryWithBackoff, truncate };
