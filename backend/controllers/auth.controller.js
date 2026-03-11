const { User, SUPPORTED_LANGUAGES, LANGUAGE_LABELS } = require('../models/User');
const { generateToken } = require('../middlewares/auth.middleware');
const crypto = require('crypto');
const { sendOTPEmail, sendRegistrationOTPEmail } = require('../config/mailer');

// ─── In-memory store for registration OTPs ────────────────────────────
// key: email, value: { otp, expire, ... }
const registerOTPStore = new Map();

// Dọn dẹp OTP hết hạn mỗi 10 phút
setInterval(() => {
    const now = Date.now();
    for (const [email, data] of registerOTPStore) {
        if (now > data.expire) registerOTPStore.delete(email);
    }
}, 10 * 60 * 1000);

// ─── Gửi OTP xác thực email đăng ký ──────────────────────────────────
exports.sendRegisterOTP = async (req, res, next) => {
    try {
        const { email } = req.body;
        if (!email) {
            return res.status(400).json({ error: 'Vui lòng nhập email' });
        }

        const normalizedEmail = email.toLowerCase().trim();

        // Kiểm tra email đã được đăng ký chưa
        const existingUser = await User.findOne({ email: normalizedEmail });
        if (existingUser) {
            return res.status(409).json({ error: 'Email đã được sử dụng' });
        }

        // Tạo OTP 6 số
        const otp = crypto.randomInt(100000, 999999).toString();
        registerOTPStore.set(normalizedEmail, {
            otp,
            expire: Date.now() + 5 * 60 * 1000, // 5 phút
        });

        // Gửi email
        try {
            await sendRegistrationOTPEmail(normalizedEmail, otp);
        } catch (error) {
            registerOTPStore.delete(normalizedEmail);
            throw error;
        }

        res.json({ message: 'Mã OTP đã được gửi đến email của bạn' });
    } catch (error) {
        next(error);
    }
};

// ─── Đăng ký (yêu cầu OTP) ───────────────────────────────────────────
exports.register = async (req, res, next) => {
    try {
        const { username, email, password, otp, preferredLanguage } = req.body;

        if (!username || !email || !password || !otp) {
            return res.status(400).json({ error: 'Vui lòng cung cấp đầy đủ thông tin' });
        }

        const normalizedEmail = email.toLowerCase().trim();

        // Kiểm tra OTP
        const otpData = registerOTPStore.get(normalizedEmail);
        if (!otpData) {
            return res.status(400).json({ error: 'Chưa có mã OTP cho email này. Vui lòng gửi mã trước.' });
        }
        if (Date.now() > otpData.expire) {
            registerOTPStore.delete(normalizedEmail);
            return res.status(400).json({ error: 'Mã OTP đã hết hạn. Vui lòng gửi lại.' });
        }
        if (otpData.otp !== otp.trim()) {
            return res.status(400).json({ error: 'Mã OTP không chính xác' });
        }

        // Xóa OTP sau khi verify thành công
        registerOTPStore.delete(normalizedEmail);

        // Kiểm tra user đã tồn tại
        const existingUser = await User.findOne({ $or: [{ email: normalizedEmail }, { username }] });
        if (existingUser) {
            return res.status(409).json({
                error: existingUser.email === normalizedEmail
                    ? 'Email đã được sử dụng'
                    : 'Username đã được sử dụng',
            });
        }

        const user = await User.create({
            username,
            email: normalizedEmail,
            password,
            provider: 'local',
            isVerified: true,
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

        // Nếu tài khoản Google, hướng dẫn đăng nhập bằng Google
        if (user.provider === 'google' && !user.password) {
            return res.status(400).json({ error: 'Tài khoản này sử dụng đăng nhập Google. Vui lòng chọn "Tiếp tục với Google".' });
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

// ─── Quên mật khẩu: gửi OTP qua email ───────────────────────────────
exports.forgotPassword = async (req, res, next) => {
    try {
        const { email } = req.body;
        if (!email) {
            return res.status(400).json({ error: 'Vui lòng nhập email' });
        }

        const user = await User.findOne({ email: email.toLowerCase().trim() });
        if (!user) {
            return res.status(404).json({ error: 'Email chưa được đăng ký' });
        }
        // Chỉ cho phép reset password với tài khoản local
        if (user.provider === 'google' && !user.password) {
            return res.status(400).json({ error: 'Tài khoản này sử dụng đăng nhập Google, không thể đặt lại mật khẩu.' });
        }
        // Tạo OTP 6 số
        const otp = crypto.randomInt(100000, 999999).toString();
        user.resetOTP = otp;
        user.resetOTPExpire = new Date(Date.now() + 5 * 60 * 1000); // 5 phút
        await user.save({ validateModifiedOnly: true });

        // Gửi email
        await sendOTPEmail(user.email, otp);

        res.json({ message: 'Mã OTP đã được gửi đến email của bạn' });
    } catch (error) {
        next(error);
    }
};

// ─── Xác thực OTP ────────────────────────────────────────────────────
exports.verifyOTP = async (req, res, next) => {
    try {
        const { email, otp } = req.body;
        if (!email || !otp) {
            return res.status(400).json({ error: 'Vui lòng nhập email và mã OTP' });
        }

        const user = await User.findOne({ email: email.toLowerCase().trim() });
        if (!user) {
            return res.status(404).json({ error: 'Email không tồn tại' });
        }

        if (!user.resetOTP || !user.resetOTPExpire) {
            return res.status(400).json({ error: 'Chưa có yêu cầu đặt lại mật khẩu' });
        }

        if (new Date() > user.resetOTPExpire) {
            user.resetOTP = null;
            user.resetOTPExpire = null;
            await user.save({ validateModifiedOnly: true });
            return res.status(400).json({ error: 'Mã OTP đã hết hạn. Vui lòng gửi lại.' });
        }

        if (user.resetOTP !== otp.trim()) {
            return res.status(400).json({ error: 'Mã OTP không chính xác' });
        }

        res.json({ message: 'Xác thực OTP thành công' });
    } catch (error) {
        next(error);
    }
};

// ─── Đặt lại mật khẩu ───────────────────────────────────────────────
exports.resetPassword = async (req, res, next) => {
    try {
        const { email, otp, newPassword } = req.body;
        if (!email || !otp || !newPassword) {
            return res.status(400).json({ error: 'Vui lòng cung cấp đầy đủ thông tin' });
        }

        if (newPassword.length < 6) {
            return res.status(400).json({ error: 'Mật khẩu mới phải có ít nhất 6 ký tự' });
        }

        const user = await User.findOne({ email: email.toLowerCase().trim() });
        if (!user) {
            return res.status(404).json({ error: 'Email không tồn tại' });
        }

        if (!user.resetOTP || !user.resetOTPExpire) {
            return res.status(400).json({ error: 'Chưa có yêu cầu đặt lại mật khẩu' });
        }

        if (new Date() > user.resetOTPExpire) {
            user.resetOTP = null;
            user.resetOTPExpire = null;
            await user.save({ validateModifiedOnly: true });
            return res.status(400).json({ error: 'Phiên đã hết hạn. Vui lòng thử lại từ đầu.' });
        }

        if (user.resetOTP !== otp.trim()) {
            return res.status(400).json({ error: 'Mã OTP không hợp lệ' });
        }

        // Cập nhật mật khẩu (pre-save hook sẽ hash)
        user.password = newPassword;
        user.resetOTP = null;
        user.resetOTPExpire = null;
        await user.save();

        res.json({ message: 'Đặt lại mật khẩu thành công' });
    } catch (error) {
        next(error);
    }
};

// ─── Google OAuth2: Đăng nhập / Đăng ký / Merge ──────────────────────
exports.googleLogin = async (req, res, next) => {
    try {
        const { credential } = req.body;

        if (!credential) {
            return res.status(400).json({ error: 'Thiếu token xác thực từ Google' });
        }

        // Xác thực access_token với Google — lấy thông tin user từ server
        const googleRes = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
            headers: { Authorization: `Bearer ${credential}` },
        });

        if (!googleRes.ok) {
            return res.status(401).json({ error: 'Token Google không hợp lệ hoặc đã hết hạn' });
        }

        const { sub: googleId, email, name, picture: googlePicture } = await googleRes.json();

        if (!googleId || !email) {
            return res.status(400).json({ error: 'Không thể lấy thông tin từ Google' });
        }

        const normalizedEmail = email.toLowerCase().trim();

        // Tìm user theo googleId HOẶC email (merge account)
        let user = await User.findOne({
            $or: [{ googleId }, { email: normalizedEmail }],
        });

        if (user) {
            // Merge: cập nhật googleId nếu user local đã tồn tại
            if (!user.googleId) {
                user.googleId = googleId;
            }
            // Luôn cập nhật googlePicture từ Google
            if (googlePicture) {
                user.googlePicture = googlePicture;
            }
            // Cập nhật avatar nếu chưa có
            if (!user.avatar && googlePicture) {
                user.avatar = googlePicture;
            }
            user.isVerified = true;
            await user.save({ validateModifiedOnly: true });
        } else {
            // Tạo user mới từ Google
            user = await User.create({
                username: name || normalizedEmail.split('@')[0],
                email: normalizedEmail,
                googleId,
                provider: 'google',
                avatar: googlePicture || '',
                googlePicture: googlePicture || '',
                isVerified: true,
            });
        }

        const token = generateToken(user._id);

        res.json({
            message: 'Đăng nhập Google thành công',
            token,
            user: user.toJSON(),
        });
    } catch (error) {
        if (error.code === 11000) {
            return res.status(409).json({ error: 'Username đã tồn tại. Vui lòng liên hệ hỗ trợ.' });
        }
        next(error);
    }
};
