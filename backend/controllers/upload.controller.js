const path = require('path');

const trimTrailingSlashes = (value = '') => String(value).replace(/\/+$/, '');

const getPublicBaseUrl = (req) => {
    if (process.env.PUBLIC_BASE_URL) {
        return trimTrailingSlashes(process.env.PUBLIC_BASE_URL);
    }

    const forwardedProto = req.headers['x-forwarded-proto'];
    const protocol = forwardedProto || req.protocol || 'http';
    const host = req.get('host');

    if (!host) {
        return '';
    }

    return `${protocol}://${host}`;
};

const buildFileUrl = (req, filename) => {
    const relativePath = `/uploads/${filename}`;
    const baseUrl = getPublicBaseUrl(req);

    return baseUrl ? `${baseUrl}${relativePath}` : relativePath;
};

// ─── Export helpers for reuse in other controllers ───────────────────
exports.buildFileUrl = buildFileUrl;

// ─── Upload single file ──────────────────────────────────────────────
exports.uploadFile = async (req, res, next) => {
    try {
        if (!req.file) {
            return res.status(400).json({ error: 'Không có file nào được upload' });
        }

        const file = req.file;
        // Fix Vietnamese filename encoding (multer returns latin1)
        file.originalname = Buffer.from(file.originalname, 'latin1').toString('utf8');
        const fileUrl = buildFileUrl(req, file.filename);

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

        const files = req.files.map(file => {
            // Fix Vietnamese filename encoding (multer returns latin1)
            file.originalname = Buffer.from(file.originalname, 'latin1').toString('utf8');
            return {
                url: buildFileUrl(req, file.filename),
                name: file.originalname,
                size: file.size,
                mimeType: file.mimetype,
            };
        });

        res.json({
            message: `Upload thành công ${files.length} file`,
            files,
        });
    } catch (error) {
        next(error);
    }
};
