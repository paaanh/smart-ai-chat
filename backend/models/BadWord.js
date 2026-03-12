const mongoose = require('mongoose');

const badWordSchema = new mongoose.Schema({
    word: {
        type: String,
        required: true,
        unique: true,
        trim: true,
        lowercase: true,
    },
    severity: {
        type: String,
        enum: ['low', 'medium', 'high'],
        default: 'medium',
    },
    isActive: {
        type: Boolean,
        default: true,
    },
    addedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        default: null,
    },
}, { timestamps: true });

badWordSchema.index({ word: 1 });
badWordSchema.index({ isActive: 1 });

module.exports = mongoose.model('BadWord', badWordSchema);
