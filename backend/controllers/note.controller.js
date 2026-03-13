const Note = require('../models/Note');
const Friendship = require('../models/Friendship');
const Room = require('../models/Room');
const Message = require('../models/Message');

// ─── Lấy notes của bạn bè (chưa hết hạn) ────────────────────────────
exports.getFriendNotes = async (req, res, next) => {
    try {
        const userId = req.user._id;

        // Lấy danh sách bạn bè
        const friendships = await Friendship.find({
            $or: [{ requester: userId }, { recipient: userId }],
            status: 'accepted',
        }).lean();

        const friendIds = friendships.map(f =>
            f.requester.toString() === userId.toString() ? f.recipient : f.requester
        );
        friendIds.push(userId); // Include own notes

        const notes = await Note.find({
            author: { $in: friendIds },
            expiresAt: { $gt: new Date() },
        })
            .populate('author', 'username avatar googlePicture')
            .sort({ createdAt: -1 });

        res.json({ notes });
    } catch (error) {
        next(error);
    }
};

// ─── Tạo note mới ────────────────────────────────────────────────────
exports.createNote = async (req, res, next) => {
    try {
        const { content } = req.body;
        if (!content || !content.trim()) {
            return res.status(400).json({ error: 'Nội dung note không được trống' });
        }
        if (content.length > 60) {
            return res.status(400).json({ error: 'Note tối đa 60 ký tự' });
        }

        // Delete existing note of this user (only 1 active note at a time)
        await Note.deleteMany({ author: req.user._id });

        const note = await Note.create({
            author: req.user._id,
            content: content.trim(),
        });

        const populated = await Note.findById(note._id)
            .populate('author', 'username avatar googlePicture');

        // Emit to friends via socket
        const io = req.app.get('io');
        if (io) {
            io.emit('note:new', { note: populated });
        }

        res.status(201).json({ note: populated });
    } catch (error) {
        next(error);
    }
};

// ─── Xóa note ────────────────────────────────────────────────────────
exports.deleteNote = async (req, res, next) => {
    try {
        const note = await Note.findById(req.params.id);
        if (!note) return res.status(404).json({ error: 'Note không tồn tại' });
        if (note.author.toString() !== req.user._id.toString()) {
            return res.status(403).json({ error: 'Bạn không có quyền xóa note này' });
        }

        await Note.findByIdAndDelete(req.params.id);
        res.json({ message: 'Đã xóa note' });
    } catch (error) {
        next(error);
    }
};

// ─── Reply note → send as direct message ─────────────────────────────
exports.replyNote = async (req, res, next) => {
    try {
        const { content } = req.body;
        if (!content || !content.trim()) {
            return res.status(400).json({ error: 'Nội dung reply không được trống' });
        }

        const note = await Note.findById(req.params.id);
        if (!note) return res.status(404).json({ error: 'Note không tồn tại' });

        const replierId = req.user._id;
        const noteOwnerId = note.author;

        // Prevent replying to own note
        if (replierId.toString() === noteOwnerId.toString()) {
            return res.status(400).json({ error: 'Không thể trả lời note của chính mình' });
        }

        // Find or create direct room between replier and note owner
        let room = await Room.findDirectRoom(replierId, noteOwnerId);
        if (!room) {
            room = await Room.create({
                type: 'direct',
                members: [
                    { user: replierId, role: 'admin' },
                    { user: noteOwnerId, role: 'member' },
                ],
            });
        }

        // Create message in that room
        const message = await Message.create({
            room: room._id,
            sender: replierId,
            type: 'text',
            content: content.trim(),
        });

        const populatedMessage = await Message.findById(message._id)
            .populate('sender', 'username avatar googlePicture preferredLanguage');

        // Update lastMessage on the room
        await Room.findByIdAndUpdate(room._id, { lastMessage: message._id });

        // Emit to the room via socket
        const io = req.app.get('io');
        if (io) {
            io.to(room._id.toString()).emit('message:received', { message: populatedMessage });

            // Notify room members for sidebar update
            const populatedRoom = await Room.findById(room._id).populate('members.user', 'socketId');
            if (populatedRoom) {
                for (const member of populatedRoom.members) {
                    if (member.user._id.toString() === replierId.toString()) continue;
                    if (member.user.socketId) {
                        io.to(member.user.socketId).emit('room:new-message', {
                            roomId: room._id.toString(),
                            lastMessage: populatedMessage,
                            senderId: replierId.toString(),
                        });
                    }
                }
            }
        }

        res.json({ roomId: room._id });
    } catch (error) {
        next(error);
    }
};
