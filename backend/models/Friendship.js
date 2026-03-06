const mongoose = require('mongoose');

const friendshipSchema = new mongoose.Schema({
    requester: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true,
    },
    recipient: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true,
    },
    status: {
        type: String,
        enum: ['pending', 'accepted', 'rejected'],
        default: 'pending',
    },
}, { timestamps: true });

// Ensure no duplicate friendship pairs
friendshipSchema.index({ requester: 1, recipient: 1 }, { unique: true });
friendshipSchema.index({ recipient: 1, status: 1 });
friendshipSchema.index({ requester: 1, status: 1 });

// Get all accepted friends for a user
friendshipSchema.statics.getFriends = async function (userId) {
    const friendships = await this.find({
        $or: [
            { requester: userId, status: 'accepted' },
            { recipient: userId, status: 'accepted' },
        ],
    })
        .populate('requester', 'username avatar status preferredLanguage preferredLanguageLabel')
        .populate('recipient', 'username avatar status preferredLanguage preferredLanguageLabel')
        .lean();

    return friendships.map((f) => {
        const friend = f.requester._id.toString() === userId.toString()
            ? f.recipient
            : f.requester;
        return { ...friend, friendshipId: f._id };
    });
};

// Get pending requests received by user
friendshipSchema.statics.getPendingRequests = async function (userId) {
    return this.find({ recipient: userId, status: 'pending' })
        .populate('requester', 'username avatar status preferredLanguage preferredLanguageLabel')
        .sort({ createdAt: -1 })
        .lean();
};

// Get sent requests by a user
friendshipSchema.statics.getSentRequests = async function (userId) {
    return this.find({ requester: userId, status: 'pending' })
        .populate('recipient', 'username avatar status preferredLanguage preferredLanguageLabel')
        .sort({ createdAt: -1 })
        .lean();
};

// Check if two users are friends
friendshipSchema.statics.areFriends = async function (userId1, userId2) {
    const friendship = await this.findOne({
        $or: [
            { requester: userId1, recipient: userId2, status: 'accepted' },
            { requester: userId2, recipient: userId1, status: 'accepted' },
        ],
    });
    return !!friendship;
};

const Friendship = mongoose.model('Friendship', friendshipSchema);

module.exports = Friendship;
