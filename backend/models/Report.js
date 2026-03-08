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
    status: {
        type: String,
        enum: ['pending', 'reviewed', 'resolved', 'dismissed'],
        default: 'pending',
    },
}, { timestamps: true });

reportSchema.index({ reporter: 1, reportedUser: 1 });
reportSchema.index({ status: 1 });

module.exports = mongoose.model('Report', reportSchema);
