const mongoose = require('mongoose');

const noteSchema = new mongoose.Schema({
    author: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true,
    },
    content: {
        type: String,
        required: true,
        maxlength: [60, 'Note không được vượt quá 60 ký tự'],
    },
    expiresAt: {
        type: Date,
        required: true,
        default: () => new Date(Date.now() + 24 * 60 * 60 * 1000), // 24h
    },
}, { timestamps: true });

// TTL index: auto-delete expired notes
noteSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });
noteSchema.index({ author: 1 });

const Note = mongoose.model('Note', noteSchema);

module.exports = Note;
