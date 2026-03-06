const path = require('path');

// ─── Upload single file ──────────────────────────────────────────────
exports.uploadFile = async (req, res, next) => {
    try {
        if (!req.file) {
            return res.status(400).json({ error: 'Không có file nào được upload' });
        }

        const file = req.file;
        const fileUrl = `/uploads/${file.filename}`;

        res.json({
            message: 'Upload thành công',
            file: {
                url: fileUrl,
                name: file.originalname,
                size: file.size,
                mimeType: file.mimetype,
            },
        });
    } catch (error) {
        next(error);
    }
};

// ─── Upload multiple files ────────────────────────────────────────────
exports.uploadFiles = async (req, res, next) => {
    try {
        if (!req.files || req.files.length === 0) {
            return res.status(400).json({ error: 'Không có file nào được upload' });
        }

        const files = req.files.map(file => ({
            url: `/uploads/${file.filename}`,
            name: file.originalname,
            size: file.size,
            mimeType: file.mimetype,
        }));

        res.json({
            message: `Upload thành công ${files.length} file`,
            files,
        });
    } catch (error) {
        next(error);
    }
};
