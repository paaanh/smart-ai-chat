const mongoose = require('mongoose');

const counselingMessageSchema = new mongoose.Schema({
    role: {
        type: String,
        enum: ['user', 'assistant', 'system'],
        required: true,
    },
    content: {
        type: String,
        required: true,
        trim: true,
    },
    timestamp: {
        type: Date,
        default: Date.now,
    },
}, { _id: false });

const counselingSessionSchema = new mongoose.Schema({
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true,
    },
    category: {
        type: String,
        enum: ['tam_ly', 'phap_luat', 'bao_luc_gia_dinh', 'suc_khoe', 'giao_duc'],
        required: true,
    },
    title: {
        type: String,
        trim: true,
        default: '',
    },
    messages: {
        type: [counselingMessageSchema],
        default: [],
    },
    status: {
        type: String,
        enum: ['active', 'closed'],
        default: 'active',
    },
    isAnonymous: {
        type: Boolean,
        default: false,
    },
}, { timestamps: true });

counselingSessionSchema.index({ userId: 1, status: 1 });
counselingSessionSchema.index({ updatedAt: -1 });

module.exports = mongoose.model('CounselingSession', counselingSessionSchema);
