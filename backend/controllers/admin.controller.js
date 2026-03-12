const { User } = require('../models/User');
const Room = require('../models/Room');
const Message = require('../models/Message');
const Report = require('../models/Report');
const BadWord = require('../models/BadWord');
const AdminLog = require('../models/AdminLog');
const SystemConfig = require('../models/SystemConfig');
const bcrypt = require('bcryptjs');
const { clearCache } = require('../utils/badWordFilter');

// ── Helper: Log admin action ──────────────────────────────────────────
const logAction = async (adminId, action, targetUserId, details, ip) => {
    try {
        await AdminLog.create({ admin: adminId, action, targetUser: targetUserId, details, ip: ip || '' });
    } catch (err) {
        console.error('[AdminLog] Failed:', err.message);
    }
};

// ─── Lấy danh sách users (có phân trang + tìm kiếm + filter) ─────────
const getUsers = async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 20;
        const search = req.query.search || '';
        const statusFilter = req.query.accountStatus || '';
        const skip = (page - 1) * limit;

        const filter = {};
        if (search) {
            filter.$or = [
                { username: { $regex: search, $options: 'i' } },
                { email: { $regex: search, $options: 'i' } },
                { phoneNumber: { $regex: search, $options: 'i' } },
            ];
        }
        if (statusFilter) {
            filter.accountStatus = statusFilter;
        }

        const [users, total] = await Promise.all([
            User.find(filter)
                .select('-password')
                .sort({ createdAt: -1 })
                .skip(skip)
                .limit(limit),
            User.countDocuments(filter),
        ]);

        res.json({
            users,
            pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
        });
    } catch (error) {
        res.status(500).json({ error: 'Lỗi khi lấy danh sách users' });
    }
};

// ─── Lấy thống kê tổng quan ──────────────────────────────────────────
const getStats = async (req, res) => {
    try {
        const [totalUsers, verifiedUsers, onlineUsers, bannedUsers, totalRooms, totalMessages, totalReports, pendingReports] = await Promise.all([
            User.countDocuments(),
            User.countDocuments({ isVerified: true }),
            User.countDocuments({ status: 'online' }),
            User.countDocuments({ accountStatus: 'banned' }),
            Room.countDocuments(),
            Message.countDocuments(),
            Report.countDocuments(),
            Report.countDocuments({ status: 'pending' }),
        ]);

        res.json({
            totalUsers, verifiedUsers, onlineUsers, bannedUsers,
            totalRooms, totalMessages, totalReports, pendingReports,
        });
    } catch (error) {
        res.status(500).json({ error: 'Lỗi khi lấy thống kê' });
    }
};

// ─── Analytics: messages per day (last 30 days) + user growth ────────
const getAnalytics = async (req, res) => {
    try {
        const days = parseInt(req.query.days) || 30;
        const startDate = new Date();
        startDate.setDate(startDate.getDate() - days);

        const [messagesPerDay, userGrowth] = await Promise.all([
            Message.aggregate([
                { $match: { createdAt: { $gte: startDate } } },
                { $group: { _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } }, count: { $sum: 1 } } },
                { $sort: { _id: 1 } },
            ]),
            User.aggregate([
                { $match: { createdAt: { $gte: startDate } } },
                { $group: { _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } }, count: { $sum: 1 } } },
                { $sort: { _id: 1 } },
            ]),
        ]);

        res.json({ messagesPerDay, userGrowth });
    } catch (error) {
        res.status(500).json({ error: 'Lỗi khi lấy analytics' });
    }
};

// ─── Lấy chi tiết 1 user ─────────────────────────────────────────────
const getUserById = async (req, res) => {
    try {
        const user = await User.findById(req.params.id).select('-password');
        if (!user) return res.status(404).json({ error: 'Không tìm thấy user' });
        res.json(user);
    } catch (error) {
        res.status(500).json({ error: 'Lỗi khi lấy thông tin user' });
    }
};

// ─── Cập nhật user (admin) ────────────────────────────────────────────
const updateUser = async (req, res) => {
    try {
        const { username, email, phoneNumber, role, isVerified, bio } = req.body;
        const user = await User.findById(req.params.id);
        if (!user) return res.status(404).json({ error: 'Không tìm thấy user' });

        if (req.params.id === req.user._id.toString() && role && role !== 'admin') {
            return res.status(400).json({ error: 'Không thể tự hạ quyền admin của chính mình' });
        }

        if (username !== undefined) user.username = username;
        if (email !== undefined) user.email = email;
        if (phoneNumber !== undefined) user.phoneNumber = phoneNumber;
        if (role !== undefined) user.role = role;
        if (isVerified !== undefined) user.isVerified = isVerified;
        if (bio !== undefined) user.bio = bio;

        await user.save();
        await logAction(req.user._id, 'update_user', user._id, `Updated fields for ${user.username}`, req.ip);
        res.json(user);
    } catch (error) {
        if (error.code === 11000) return res.status(400).json({ error: 'Username hoặc email đã tồn tại' });
        res.status(500).json({ error: 'Lỗi khi cập nhật user' });
    }
};

// ─── Xóa user ─────────────────────────────────────────────────────────
const deleteUser = async (req, res) => {
    try {
        if (req.params.id === req.user._id.toString()) {
            return res.status(400).json({ error: 'Không thể xóa chính mình' });
        }
        const user = await User.findById(req.params.id);
        if (!user) return res.status(404).json({ error: 'Không tìm thấy user' });

        await User.findByIdAndDelete(req.params.id);
        await logAction(req.user._id, 'delete_user', user._id, `Deleted user ${user.username}`, req.ip);
        res.json({ message: 'Đã xóa user thành công' });
    } catch (error) {
        res.status(500).json({ error: 'Lỗi khi xóa user' });
    }
};

// ─── Toggle trạng thái xác thực ───────────────────────────────────────
const toggleVerified = async (req, res) => {
    try {
        const user = await User.findById(req.params.id);
        if (!user) return res.status(404).json({ error: 'Không tìm thấy user' });

        user.isVerified = !user.isVerified;
        await user.save();
        await logAction(req.user._id, 'toggle_verified', user._id, `Set verified=${user.isVerified}`, req.ip);
        res.json(user);
    } catch (error) {
        res.status(500).json({ error: 'Lỗi khi thay đổi trạng thái xác thực' });
    }
};

// ─── Ban user ─────────────────────────────────────────────────────────
const banUser = async (req, res) => {
    try {
        if (req.params.id === req.user._id.toString()) {
            return res.status(400).json({ error: 'Không thể ban chính mình' });
        }
        const user = await User.findById(req.params.id);
        if (!user) return res.status(404).json({ error: 'Không tìm thấy user' });

        user.accountStatus = 'banned';
        await user.save();

        // Disconnect user's socket if online
        const io = req.app.get('io');
        if (user.socketId && io) {
            io.to(user.socketId).emit('account:banned', { message: 'Tài khoản đã bị khóa bởi Admin' });
        }

        await logAction(req.user._id, 'ban_user', user._id, `Banned ${user.username}`, req.ip);
        res.json({ message: `Đã ban user ${user.username}`, user });
    } catch (error) {
        res.status(500).json({ error: 'Lỗi khi ban user' });
    }
};

// ─── Unban user ───────────────────────────────────────────────────────
const unbanUser = async (req, res) => {
    try {
        const user = await User.findById(req.params.id);
        if (!user) return res.status(404).json({ error: 'Không tìm thấy user' });

        user.accountStatus = 'active';
        user.lockUntil = null;
        await user.save();

        await logAction(req.user._id, 'unban_user', user._id, `Unbanned ${user.username}`, req.ip);
        res.json({ message: `Đã gỡ ban user ${user.username}`, user });
    } catch (error) {
        res.status(500).json({ error: 'Lỗi khi unban user' });
    }
};

// ─── Temp lock user ───────────────────────────────────────────────────
const lockUser = async (req, res) => {
    try {
        if (req.params.id === req.user._id.toString()) {
            return res.status(400).json({ error: 'Không thể khóa chính mình' });
        }
        const { duration } = req.body; // duration in minutes
        if (!duration || duration < 1) {
            return res.status(400).json({ error: 'Cần chỉ định thời gian khóa (phút)' });
        }

        const user = await User.findById(req.params.id);
        if (!user) return res.status(404).json({ error: 'Không tìm thấy user' });

        user.accountStatus = 'locked';
        user.lockUntil = new Date(Date.now() + duration * 60000);
        await user.save();

        const io = req.app.get('io');
        if (user.socketId && io) {
            io.to(user.socketId).emit('account:locked', {
                message: `Tài khoản bị khóa tạm thời ${duration} phút`,
                lockUntil: user.lockUntil,
            });
        }

        await logAction(req.user._id, 'lock_user', user._id, `Locked ${user.username} for ${duration} minutes`, req.ip);
        res.json({ message: `Đã khóa user ${user.username} trong ${duration} phút`, user });
    } catch (error) {
        res.status(500).json({ error: 'Lỗi khi khóa user' });
    }
};

// ─── Reset Password ──────────────────────────────────────────────────
const resetPassword = async (req, res) => {
    try {
        const { newPassword } = req.body;
        if (!newPassword || newPassword.length < 6) {
            return res.status(400).json({ error: 'Mật khẩu mới phải có ít nhất 6 ký tự' });
        }

        const user = await User.findById(req.params.id).select('+password');
        if (!user) return res.status(404).json({ error: 'Không tìm thấy user' });

        user.password = newPassword; // Will be hashed by pre-save hook
        await user.save();

        await logAction(req.user._id, 'reset_password', user._id, `Reset password for ${user.username}`, req.ip);
        res.json({ message: `Đã reset mật khẩu cho ${user.username}` });
    } catch (error) {
        res.status(500).json({ error: 'Lỗi khi reset mật khẩu' });
    }
};

// ─── Mute user ────────────────────────────────────────────────────────
const muteUser = async (req, res) => {
    try {
        const { duration } = req.body; // minutes, 0 = permanent
        const user = await User.findById(req.params.id);
        if (!user) return res.status(404).json({ error: 'Không tìm thấy user' });

        user.isMuted = true;
        user.muteExpires = duration ? new Date(Date.now() + duration * 60000) : null;
        await user.save();

        const io = req.app.get('io');
        if (user.socketId && io) {
            io.to(user.socketId).emit('account:muted', {
                message: duration ? `Bạn bị cấm gửi tin nhắn trong ${duration} phút` : 'Bạn đã bị cấm gửi tin nhắn',
                muteExpires: user.muteExpires,
            });
        }

        await logAction(req.user._id, 'mute_user', user._id, `Muted ${user.username} ${duration ? `for ${duration} min` : 'permanently'}`, req.ip);
        res.json({ message: `Đã mute ${user.username}`, user });
    } catch (error) {
        res.status(500).json({ error: 'Lỗi khi mute user' });
    }
};

// ─── Unmute user ──────────────────────────────────────────────────────
const unmuteUser = async (req, res) => {
    try {
        const user = await User.findById(req.params.id);
        if (!user) return res.status(404).json({ error: 'Không tìm thấy user' });

        user.isMuted = false;
        user.muteExpires = null;
        await user.save();

        const io = req.app.get('io');
        if (user.socketId && io) {
            io.to(user.socketId).emit('account:unmuted', { message: 'Bạn đã được gỡ cấm gửi tin nhắn' });
        }

        await logAction(req.user._id, 'unmute_user', user._id, `Unmuted ${user.username}`, req.ip);
        res.json({ message: `Đã unmute ${user.username}`, user });
    } catch (error) {
        res.status(500).json({ error: 'Lỗi khi unmute user' });
    }
};

// ═══════════════════════════════════════════════════════════════════
// ─── Reports ──────────────────────────────────────────────────────
// ═══════════════════════════════════════════════════════════════════

const getReports = async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 20;
        const statusFilter = req.query.status || '';
        const skip = (page - 1) * limit;

        const filter = {};
        if (statusFilter) filter.status = statusFilter;

        const [reports, total] = await Promise.all([
            Report.find(filter)
                .populate('reporter', 'username avatar')
                .populate('reportedUser', 'username avatar email accountStatus')
                .populate('resolvedBy', 'username')
                .sort({ createdAt: -1 })
                .skip(skip)
                .limit(limit),
            Report.countDocuments(filter),
        ]);

        res.json({
            reports,
            pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
        });
    } catch (error) {
        res.status(500).json({ error: 'Lỗi khi lấy reports' });
    }
};

const resolveReport = async (req, res) => {
    try {
        const { status, adminNote } = req.body;
        if (!['resolved', 'dismissed'].includes(status)) {
            return res.status(400).json({ error: 'Status phải là resolved hoặc dismissed' });
        }

        const report = await Report.findById(req.params.id);
        if (!report) return res.status(404).json({ error: 'Không tìm thấy report' });

        report.status = status;
        report.adminNote = adminNote || '';
        report.resolvedBy = req.user._id;
        report.resolvedAt = new Date();
        await report.save();

        await logAction(req.user._id, status === 'resolved' ? 'resolve_report' : 'dismiss_report', report.reportedUser, `Report ${req.params.id} ${status}`, req.ip);
        res.json(report);
    } catch (error) {
        res.status(500).json({ error: 'Lỗi khi xử lý report' });
    }
};

// ═══════════════════════════════════════════════════════════════════
// ─── Bad Words ────────────────────────────────────────────────────
// ═══════════════════════════════════════════════════════════════════

const getBadWords = async (req, res) => {
    try {
        const words = await BadWord.find().sort({ createdAt: -1 });
        res.json(words);
    } catch (error) {
        res.status(500).json({ error: 'Lỗi khi lấy bad words' });
    }
};

const addBadWord = async (req, res) => {
    try {
        const { word, severity } = req.body;
        if (!word || !word.trim()) return res.status(400).json({ error: 'Từ không được trống' });

        const existing = await BadWord.findOne({ word: word.trim().toLowerCase() });
        if (existing) return res.status(400).json({ error: 'Từ này đã tồn tại' });

        const badWord = await BadWord.create({
            word: word.trim().toLowerCase(),
            severity: severity || 'medium',
            addedBy: req.user._id,
        });

        clearCache();
        await logAction(req.user._id, 'add_bad_word', null, `Added bad word: ${word}`, req.ip);
        res.status(201).json(badWord);
    } catch (error) {
        res.status(500).json({ error: 'Lỗi khi thêm bad word' });
    }
};

const removeBadWord = async (req, res) => {
    try {
        const word = await BadWord.findByIdAndDelete(req.params.id);
        if (!word) return res.status(404).json({ error: 'Không tìm thấy' });

        clearCache();
        await logAction(req.user._id, 'remove_bad_word', null, `Removed bad word: ${word.word}`, req.ip);
        res.json({ message: 'Đã xóa' });
    } catch (error) {
        res.status(500).json({ error: 'Lỗi khi xóa bad word' });
    }
};

// ═══════════════════════════════════════════════════════════════════
// ─── System Config ────────────────────────────────────────────────
// ═══════════════════════════════════════════════════════════════════

const getSystemConfig = async (req, res) => {
    try {
        const configs = await SystemConfig.find().lean();
        const configMap = {};
        for (const c of configs) configMap[c.key] = c.value;

        // Defaults
        const defaults = {
            videoCallEnabled: true,
            fileUploadEnabled: true,
            maxFileSize: 10, // MB
            maintenanceMode: false,
        };
        res.json({ ...defaults, ...configMap });
    } catch (error) {
        res.status(500).json({ error: 'Lỗi khi lấy config' });
    }
};

const updateSystemConfig = async (req, res) => {
    try {
        const updates = req.body; // { key: value, ... }
        const allowed = ['videoCallEnabled', 'fileUploadEnabled', 'maxFileSize', 'maintenanceMode'];

        for (const [key, value] of Object.entries(updates)) {
            if (!allowed.includes(key)) continue;
            await SystemConfig.findOneAndUpdate(
                { key },
                { value, updatedBy: req.user._id },
                { upsert: true, new: true },
            );
        }

        await logAction(req.user._id, 'update_config', null, `Updated config: ${Object.keys(updates).join(', ')}`, req.ip);
        res.json({ message: 'Đã cập nhật config' });
    } catch (error) {
        res.status(500).json({ error: 'Lỗi khi cập nhật config' });
    }
};

// ─── Admin Logs ───────────────────────────────────────────────────────
const getAdminLogs = async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 50;
        const skip = (page - 1) * limit;

        const [logs, total] = await Promise.all([
            AdminLog.find()
                .populate('admin', 'username avatar')
                .populate('targetUser', 'username')
                .sort({ createdAt: -1 })
                .skip(skip)
                .limit(limit),
            AdminLog.countDocuments(),
        ]);

        res.json({
            logs,
            pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
        });
    } catch (error) {
        res.status(500).json({ error: 'Lỗi khi lấy logs' });
    }
};

module.exports = {
    getUsers, getStats, getAnalytics, getUserById, updateUser, deleteUser, toggleVerified,
    banUser, unbanUser, lockUser, resetPassword,
    muteUser, unmuteUser,
    getReports, resolveReport,
    getBadWords, addBadWord, removeBadWord,
    getSystemConfig, updateSystemConfig,
    getAdminLogs,
};
