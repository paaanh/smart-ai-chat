const { User, SUPPORTED_LANGUAGES, LANGUAGE_LABELS } = require('../models/User');
const { generateToken } = require('../middlewares/auth.middleware');

// ─── Đăng ký ──────────────────────────────────────────────────────────
exports.register = async (req, res, next) => {
    try {
        const { username, email, password, preferredLanguage } = req.body;

        // Kiểm tra user đã tồn tại
        const existingUser = await User.findOne({ $or: [{ email }, { username }] });
        if (existingUser) {
            return res.status(409).json({
                error: existingUser.email === email
                    ? 'Email đã được sử dụng'
                    : 'Username đã được sử dụng',
            });
        }

        const user = await User.create({
            username,
            email,
            password,
            preferredLanguage: preferredLanguage || 'vi',
            preferredLanguageLabel: LANGUAGE_LABELS[preferredLanguage] || 'Tiếng Việt',
        });

        const token = generateToken(user._id);

        res.status(201).json({
            message: 'Đăng ký thành công',
            token,
            user: user.toJSON(),
        });
    } catch (error) {
        next(error);
    }
};

// ─── Đăng nhập ────────────────────────────────────────────────────────
exports.login = async (req, res, next) => {
    try {
        const { email, password } = req.body;

        if (!email || !password) {
            return res.status(400).json({ error: 'Vui lòng nhập email và mật khẩu' });
        }

        // select('+password') vì field password đã set select: false
        const user = await User.findOne({ email }).select('+password');
        if (!user) {
            return res.status(401).json({ error: 'Email hoặc mật khẩu không đúng' });
        }

        const isMatch = await user.comparePassword(password);
        if (!isMatch) {
            return res.status(401).json({ error: 'Email hoặc mật khẩu không đúng' });
        }

        const token = generateToken(user._id);

        res.json({
            message: 'Đăng nhập thành công',
            token,
            user: user.toJSON(),
        });
    } catch (error) {
        next(error);
    }
};

// ─── Lấy thông tin user hiện tại ─────────────────────────────────────
exports.getMe = async (req, res) => {
    res.json({ user: req.user });
};
