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

        const leavingUserId = req.user._id.toString();
        const leavingMember = room.members.find(m => m.user.toString() === leavingUserId);
        if (!leavingMember) {
            return res.status(403).json({ error: 'Bạn không phải thành viên' });
        }

        room.members = room.members.filter(m => m.user.toString() !== leavingUserId);

        if (room.members.length === 0) {
            await Room.findByIdAndDelete(id);
            return res.json({ message: 'Room đã bị xóa vì không còn thành viên' });
        }

        // Nếu admin rời nhóm, chuyển quyền cho member đầu tiên
        if (room.type === 'group' && leavingMember.role === 'admin') {
            const hasOtherAdmin = room.members.some(m => m.role === 'admin');
            if (!hasOtherAdmin && room.members.length > 0) {
                room.members[0].role = 'admin';
            }
        }

        await room.save();
        res.json({ message: 'Đã rời khỏi room' });
    } catch (error) {
        next(error);
    }
};

// ─── Đặt biệt danh ──────────────────────────────────────────────────
exports.setNickname = async (req, res, next) => {
    try {
        const { id } = req.params;
        const { targetUserId, nickname } = req.body;

        const room = await Room.findById(id);
        if (!room) {
            return res.status(404).json({ error: 'Room không tồn tại' });
        }

        const isMember = room.members.some(m => m.user.toString() === req.user._id.toString());
        if (!isMember) {
            return res.status(403).json({ error: 'Bạn không phải thành viên' });
        }

        // Kiểm tra target cũng là member
        const targetIsMember = room.members.some(m => m.user.toString() === targetUserId);
        if (!targetIsMember) {
            return res.status(400).json({ error: 'User không phải thành viên của room' });
        }

        if (nickname && nickname.trim()) {
            room.nicknames.set(targetUserId, nickname.trim());
        } else {
            room.nicknames.delete(targetUserId);
        }

        await room.save();
        res.json({ nicknames: Object.fromEntries(room.nicknames) });
    } catch (error) {
        next(error);
    }
};

// ─── Tắt/Bật thông báo ──────────────────────────────────────────────
exports.toggleMute = async (req, res, next) => {
    try {
        const { id } = req.params;
        const userId = req.user._id;

        const room = await Room.findById(id);
        if (!room) {
            return res.status(404).json({ error: 'Room không tồn tại' });
        }

        const isMember = room.members.some(m => m.user.toString() === userId.toString());
        if (!isMember) {
            return res.status(403).json({ error: 'Bạn không phải thành viên' });
        }

        const isMuted = room.mutedBy.some(uid => uid.toString() === userId.toString());

        if (isMuted) {
            room.mutedBy = room.mutedBy.filter(uid => uid.toString() !== userId.toString());
        } else {
            room.mutedBy.push(userId);
        }

        await room.save();
        res.json({ muted: !isMuted });
    } catch (error) {
        next(error);
    }
};

// ─── Yêu cầu tham gia nhóm (pending) ────────────────────────────────
exports.requestJoin = async (req, res, next) => {
    try {
        const { id } = req.params;
        const { userId } = req.body;
        const requesterId = req.user._id;

        const room = await Room.findById(id);
        if (!room || room.type !== 'group') {
            return res.status(404).json({ error: 'Nhóm không tồn tại' });
        }

        // Chỉ member hiện tại mới mời được người khác
        const isMember = room.members.some(m => m.user.toString() === requesterId.toString());
        if (!isMember) {
            return res.status(403).json({ error: 'Bạn không phải thành viên' });
        }

        const targetId = userId || requesterId.toString();

        // Đã là member?
        const alreadyMember = room.members.some(m => m.user.toString() === targetId);
        if (alreadyMember) {
            return res.status(409).json({ error: 'User đã là thành viên' });
        }

        // Đã trong danh sách chờ?
        const alreadyPending = room.pendingMembers.some(uid => uid.toString() === targetId);
        if (alreadyPending) {
            return res.status(409).json({ error: 'User đã trong danh sách chờ' });
        }

        room.pendingMembers.push(targetId);
        await room.save();

        // Thông báo realtime cho admin
        const io = req.app.get('io');
        if (io) {
            room.members.filter(m => m.role === 'admin').forEach(admin => {
                io.to(`user:${admin.user.toString()}`).emit('room:pending-member', {
                    roomId: id,
                    userId: targetId,
                });
            });
        }

        res.json({ message: 'Đã thêm vào danh sách chờ duyệt' });
    } catch (error) {
        next(error);
    }
};

// ─── Admin duyệt thành viên chờ ─────────────────────────────────────
exports.approveMember = async (req, res, next) => {
    try {
        const { id } = req.params;
        const { userId } = req.body;

        const room = await Room.findById(id);
        if (!room || room.type !== 'group') {
            return res.status(404).json({ error: 'Nhóm không tồn tại' });
        }

        // Kiểm tra quyền admin
        const currentMember = room.members.find(m => m.user.toString() === req.user._id.toString());
        if (!currentMember || currentMember.role !== 'admin') {
            return res.status(403).json({ error: 'Chỉ admin mới có quyền duyệt' });
        }

        // Kiểm tra user có trong danh sách chờ không
        const isPending = room.pendingMembers.some(uid => uid.toString() === userId);
        if (!isPending) {
            return res.status(400).json({ error: 'User không có trong danh sách chờ' });
        }

        // Chuyển từ pending sang members
        room.pendingMembers = room.pendingMembers.filter(uid => uid.toString() !== userId);
        room.members.push({ user: userId, role: 'member' });
        await room.save();

        const populated = await room.populate('members.user', 'username avatar status preferredLanguage preferredLanguageLabel');

        // Thông báo realtime
        const io = req.app.get('io');
        if (io) {
            io.to(`user:${userId}`).emit('room:approved', { roomId: id });
        }

        res.json({ room: populated });
    } catch (error) {
        next(error);
    }
};

// ─── Admin từ chối thành viên chờ ───────────────────────────────────
exports.rejectMember = async (req, res, next) => {
    try {
        const { id } = req.params;
        const { userId } = req.body;

        const room = await Room.findById(id);
        if (!room || room.type !== 'group') {
            return res.status(404).json({ error: 'Nhóm không tồn tại' });
        }

        const currentMember = room.members.find(m => m.user.toString() === req.user._id.toString());
        if (!currentMember || currentMember.role !== 'admin') {
            return res.status(403).json({ error: 'Chỉ admin mới có quyền từ chối' });
        }

        const isPending = room.pendingMembers.some(uid => uid.toString() === userId);
        if (!isPending) {
            return res.status(400).json({ error: 'User không có trong danh sách chờ' });
        }

        room.pendingMembers = room.pendingMembers.filter(uid => uid.toString() !== userId);
        await room.save();

        res.json({ message: 'Đã từ chối' });
    } catch (error) {
        next(error);
    }
};

// ─── Lấy danh sách pending members ─────────────────────────────────
exports.getPendingMembers = async (req, res, next) => {
    try {
        const { id } = req.params;

        const room = await Room.findById(id).populate('pendingMembers', 'username avatar');
        if (!room || room.type !== 'group') {
            return res.status(404).json({ error: 'Nhóm không tồn tại' });
        }

        const currentMember = room.members.find(m => m.user.toString() === req.user._id.toString());
        if (!currentMember || currentMember.role !== 'admin') {
            return res.status(403).json({ error: 'Chỉ admin mới xem được' });
        }

        res.json({ pendingMembers: room.pendingMembers });
    } catch (error) {
        next(error);
    }
};

// ─── Admin cập nhật thông tin nhóm (avatar, cover, description) ─────
exports.updateGroupSettings = async (req, res, next) => {
    try {
        const { id } = req.params;
        const { name, description, groupAvatar, groupBackground } = req.body;

        const room = await Room.findById(id);
        if (!room || room.type !== 'group') {
            return res.status(404).json({ error: 'Nhóm không tồn tại' });
        }

        // Chỉ admin mới được cập nhật
        const currentMember = room.members.find(m => m.user.toString() === req.user._id.toString());
        if (!currentMember || currentMember.role !== 'admin') {
            return res.status(403).json({ error: 'Chỉ admin mới có quyền chỉnh sửa' });
        }

        // Cập nhật các trường được gửi lên
        if (name !== undefined) room.name = name.trim();
        if (description !== undefined) room.description = description.trim();
        if (groupAvatar !== undefined) room.groupAvatar = groupAvatar;
        if (groupBackground !== undefined) room.groupBackground = groupBackground;

        await room.save();

        const populated = await room.populate('members.user', 'username avatar status preferredLanguage preferredLanguageLabel');

        // Broadcast cập nhật realtime cho tất cả thành viên đang online
        const io = req.app.get('io');
        if (io) {
            io.to(id).emit('room:settings-updated', {
                roomId: id,
                name: room.name,
                description: room.description,
                groupAvatar: room.groupAvatar,
                groupBackground: room.groupBackground,
            });
        }

        res.json({ room: populated });
    } catch (error) {
        next(error);
    }
};
