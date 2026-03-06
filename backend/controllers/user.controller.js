const { User, SUPPORTED_LANGUAGES, LANGUAGE_LABELS } = require('../models/User');

// ─── Cập nhật profile ────────────────────────────────────────────────
exports.updateProfile = async (req, res, next) => {
    try {
        const { username, avatar, preferredLanguage } = req.body;
        const updates = {};

        if (username) updates.username = username;
        if (avatar) updates.avatar = avatar;
        if (preferredLanguage && SUPPORTED_LANGUAGES.includes(preferredLanguage)) {
            updates.preferredLanguage = preferredLanguage;
            updates.preferredLanguageLabel = LANGUAGE_LABELS[preferredLanguage];
        }

        const user = await User.findByIdAndUpdate(req.user._id, updates, {
            new: true,
            runValidators: true,
        });

        res.json({ message: 'Cập nhật thành công', user });
    } catch (error) {
        next(error);
    }
};

// ─── Tìm kiếm user (để thêm vào room) ───────────────────────────────
exports.searchUsers = async (req, res, next) => {
    try {
        const { q } = req.query;
        if (!q || q.trim().length < 2) {
            return res.status(400).json({ error: 'Từ khóa tìm kiếm cần ít nhất 2 ký tự' });
        }

        const users = await User.find({
            _id: { $ne: req.user._id },  // Loại bỏ chính mình
            $or: [
                { username: { $regex: q, $options: 'i' } },
                { email: { $regex: q, $options: 'i' } },
            ],
        })
            .select('username email avatar status preferredLanguage preferredLanguageLabel')
            .limit(20);

        res.json({ users });
    } catch (error) {
        next(error);
    }
};

// ─── Lấy danh sách ngôn ngữ hỗ trợ ──────────────────────────────────
exports.getSupportedLanguages = (req, res) => {
    const languages = SUPPORTED_LANGUAGES.map(code => ({
        code,
        label: LANGUAGE_LABELS[code],
    }));
    res.json({ languages });
};

// ─── Lấy thông tin user theo ID ───────────────────────────────────────
exports.getUserById = async (req, res, next) => {
    try {
        const user = await User.findById(req.params.id)
            .select('username email avatar status preferredLanguage preferredLanguageLabel lastSeen');

        if (!user) {
            return res.status(404).json({ error: 'User không tồn tại' });
        }

        res.json({ user });
    } catch (error) {
        next(error);
    }
};
