const mongoose = require('mongoose');

const playerSchema = new mongoose.Schema({
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true,
    },
    username: {
        type: String,
        required: true,
        trim: true,
    },
    x: {
        type: Number,
        default: 400,
    },
    y: {
        type: Number,
        default: 300,
    },
    anim: {
        type: String,
        default: 'idle-down',
    },
    officeId: {
        type: String,
        default: 'main-office',
    },
}, { timestamps: true });

// One active session per user per office
playerSchema.index({ userId: 1, officeId: 1 }, { unique: true });

const Player = mongoose.model('Player', playerSchema);

module.exports = Player;
