const jwt = require('jsonwebtoken');
const { User } = require('../models/User');

const JWT_SECRET = process.env.JWT_SECRET || 'smart-ai-secret-key-change-in-production';
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '7d';

// ─── Tạo JWT Token ───────────────────────────────────────────────────
const generateToken = (userId) => {
    return jwt.sign({ id: userId }, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });
};

// ─── Middleware xác thực HTTP requests ────────────────────────────────
const authMiddleware = async (req, res, next) => {
    try {
        const authHeader = req.headers.authorization;
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return res.status(401).json({ error: 'Không có token xác thực' });
        }

        const token = authHeader.split(' ')[1];
        const decoded = jwt.verify(token, JWT_SECRET);

        const user = await User.findById(decoded.id).select('-password');
        if (!user) {
            return res.status(401).json({ error: 'User không tồn tại' });
        }

        req.user = user;
        next();
    } catch (error) {
        if (error.name === 'TokenExpiredError') {
            return res.status(401).json({ error: 'Token đã hết hạn' });
        }
        return res.status(401).json({ error: 'Token không hợp lệ' });
    }
};

// ─── Middleware xác thực Socket.io ────────────────────────────────────
const socketAuthMiddleware = async (socket, next) => {
    try {
        const token = socket.handshake.auth?.token;
        if (!token) {
            return next(new Error('Authentication error: No token'));
        }

        const decoded = jwt.verify(token, JWT_SECRET);
        const user = await User.findById(decoded.id).select('-password');
        if (!user) {
            return next(new Error('Authentication error: User not found'));
        }

        // Check account status
        if (user.accountStatus === 'banned') {
            return next(new Error('Account banned'));
        }
        if (user.accountStatus === 'locked' && user.lockUntil && new Date(user.lockUntil) > new Date()) {
            return next(new Error('Account locked'));
        }
        // Auto-unlock expired lock
        if (user.accountStatus === 'locked' && user.lockUntil && new Date(user.lockUntil) <= new Date()) {
            user.accountStatus = 'active';
            user.lockUntil = null;
            await user.save({ validateModifiedOnly: true });
        }

        // Gắn user vào socket để dùng trong handlers
        socket.user = user;
        next();
    } catch (error) {
        next(new Error('Authentication error: Invalid token'));
    }
};

module.exports = { authMiddleware, socketAuthMiddleware, generateToken, JWT_SECRET };
