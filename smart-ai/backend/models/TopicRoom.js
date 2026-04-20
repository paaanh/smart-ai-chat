const mongoose = require('mongoose');

const topicRoomSchema = new mongoose.Schema({
    room: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Room',
        required: true,
        unique: true,
    },
    title: {
        type: String,
        required: true,
        trim: true,
    },
    description: {
        type: String,
        default: '',
        trim: true,
    },
    category: {
        type: String,
        enum: ['tam_ly', 'suc_khoe', 'phap_luat', 'giao_duc', 'cong_nghe', 'giai_tri'],
        required: true,
    },
    tags: {
        type: [String],
        default: [],
    },
    creator: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true,
    },
    maxMembers: {
        type: Number,
        default: 50,
        min: 2,
    },
    isPublic: {
        type: Boolean,
        default: true,
    },
    isActive: {
        type: Boolean,
        default: true,
    },
    memberCount: {
        type: Number,
        default: 1,
        min: 0,
    },
}, { timestamps: true });

topicRoomSchema.index({ category: 1, isActive: 1 });
topicRoomSchema.index({ isPublic: 1, memberCount: -1 });
topicRoomSchema.index({ creator: 1, createdAt: -1 });

module.exports = mongoose.model('TopicRoom', topicRoomSchema);
