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
    // ── Group profile fields ──
    groupAvatar: {
        type: String,
        default: '',
    },
    groupBackground: {
        type: String,
        default: '',
    },
    description: {
        type: String,
        default: '',
        maxlength: [500, 'Mô tả nhóm không được vượt quá 500 ký tự'],
    },
    type: {
        type: String,
        enum: ['direct', 'group'],
        required: true,
    },
    members: [memberSchema],

    // Danh sách chờ duyệt (chỉ group — admin duyệt trước khi vào members)
    pendingMembers: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
    }],

    // Biệt danh trong room: { "userId": "nickname" }
    nicknames: {
        type: Map,
        of: String,
        default: new Map(),
    },

    // Danh sách user đã tắt thông báo room này
    mutedBy: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
    }],

    // Danh sách user đã ẩn cuộc trò chuyện này khỏi sidebar
    hiddenFor: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
    }],

    lastMessage: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Message',
        default: null,
    },

    // Tin nhắn đã ghim
    pinnedMessages: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Message',
    }],

    // Cài đặt room-level
    settings: {
        aiTranslationEnabled: {
            type: Boolean,
            default: true,
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
    return this.find({ 'members.user': userId, hiddenFor: { $ne: userId } })
        .populate('members.user', 'username avatar googlePicture status preferredLanguage preferredLanguageLabel')
        .populate('lastMessage')
        .sort({ updatedAt: -1 });
};

const Room = mongoose.model('Room', roomSchema);

module.exports = Room;
