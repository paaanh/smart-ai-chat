const mongoose = require('mongoose');

const counselingSessionSchema = new mongoose.Schema({
    room: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Room',
        required: true,
    },
    user: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true,
    },
    expert: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        default: null,
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
    status: {
        type: String,
        enum: ['active', 'closed'],
        default: 'active',
    },
    aiActive: {
        type: Boolean,
        default: true,
    },
    isAnonymous: {
        type: Boolean,
        default: false,
    },
}, { timestamps: true });

counselingSessionSchema.index({ userId: 1, status: 1 });
counselingSessionSchema.index({ updatedAt: -1 });

module.exports = mongoose.model('CounselingSession', counselingSessionSchema);
