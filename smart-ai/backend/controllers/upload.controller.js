const path = require('path');

const trimTrailingSlashes = (value = '') => String(value).replace(/\/+$/, '');

const getPublicBaseUrl = () => {
    if (process.env.PUBLIC_BASE_URL) {
        return trimTrailingSlashes(process.env.PUBLIC_BASE_URL);
    }

    // Default to relative upload paths to avoid wrong host/protocol
    // when requests pass through reverse proxies (Render/Vercel/Nginx).
    return '';
};

const buildFileUrl = (req, filename) => {
    const relativePath = `/uploads/${filename}`;
    const baseUrl = getPublicBaseUrl();

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
