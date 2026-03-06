const Friendship = require('../models/Friendship');
const { User } = require('../models/User');

// Helper: emit socket event to a specific user
const emitToUser = async (io, userId, event, data) => {
    const userDoc = await User.findById(userId).select('socketId').lean();
    if (userDoc?.socketId) {
        io.to(userDoc.socketId).emit(event, data);
    }
};

// POST /api/friends/request — Send a friend request
exports.sendRequest = async (req, res, next) => {
    try {
        const requesterId = req.user._id;
        const { recipientId } = req.body;

        if (!recipientId) {
            return res.status(400).json({ error: 'recipientId là bắt buộc' });
        }

        if (requesterId.toString() === recipientId) {
            return res.status(400).json({ error: 'Không thể kết bạn với chính mình' });
        }

        // Check recipient exists
        const recipient = await User.findById(recipientId);
        if (!recipient) {
            return res.status(404).json({ error: 'Người dùng không tồn tại' });
        }

        // Check existing friendship in either direction
        const existing = await Friendship.findOne({
            $or: [
                { requester: requesterId, recipient: recipientId },
                { requester: recipientId, recipient: requesterId },
            ],
        });

        if (existing) {
            if (existing.status === 'accepted') {
                return res.status(409).json({ error: 'Đã là bạn bè' });
            }
            if (existing.status === 'pending') {
                return res.status(409).json({ error: 'Đã gửi lời mời kết bạn' });
            }
            // If rejected, allow re-request by updating
            existing.requester = requesterId;
            existing.recipient = recipientId;
            existing.status = 'pending';
            await existing.save();
            const populated = await existing.populate('requester recipient', 'username avatar status preferredLanguage preferredLanguageLabel');

            // Notify recipient in real-time
            const io = req.app.get('io');
            if (io) {
                await emitToUser(io, recipientId, 'friend:request-received', { friendship: populated });
            }

            return res.json({ friendship: populated });
        }

        const friendship = await Friendship.create({
            requester: requesterId,
            recipient: recipientId,
        });

        const populated2 = await friendship.populate('requester recipient', 'username avatar status preferredLanguage preferredLanguageLabel');

        // Notify recipient in real-time
        const io = req.app.get('io');
        if (io) {
            await emitToUser(io, recipientId, 'friend:request-received', { friendship: populated2 });
        }

        res.status(201).json({ friendship: populated2 });
    } catch (error) {
        if (error.code === 11000) {
            return res.status(409).json({ error: 'Lời mời kết bạn đã tồn tại' });
        }
        next(error);
    }
};

// PUT /api/friends/:id/accept — Accept a friend request
exports.acceptRequest = async (req, res, next) => {
    try {
        const friendship = await Friendship.findById(req.params.id);
        if (!friendship) {
            return res.status(404).json({ error: 'Lời mời không tồn tại' });
        }

        // Only recipient can accept
        if (friendship.recipient.toString() !== req.user._id.toString()) {
            return res.status(403).json({ error: 'Không có quyền' });
        }

        if (friendship.status !== 'pending') {
            return res.status(400).json({ error: 'Lời mời không ở trạng thái chờ' });
        }

        friendship.status = 'accepted';
        await friendship.save();

        const populated = await friendship.populate('requester recipient', 'username avatar status preferredLanguage preferredLanguageLabel');

        // Notify both users in real-time
        const io = req.app.get('io');
        if (io) {
            await emitToUser(io, friendship.requester._id, 'friend:accepted', { friendship: populated });
            await emitToUser(io, friendship.recipient._id, 'friend:accepted', { friendship: populated });
        }

        res.json({ friendship: populated });
    } catch (error) {
        next(error);
    }
};

// PUT /api/friends/:id/reject — Reject a friend request
exports.rejectRequest = async (req, res, next) => {
    try {
        const friendship = await Friendship.findById(req.params.id);
        if (!friendship) {
            return res.status(404).json({ error: 'Lời mời không tồn tại' });
        }

        if (friendship.recipient.toString() !== req.user._id.toString()) {
            return res.status(403).json({ error: 'Không có quyền' });
        }

        friendship.status = 'rejected';
        await friendship.save();

        res.json({ message: 'Đã từ chối lời mời kết bạn' });
    } catch (error) {
        next(error);
    }
};

// DELETE /api/friends/:id — Unfriend / cancel request
exports.removeFriend = async (req, res, next) => {
    try {
        const friendship = await Friendship.findById(req.params.id);
        if (!friendship) {
            return res.status(404).json({ error: 'Không tìm thấy' });
        }

        const userId = req.user._id.toString();
        if (friendship.requester.toString() !== userId && friendship.recipient.toString() !== userId) {
            return res.status(403).json({ error: 'Không có quyền' });
        }

        await Friendship.findByIdAndDelete(req.params.id);
        res.json({ message: 'Đã hủy kết bạn' });
    } catch (error) {
        next(error);
    }
};

// GET /api/friends — Get accepted friends list
exports.getFriends = async (req, res, next) => {
    try {
        const friends = await Friendship.getFriends(req.user._id);
        res.json({ friends });
    } catch (error) {
        next(error);
    }
};

// GET /api/friends/requests — Get pending friend requests received
exports.getRequests = async (req, res, next) => {
    try {
        const requests = await Friendship.getPendingRequests(req.user._id);
        res.json({ requests });
    } catch (error) {
        next(error);
    }
};

// GET /api/friends/sent — Get sent friend requests
exports.getSentRequests = async (req, res, next) => {
    try {
        const requests = await Friendship.getSentRequests(req.user._id);
        res.json({ requests });
    } catch (error) {
        next(error);
    }
};

// GET /api/friends/status/:userId — Check friendship status with a user
exports.getStatus = async (req, res, next) => {
    try {
        const currentUserId = req.user._id;
        const otherUserId = req.params.userId;

        const friendship = await Friendship.findOne({
            $or: [
                { requester: currentUserId, recipient: otherUserId },
                { requester: otherUserId, recipient: currentUserId },
            ],
        });

        if (!friendship) {
            return res.json({ status: 'none', friendshipId: null });
        }

        res.json({
            status: friendship.status,
            friendshipId: friendship._id,
            isRequester: friendship.requester.toString() === currentUserId.toString(),
        });
    } catch (error) {
        next(error);
    }
};
