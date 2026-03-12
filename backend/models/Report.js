const mongoose = require('mongoose');

const reportSchema = new mongoose.Schema({
    reporter: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true,
    },
    reportedUser: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true,
    },
    room: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Room',
        default: null,
    },
    message: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Message',
        default: null,
    },
    targetType: {
        type: String,
        enum: ['user', 'message', 'call'],
        default: 'user',
    },
    reason: {
        type: String,
        required: true,
        enum: [
            'spam',
            'harassment',
            'hate_speech',
            'violence',
            'inappropriate_content',
            'impersonation',
            'other',
        ],
    },
    description: {
        type: String,
        default: '',
        maxlength: 500,
    },
    evidence: {
        type: [String],
        default: [],
    },
    status: {
        type: String,
        enum: ['pending', 'reviewed', 'resolved', 'dismissed'],
        default: 'pending',
    },
    resolvedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        default: null,
    },
    resolvedAt: {
        type: Date,
        default: null,
    },
    adminNote: {
        type: String,
        default: '',
    },
}, { timestamps: true });

reportSchema.index({ reporter: 1, reportedUser: 1 });
reportSchema.index({ status: 1 });
reportSchema.index({ targetType: 1 });

module.exports = mongoose.model('Report', reportSchema);
