const mongoose = require('mongoose');

const translationSchema = new mongoose.Schema({
    language: { type: String, required: true },       // Mã ngôn ngữ đích (en, ja, ...)
    content: { type: String, required: true },       // Nội dung đã dịch
    translatedAt: { type: Date, default: Date.now },
}, { _id: false });

const messageSchema = new mongoose.Schema({
    room: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Room',
        required: true,
        index: true,
    },
    sender: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true,
    },

    // ===== NỘI DUNG GỐC =====
    type: {
        type: String,
        enum: ['text', 'image', 'video', 'file', 'location', 'system', 'ai-response', 'poll', 'contact-card'],
        default: 'text',
    },
    content: {
        type: String,
        default: '',
    },

    // ===== METADATA FILE =====
    file: {
        url: { type: String },
        name: { type: String },
        size: { type: Number },
        mimeType: { type: String },
    },

    // ===== METADATA VỊ TRÍ =====
    location: {
        lat: { type: Number },
        lng: { type: Number },
        address: { type: String, default: '' },
    },

    // ===== AI / DỊCH THUẬT METADATA =====
    originalLanguage: {
        type: String,
        default: null,            // Ngôn ngữ gốc (lấy từ sender.preferredLanguage)
    },
    translations: [translationSchema],

    // AI Bot response metadata
    aiMetadata: {
        isAIResponse: { type: Boolean, default: false },
        prompt: { type: String, default: null },
        model: { type: String, default: null },
    },

    // Reactions (emoji)
    reactions: [{
        user: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
        emoji: { type: String, required: true },
    }],

    // Trạng thái đã đọc
    readBy: [{
        user: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
        readAt: { type: Date, default: Date.now },
    }],

    deleted: { type: Boolean, default: false },

    // ===== POLL =====
    poll: {
        question: { type: String },
        options: [{
            text: { type: String },
            votes: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
        }],
        multipleChoice: { type: Boolean, default: false },
    },

    // ===== PIN =====
    pinned: { type: Boolean, default: false },
    pinnedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    pinnedAt: { type: Date, default: null },

    // ===== FORWARD =====
    forwardedFrom: {
        room: { type: mongoose.Schema.Types.ObjectId, ref: 'Room' },
        sender: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
        senderName: { type: String },
    },

    // ===== CONTACT CARD =====
    contactCard: {
        userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
        username: { type: String },
        avatar: { type: String },
        bio: { type: String },
    },

    // ===== SOFT DELETE PER USER =====
    deletedFor: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
}, { timestamps: true });

// ─── Indexes ──────────────────────────────────────────────────────────
messageSchema.index({ room: 1, createdAt: -1 });
messageSchema.index({ sender: 1 });

// ─── Static: Lấy tin nhắn phân trang ─────────────────────────────────
messageSchema.statics.getByRoom = async function (roomId, { page = 1, limit = 50, userId = null } = {}) {
    const skip = (page - 1) * limit;
    const filter = { room: roomId, deleted: false };
    if (userId) {
        filter.deletedFor = { $ne: userId };
    }
    const messages = await this.find(filter)
        .populate('sender', 'username avatar googlePicture preferredLanguage')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean();

    return messages.reverse(); // Trả về theo thứ tự cũ → mới
};

const Message = mongoose.model('Message', messageSchema);

module.exports = Message;
