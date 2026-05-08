const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const SUPPORTED_LANGUAGES = ['vi', 'en', 'ja', 'ko', 'zh', 'fr', 'de', 'es', 'th', 'ru', 'pt', 'ar'];

const LANGUAGE_LABELS = {
    vi: 'Tiếng Việt',
    en: 'English',
    ja: '日本語',
    ko: '한국어',
    zh: '中文',
    fr: 'Français',
    de: 'Deutsch',
    es: 'Español',
    th: 'ภาษาไทย',
    ru: 'Русский',
    pt: 'Português',
    ar: 'العربية',
};

const SUPPORTED_BUBBLE_FRAMES = [
    'classic-blue',
    'capybara-red',
    'frog-green',
    'cat-yellow',
    'violet-grape',
    'pink-heart',
    'dolphin-lavender',
    'hamster-orange',
    'peach-doge',
    'duck-blue',
    'ladybug-red',
    'llama-mint',
    'dog-brown',
    'spark-lime',
    'hug-rose',
];

const userSchema = new mongoose.Schema({
    username: {
        type: String,
        required: [true, 'Username is required'],
        unique: true,
        trim: true,
        minlength: [3, 'Username must be at least 3 characters'],
        maxlength: [30, 'Username cannot exceed 30 characters'],
    },
    email: {
        type: String,
        required: [true, 'Email is required'],
        unique: true,
        lowercase: true,
        trim: true,
        match: [/^\S+@\S+\.\S+$/, 'Please provide a valid email'],
    },
    password: {
        type: String,
        default: null,
        minlength: [6, 'Password must be at least 6 characters'],
        select: false,  // Không trả về password mặc định trong query
    },

    // ===== PHƯƠNG THỨC ĐĂNG NHẬP =====
    provider: {
        type: String,
        enum: ['local', 'google'],
        default: 'local',
    },
    googleId: {
        type: String,
        default: null,
    },
    avatar: {
        type: String,
        default: '',
    },
    googlePicture: {
        type: String,
        default: '',
    },
    coverPicture: {
        type: String,
        default: '',
    },
    bio: {
        type: String,
        default: '',
        maxlength: [200, 'Bio cannot exceed 200 characters'],
    },
    phoneNumber: {
        type: String,
        default: '',
    },
    address: {
        type: String,
        default: '',
    },
    education: {
        type: String,
        default: '',
    },
    hobbies: {
        type: [String],
        default: [],
    },
    interests: {
        type: [String],
        default: [],
    },

    // ===== TÍNH NĂNG DỊCH THUẬT CÁ NHÂN HÓA =====
    preferredLanguage: {
        type: String,
        default: 'vi',
        enum: SUPPORTED_LANGUAGES,
    },
    preferredLanguageLabel: {
        type: String,
        default: 'Tiếng Việt',
    },

    // ===== THEME MÀU SẮC =====
    preferredTheme: {
        type: String,
        default: 'blue',
        enum: ['blue', 'red', 'purple', 'yellow', 'brown', 'dark', 'light', 'midnight-purple', 'solarized', 'glassmorphism', 'retro-terminal'],
    },

    // ===== KHUNG BONG BONG CHAT =====
    preferredBubbleFrame: {
        type: String,
        default: 'classic-blue',
        enum: SUPPORTED_BUBBLE_FRAMES,
    },

    status: {
        type: String,
        enum: ['active', 'banned', 'online', 'offline', 'busy'],
        default: 'active',
    },
    lastSeen: {
        type: Date,
        default: Date.now,
    },
    lastOnline: {
        type: Date,
        default: null,
    },

    // ===== TRẠNG THÁI TÀI KHOẢN =====
    accountStatus: {
        type: String,
        enum: ['active', 'banned', 'locked'],
        default: 'active',
    },
    lock_until: {
        type: Date,
        default: null,
    },
    is_locked: {
        type: Boolean,
        default: false,
    },



    // Danh sách user bị chặn
    blockedUsers: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
    }],

    // Socket ID hiện tại (cập nhật khi connect/disconnect)
    socketId: {
        type: String,
        default: null,
    },

    // ===== RESET PASSWORD OTP =====
    resetOTP: {
        type: String,
        default: null,
    },
    resetOTPExpire: {
        type: Date,
        default: null,
    },

    // ===== XÁC THỰC TÀI KHOẢN =====
    isVerified: {
        type: Boolean,
        default: false,
    },

    // ===== PHÂN QUYỀN =====
    role: {
        type: String,
        enum: ['user', 'expert', 'sub_admin', 'super_admin'],
        default: 'user',
    },
    // Chuyên môn của expert (chỉ áp dụng khi role='expert')
    expertCategories: {
        type: [String],
        enum: ['tam_ly', 'phap_luat', 'bao_luc_gia_dinh', 'suc_khoe', 'giao_duc'],
        default: [],
    },
}, {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
});

// Backward compatibility: existing code can still use user.lockUntil
userSchema.virtual('lockUntil')
    .get(function () {
        return this.lock_until;
    })
    .set(function (value) {
        this.lock_until = value;
    });

// ─── Pre-save: Hash password ─────────────────────────────────────────
userSchema.pre('save', async function () {
    // Auto-set language label
    if (this.isModified('preferredLanguage')) {
        this.preferredLanguageLabel = LANGUAGE_LABELS[this.preferredLanguage] || this.preferredLanguage;
    }

    // Chỉ hash password nếu có giá trị và đã thay đổi
    if (!this.isModified('password') || !this.password) return;
    const salt = await bcrypt.genSalt(12);
    this.password = await bcrypt.hash(this.password, salt);
});

// ─── Method: So sánh password ────────────────────────────────────────
userSchema.methods.comparePassword = async function (candidatePassword) {
    if (!this.password) return false;
    return bcrypt.compare(candidatePassword, this.password);
};

// ─── Method: Trả về user JSON (ẩn password) ─────────────────────────
userSchema.methods.toJSON = function () {
    const obj = this.toObject();
    delete obj.password;
    return obj;
};

const User = mongoose.model('User', userSchema);

module.exports = { User, SUPPORTED_LANGUAGES, LANGUAGE_LABELS, SUPPORTED_BUBBLE_FRAMES };
