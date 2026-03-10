const { User } = require('../models/User');
const Report = require('../models/Report');

// ─── Block user ──────────────────────────────────────────────────────
exports.blockUser = async (req, res, next) => {
    try {
        const { userId } = req.params;
        const currentUserId = req.user._id;

        if (userId === currentUserId.toString()) {
            return res.status(400).json({ error: 'Không thể tự chặn chính mình' });
        }

        const targetUser = await User.findById(userId);
        if (!targetUser) {
            return res.status(404).json({ error: 'User không tồn tại' });
        }

        const currentUser = await User.findById(currentUserId);
        const alreadyBlocked = currentUser.blockedUsers.some(
            uid => uid.toString() === userId
        );

        if (alreadyBlocked) {
            return res.status(409).json({ error: 'Đã chặn user này rồi' });
        }

        currentUser.blockedUsers.push(userId);
        await currentUser.save();

        // Emit realtime block notification to the blocked user
        const io = req.app.get('io');
        if (targetUser.socketId) {
            io.to(targetUser.socketId).emit('user:block-updated', {
                blockedBy: currentUserId.toString(),
                action: 'block',
            });
        }

        res.json({ message: 'Đã chặn user', blockedUsers: currentUser.blockedUsers });
    } catch (error) {
        next(error);
    }
};

// ─── Unblock user ────────────────────────────────────────────────────
exports.unblockUser = async (req, res, next) => {
    try {
        const { userId } = req.params;
        const currentUserId = req.user._id;

        const currentUser = await User.findById(currentUserId);
        const isBlocked = currentUser.blockedUsers.some(
            uid => uid.toString() === userId
        );

        if (!isBlocked) {
            return res.status(400).json({ error: 'User này chưa bị chặn' });
        }

        currentUser.blockedUsers = currentUser.blockedUsers.filter(
            uid => uid.toString() !== userId
        );
        await currentUser.save();

        // Emit realtime unblock notification to the unblocked user
        const io = req.app.get('io');
        const targetUser = await User.findById(userId).select('socketId').lean();
        if (targetUser?.socketId) {
            io.to(targetUser.socketId).emit('user:block-updated', {
                blockedBy: currentUserId.toString(),
                action: 'unblock',
            });
        }

        res.json({ message: 'Đã bỏ chặn', blockedUsers: currentUser.blockedUsers });
    } catch (error) {
        next(error);
    }
};

// ─── Lấy danh sách blocked users ────────────────────────────────────
exports.getBlockedUsers = async (req, res, next) => {
    try {
        const currentUser = await User.findById(req.user._id)
            .populate('blockedUsers', 'username avatar googlePicture');

        res.json({ blockedUsers: currentUser.blockedUsers });
    } catch (error) {
        next(error);
    }
};

// ─── Gửi báo cáo ────────────────────────────────────────────────────
exports.reportUser = async (req, res, next) => {
    try {
        const { reportedUserId, reason, description, roomId } = req.body;
        const reporterId = req.user._id;

        if (reportedUserId === reporterId.toString()) {
            return res.status(400).json({ error: 'Không thể báo cáo chính mình' });
        }

        const VALID_REASONS = [
            'spam', 'harassment', 'hate_speech', 'violence',
            'inappropriate_content', 'impersonation', 'other',
        ];
        if (!reason || !VALID_REASONS.includes(reason)) {
            return res.status(400).json({ error: 'Lý do không hợp lệ' });
        }

        const targetUser = await User.findById(reportedUserId);
        if (!targetUser) {
            return res.status(404).json({ error: 'User không tồn tại' });
        }

        const report = await Report.create({
            reporter: reporterId,
            reportedUser: reportedUserId,
            room: roomId || null,
            reason,
            description: description || '',
        });

        res.status(201).json({ message: 'Báo cáo đã được gửi', report });
    } catch (error) {
        next(error);
    }
};
