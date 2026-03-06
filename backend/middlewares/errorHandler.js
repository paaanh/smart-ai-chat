// ─── Global Error Handler ─────────────────────────────────────────────
const errorHandler = (err, req, res, next) => {
    console.error('❌ Error:', err.message);

    // Multer errors
    if (err.code === 'LIMIT_FILE_SIZE') {
        return res.status(400).json({ error: 'File quá lớn. Giới hạn tối đa 50MB.' });
    }
    if (err.code === 'LIMIT_UNEXPECTED_FILE') {
        return res.status(400).json({ error: 'Trường file không hợp lệ.' });
    }

    // Mongoose validation errors
    if (err.name === 'ValidationError') {
        const messages = Object.values(err.errors).map(e => e.message);
        return res.status(400).json({ error: messages.join(', ') });
    }

    // Mongoose duplicate key
    if (err.code === 11000) {
        const field = Object.keys(err.keyValue)[0];
        return res.status(409).json({ error: `${field} đã tồn tại.` });
    }

    // Default
    const statusCode = err.statusCode || 500;
    res.status(statusCode).json({
        error: err.message || 'Đã xảy ra lỗi server.',
    });
};

module.exports = errorHandler;
