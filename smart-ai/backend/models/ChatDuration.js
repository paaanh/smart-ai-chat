const mongoose = require('mongoose');

const chatDurationSchema = new mongoose.Schema({
    participants: {
        type: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true }],
        validate: {
            validator(value) {
                return Array.isArray(value) && value.length === 2;
            },
            message: 'participants phải gồm đúng 2 user',
        },
        required: true,
    },
    roomId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Room',
        required: true,
    },
    totalMessages: {
        type: Number,
        default: 0,
    },
    lastInteraction: {
        type: Date,
        default: Date.now,
    },
}, { timestamps: true });

chatDurationSchema.pre('validate', function (next) {
    if (Array.isArray(this.participants) && this.participants.length === 2) {
        this.participants = this.participants
            .map((id) => id.toString())
            .sort()
            .map((id) => new mongoose.Types.ObjectId(id));
    }
    next();
});

chatDurationSchema.index({ participants: 1 }, { unique: true });
chatDurationSchema.index({ lastInteraction: -1 });

module.exports = mongoose.model('ChatDuration', chatDurationSchema);
