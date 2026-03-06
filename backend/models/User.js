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
        required: [true, 'Password is required'],
        minlength: [6, 'Password must be at least 6 characters'],
        select: false,  // Không trả về password mặc định trong query
    },
    avatar: {
        type: String,
        default: '',
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

    status: {
        type: String,
        enum: ['online', 'offline', 'busy'],
        default: 'offline',
    },
    lastSeen: {
        type: Date,
        default: Date.now,
    },

    // Socket ID hiện tại (cập nhật khi connect/disconnect)
    socketId: {
        type: String,
        default: null,
    },
}, { timestamps: true });

// ─── Pre-save: Hash password ─────────────────────────────────────────
userSchema.pre('save', async function () {
    if (!this.isModified('password')) return;
    const salt = await bcrypt.genSalt(12);
    this.password = await bcrypt.hash(this.password, salt);

    // Auto-set language label
    if (this.isModified('preferredLanguage')) {
        this.preferredLanguageLabel = LANGUAGE_LABELS[this.preferredLanguage] || this.preferredLanguage;
    }
});

// ─── Method: So sánh password ────────────────────────────────────────
userSchema.methods.comparePassword = async function (candidatePassword) {
    return bcrypt.compare(candidatePassword, this.password);
};

// ─── Method: Trả về user JSON (ẩn password) ─────────────────────────
userSchema.methods.toJSON = function () {
    const obj = this.toObject();
    delete obj.password;
    return obj;
};

const User = mongoose.model('User', userSchema);

module.exports = { User, SUPPORTED_LANGUAGES, LANGUAGE_LABELS };
