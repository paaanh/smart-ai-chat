const Note = require('../models/Note');
const Friendship = require('../models/Friendship');

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
        const { content, music } = req.body;
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
            music: music || '',
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

// ─── Reply note ──────────────────────────────────────────────────────
exports.replyNote = async (req, res, next) => {
    try {
        const { content } = req.body;
        if (!content || !content.trim()) {
            return res.status(400).json({ error: 'Nội dung reply không được trống' });
        }

        const note = await Note.findById(req.params.id);
        if (!note) return res.status(404).json({ error: 'Note không tồn tại' });

        note.replies.push({
            user: req.user._id,
            content: content.trim(),
        });
        await note.save();

        res.json({ message: 'Đã reply note' });
    } catch (error) {
        next(error);
    }
};
