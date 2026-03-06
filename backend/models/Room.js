const mongoose = require('mongoose');

const memberSchema = new mongoose.Schema({
    user: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true,
    },
    role: {
        type: String,
        enum: ['admin', 'member'],
        default: 'member',
    },
    joinedAt: {
        type: Date,
        default: Date.now,
    },
    // Mỗi user tự bật/tắt AI bot trong room
    aiBotEnabled: {
        type: Boolean,
        default: false,
    },
}, { _id: false });

const roomSchema = new mongoose.Schema({
    name: {
        type: String,
        trim: true,
        default: null,      // null nếu chat 1-1
    },
    avatar: {
        type: String,
        default: '',
    },
    type: {
        type: String,
        enum: ['direct', 'group'],
        required: true,
    },
    members: [memberSchema],

    lastMessage: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Message',
        default: null,
    },

    // Cài đặt room-level
    settings: {
        aiTranslationEnabled: {
            type: Boolean,
            default: true,     // Cho phép dịch thuật tự động
        },
    },
}, { timestamps: true });

// ─── Indexes ──────────────────────────────────────────────────────────
roomSchema.index({ 'members.user': 1 });
roomSchema.index({ type: 1, 'members.user': 1 });
roomSchema.index({ updatedAt: -1 });

// ─── Static: Tìm direct room giữa 2 user ────────────────────────────
roomSchema.statics.findDirectRoom = async function (userId1, userId2) {
    return this.findOne({
        type: 'direct',
        'members.user': { $all: [userId1, userId2] },
        $expr: { $eq: [{ $size: '$members' }, 2] },
    });
};

// ─── Static: Lấy tất cả room của 1 user ─────────────────────────────
roomSchema.statics.getUserRooms = async function (userId) {
    return this.find({ 'members.user': userId })
        .populate('members.user', 'username avatar status preferredLanguage preferredLanguageLabel')
        .populate('lastMessage')
        .sort({ updatedAt: -1 });
};

const Room = mongoose.model('Room', roomSchema);

module.exports = Room;
