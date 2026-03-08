// ─── Middleware kiểm tra quyền Admin ──────────────────────────────────
const adminMiddleware = (req, res, next) => {
    if (!req.user || req.user.role !== 'admin') {
        return res.status(403).json({ error: 'Bạn không có quyền truy cập chức năng này' });
    }
    next();
};

module.exports = { adminMiddleware };
