// ─── Logger đơn giản ──────────────────────────────────────────────────
const logger = {
    info: (...args) => console.log(`[${new Date().toISOString()}] ℹ️ `, ...args),
    warn: (...args) => console.warn(`[${new Date().toISOString()}] ⚠️ `, ...args),
    error: (...args) => console.error(`[${new Date().toISOString()}] ❌ `, ...args),
    success: (...args) => console.log(`[${new Date().toISOString()}] ✅ `, ...args),
    socket: (...args) => console.log(`[${new Date().toISOString()}] 🔌 `, ...args),
};

module.exports = logger;
