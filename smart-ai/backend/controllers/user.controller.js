const { User, SUPPORTED_LANGUAGES, LANGUAGE_LABELS, SUPPORTED_BUBBLE_FRAMES } = require('../models/User');
const { buildFileUrl } = require('./upload.controller');

// ─── Cập nhật profile (hỗ trợ upload avatar + cover) ──────────────────
exports.updateProfile = async (req, res, next) => {
    try {
        const { username, preferredLanguage, bio, phoneNumber, address, education, hobbies, interests, preferredBubbleFrame } = req.body;
        const updates = {};

        if (username) updates.username = username;
        if (bio !== undefined) updates.bio = bio;
        if (phoneNumber !== undefined) updates.phoneNumber = phoneNumber;
        if (address !== undefined) updates.address = address;
        if (education !== undefined) updates.education = education;
        if (hobbies !== undefined) {
            updates.hobbies = typeof hobbies === 'string' ? JSON.parse(hobbies) : hobbies;
        }
        if (interests !== undefined) {
            updates.interests = typeof interests === 'string' ? JSON.parse(interests) : interests;
        }
        if (preferredLanguage && SUPPORTED_LANGUAGES.includes(preferredLanguage)) {
            updates.preferredLanguage = preferredLanguage;
            updates.preferredLanguageLabel = LANGUAGE_LABELS[preferredLanguage];
        }

        if (preferredBubbleFrame && SUPPORTED_BUBBLE_FRAMES.includes(preferredBubbleFrame)) {
            updates.preferredBubbleFrame = preferredBubbleFrame;
        }

        const validThemes = ['blue', 'red', 'purple', 'yellow', 'brown', 'dark', 'light'];
        if (req.body.preferredTheme && validThemes.includes(req.body.preferredTheme)) {
            updates.preferredTheme = req.body.preferredTheme;
        }

        // Handle uploaded files (multer)
        if (req.files) {
            if (req.files.avatar?.[0]) {
                updates.avatar = buildFileUrl(req, req.files.avatar[0].filename);
            }
            if (req.files.coverPicture?.[0]) {
                updates.coverPicture = buildFileUrl(req, req.files.coverPicture[0].filename);
            }
        }

        const user = await User.findByIdAndUpdate(req.user._id, updates, {
            new: true,
            runValidators: true,
        });

        // Broadcast profile update via Socket.io
        const io = req.app.get('io');
        if (io) {
            io.emit('user:profile-updated', {
                userId: user._id,
                username: user.username,
                avatar: user.avatar,
                bio: user.bio,
                preferredBubbleFrame: user.preferredBubbleFrame,
            });
        }

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
            .select('username email avatar status preferredLanguage preferredLanguageLabel preferredBubbleFrame')
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

// ─── Lấy thông tin user theo ID (full profile) ───────────────────────
exports.getUserById = async (req, res, next) => {
    try {
        const user = await User.findById(req.params.id)
            .select('username email avatar coverPicture bio phoneNumber address education hobbies interests status preferredLanguage preferredLanguageLabel preferredBubbleFrame lastSeen createdAt');

        if (!user) {
            return res.status(404).json({ error: 'User không tồn tại' });
        }

        res.json({ user });
    } catch (error) {
        next(error);
    }
};
