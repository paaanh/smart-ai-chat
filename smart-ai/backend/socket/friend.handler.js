const Friendship = require('../models/Friendship');
const { User } = require('../models/User');
const Room = require('../models/Room');

module.exports = (io, socket) => {
    const userId = socket.user._id;

    // ─── friend:request — Send a friend request via socket ─────────────
    socket.on('friend:request', async ({ recipientId }) => {
        try {
            if (userId.toString() === recipientId) return;

            const existing = await Friendship.findOne({
                $or: [
                    { requester: userId, recipient: recipientId },
                    { requester: recipientId, recipient: userId },
                ],
            });

            if (existing && (existing.status === 'accepted' || existing.status === 'pending')) {
                return;
            }

            let friendship;
            if (existing && existing.status === 'rejected') {
                existing.requester = userId;
                existing.recipient = recipientId;
                existing.status = 'pending';
                await existing.save();
                friendship = existing;
            } else {
                friendship = await Friendship.create({
                    requester: userId,
                    recipient: recipientId,
                });
            }

            const populated = await friendship.populate(
                'requester recipient',
                'username avatar googlePicture status preferredLanguage preferredLanguageLabel'
            );

            // Notify recipient in real-time
            const recipient = await User.findById(recipientId);
            if (recipient?.socketId) {
                io.to(recipient.socketId).emit('friend:request-received', {
                    friendship: populated,
                });
            }

            socket.emit('friend:request-sent', { friendship: populated });
        } catch (error) {
            console.error('friend:request error:', error.message);
        }
    });

    // ─── friend:accept ─────────────────────────────────────────────────
    socket.on('friend:accept', async ({ friendshipId }) => {
        try {
            const friendship = await Friendship.findById(friendshipId);
            if (!friendship || friendship.recipient.toString() !== userId.toString()) return;
            if (friendship.status !== 'pending') return;

            friendship.status = 'accepted';
            await friendship.save();

            // Auto-create direct room if not existing
            let directRoom = await Room.findOne({
                type: 'direct',
                $and: [
                    { 'members.user': friendship.requester },
                    { 'members.user': friendship.recipient },
                ],
            });

            if (!directRoom) {
                directRoom = await Room.create({
                    type: 'direct',
                    members: [
                        { user: friendship.requester, role: 'admin' },
                        { user: friendship.recipient, role: 'member' },
                    ],
                });
                console.log(`[Friend Accept] Auto-created direct room ${directRoom._id} for ${friendship.requester} <-> ${friendship.recipient}`);
            }

            const populated = await friendship.populate(
                'requester recipient',
                'username avatar googlePicture status preferredLanguage preferredLanguageLabel'
            );

            const roomId = directRoom._id;

            // Notify both users with roomId
            socket.emit('friend:accepted', { friendship: populated, roomId });

            const requester = await User.findById(friendship.requester);
            if (requester?.socketId) {
                io.to(requester.socketId).emit('friend:accepted', {
                    friendship: populated,
                    roomId,
                });
            }
        } catch (error) {
            console.error('friend:accept error:', error.message);
        }
    });

    // ─── friend:reject ─────────────────────────────────────────────────
    socket.on('friend:reject', async ({ friendshipId }) => {
        try {
            const friendship = await Friendship.findById(friendshipId);
            if (!friendship || friendship.recipient.toString() !== userId.toString()) return;

            friendship.status = 'rejected';
            await friendship.save();

            socket.emit('friend:rejected', { friendshipId });
        } catch (error) {
            console.error('friend:reject error:', error.message);
        }
    });

    // ─── friend:cancel-request — Cancel a pending friend request ───────
    socket.on('friend:cancel-request', async ({ friendshipId }) => {
        try {
            const friendship = await Friendship.findById(friendshipId);
            if (!friendship || friendship.status !== 'pending') return;

            const isRequester = friendship.requester.toString() === userId.toString();
            const isRecipient = friendship.recipient.toString() === userId.toString();
            if (!isRequester && !isRecipient) return;

            const otherUserId = isRequester
                ? friendship.recipient
                : friendship.requester;

            await Friendship.findByIdAndDelete(friendshipId);

            // Notify the other party
            const otherUser = await User.findById(otherUserId);
            if (otherUser?.socketId) {
                io.to(otherUser.socketId).emit('friend:request-cancelled', {
                    friendshipId,
                });
            }

            socket.emit('friend:request-cancelled', { friendshipId });
        } catch (error) {
            console.error('friend:cancel-request error:', error.message);
        }
    });
};
