const Room = require('../models/Room');
const Message = require('../models/Message');

// ─── Tạo room mới ────────────────────────────────────────────────────
exports.createRoom = async (req, res, next) => {
    try {
        const { name, type, memberIds } = req.body;
        const currentUserId = req.user._id;

        // ── Direct chat (1-1) ──
        if (type === 'direct') {
            if (!memberIds || memberIds.length !== 1) {
                return res.status(400).json({ error: 'Chat 1-1 cần đúng 1 người nhận' });
            }

            const targetUserId = memberIds[0];

            // Kiểm tra đã có direct room chưa
            const existingRoom = await Room.findDirectRoom(currentUserId, targetUserId);
            if (existingRoom) {
                const populated = await existingRoom.populate('members.user', 'username avatar status preferredLanguage preferredLanguageLabel');
                return res.json({ room: populated, existing: true });
            }

            const room = await Room.create({
                type: 'direct',
                members: [
                    { user: currentUserId, role: 'admin' },
                    { user: targetUserId, role: 'member' },
                ],
            });

            const populated = await room.populate('members.user', 'username avatar status preferredLanguage preferredLanguageLabel');
            return res.status(201).json({ room: populated });
        }

        // ── Group chat ──
        if (type === 'group') {
            if (!name || name.trim().length === 0) {
                return res.status(400).json({ error: 'Tên nhóm là bắt buộc' });
            }
            if (!memberIds || memberIds.length < 1) {
                return res.status(400).json({ error: 'Nhóm cần ít nhất 1 thành viên khác' });
            }

            const members = [
                { user: currentUserId, role: 'admin' },
                ...memberIds.map(id => ({ user: id, role: 'member' })),
            ];

            const room = await Room.create({
                name: name.trim(),
                type: 'group',
                members,
            });

            const populated = await room.populate('members.user', 'username avatar status preferredLanguage preferredLanguageLabel');
            return res.status(201).json({ room: populated });
        }

        return res.status(400).json({ error: 'Loại room không hợp lệ (direct | group)' });
    } catch (error) {
        next(error);
    }
};

// ─── Lấy danh sách room của user ─────────────────────────────────────
exports.getUserRooms = async (req, res, next) => {
    try {
        const rooms = await Room.getUserRooms(req.user._id);
        res.json({ rooms });
    } catch (error) {
        next(error);
    }
};

// ─── Lấy thông tin chi tiết room ──────────────────────────────────────
exports.getRoomById = async (req, res, next) => {
    try {
        const room = await Room.findById(req.params.id)
            .populate('members.user', 'username avatar status preferredLanguage preferredLanguageLabel')
            .populate('lastMessage');

        if (!room) {
            return res.status(404).json({ error: 'Room không tồn tại' });
        }

        // Kiểm tra user có phải member không
        const isMember = room.members.some(m => m.user._id.toString() === req.user._id.toString());
        if (!isMember) {
            return res.status(403).json({ error: 'Bạn không phải thành viên của room này' });
        }

        res.json({ room });
    } catch (error) {
        next(error);
    }
};

// ─── Lấy tin nhắn của room (phân trang) ──────────────────────────────
exports.getRoomMessages = async (req, res, next) => {
    try {
        const { id } = req.params;
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 50;

        // Kiểm tra quyền truy cập
        const room = await Room.findById(id);
        if (!room) {
            return res.status(404).json({ error: 'Room không tồn tại' });
        }
        const isMember = room.members.some(m => m.user.toString() === req.user._id.toString());
        if (!isMember) {
            return res.status(403).json({ error: 'Bạn không phải thành viên của room này' });
        }

        const messages = await Message.getByRoom(id, { page, limit });
        const hasMore = messages.length >= limit;
        res.json({ messages, page, limit, hasMore });
    } catch (error) {
        next(error);
    }
};

// ─── Thêm thành viên vào group ────────────────────────────────────────
exports.addMember = async (req, res, next) => {
    try {
        const { id } = req.params;
        const { userId } = req.body;

        const room = await Room.findById(id);
        if (!room || room.type !== 'group') {
            return res.status(404).json({ error: 'Group không tồn tại' });
        }

        // Chỉ admin mới thêm được thành viên
        const currentMember = room.members.find(m => m.user.toString() === req.user._id.toString());
        if (!currentMember || currentMember.role !== 'admin') {
            return res.status(403).json({ error: 'Chỉ admin mới có quyền thêm thành viên' });
        }

        // Kiểm tra đã là member chưa
        const alreadyMember = room.members.some(m => m.user.toString() === userId);
        if (alreadyMember) {
            return res.status(409).json({ error: 'User đã là thành viên' });
        }

        room.members.push({ user: userId, role: 'member' });
        await room.save();

        const populated = await room.populate('members.user', 'username avatar status preferredLanguage preferredLanguageLabel');
        res.json({ room: populated });
    } catch (error) {
        next(error);
    }
};

// ─── Rời khỏi group ──────────────────────────────────────────────────
exports.leaveRoom = async (req, res, next) => {
    try {
        const { id } = req.params;

        const room = await Room.findById(id);
        if (!room) {
            return res.status(404).json({ error: 'Room không tồn tại' });
        }

        room.members = room.members.filter(m => m.user.toString() !== req.user._id.toString());

        if (room.members.length === 0) {
            await Room.findByIdAndDelete(id);
            return res.json({ message: 'Room đã bị xóa vì không còn thành viên' });
        }

        await room.save();
        res.json({ message: 'Đã rời khỏi room' });
    } catch (error) {
        next(error);
    }
};
