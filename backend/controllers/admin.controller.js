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

// ─── Analytics đã bị xóa ──────────────────────────────────────────────

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

        if (req.params.id === req.user._id.toString() && role && role !== req.user.role) {
            return res.status(400).json({ error: 'Không thể tự thay đổi quyền của chính mình' });
        }

        // Sub-admin cannot change roles
        if (req.user.role === 'sub_admin' && role !== undefined) {
            return res.status(403).json({ error: 'Sub Admin không có quyền thay đổi vai trò' });
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
        user.status = 'banned';
        user.is_locked = true;
        user.lock_until = null;
        await user.save();

        const io = req.io || req.app.get('socketio') || req.app.get('io');
        if (io && user.socketId) {
            io.to(user.socketId).emit('account:banned', { message: 'Tài khoản đã bị khóa bởi Admin' });
        }
        if (io) {
            io.to(user._id.toString()).emit('user:status-updated', {
                accountStatus: 'banned',
                lockUntil: null,
                isLocked: true,
            });
        }

        await logAction(req.user._id, 'ban_user', user._id, `Banned ${user.username}`, req.ip);
        return res.status(200).json({ message: `Đã ban user ${user.username}`, user });
    } catch (error) {
        console.error('Lock/Ban Error:', error.message);
        return res.status(500).json({ message: error.message });
    }
};

// ─── Unban user ───────────────────────────────────────────────────────
const unbanUser = async (req, res) => {
    try {
        const user = await User.findById(req.params.id);
        if (!user) return res.status(404).json({ error: 'Không tìm thấy user' });

        user.accountStatus = 'active';
        user.status = 'active';
        user.is_locked = false;
        user.lock_until = null;
        await user.save();

        const io = req.io || req.app.get('socketio') || req.app.get('io');
        if (io) {
            io.to(user._id.toString()).emit('user:status-updated', {
                accountStatus: 'active',
                lockUntil: null,
                isLocked: false,
            });
        }

        await logAction(req.user._id, 'unban_user', user._id, `Unbanned ${user.username}`, req.ip);
        return res.status(200).json({ message: `Đã gỡ ban user ${user.username}`, user });
    } catch (error) {
        console.error('Lock/Ban Error:', error.message);
        return res.status(500).json({ message: error.message });
    }
};

// ─── Temp lock user ───────────────────────────────────────────────────
const lockUser = async (req, res) => {
    try {
        if (req.params.id === req.user._id.toString()) {
            return res.status(400).json({ error: 'Không thể khóa chính mình' });
        }
        const minutes = Number(req.body.minutes ?? req.body.duration);
        if (!Number.isFinite(minutes) || minutes < 0) {
            return res.status(400).json({ error: 'Cần chỉ định thời gian khóa (phút)' });
        }

        const user = await User.findById(req.params.id);
        if (!user) return res.status(404).json({ error: 'Không tìm thấy user' });

        if (minutes === 0) {
            user.accountStatus = 'active';
            user.status = 'active';
            user.is_locked = false;
            user.lock_until = null;
        } else {
            user.accountStatus = 'locked';
            user.status = 'active';
            user.is_locked = true;
            user.lock_until = new Date(Date.now() + minutes * 60000);
        }
        await user.save();

        const io = req.io || req.app.get('socketio') || req.app.get('io');
        if (io) {
            io.to(user._id.toString()).emit('user:status-updated', {
                accountStatus: user.accountStatus,
                lockUntil: user.lock_until,
                isLocked: user.is_locked,
            });
            if (minutes > 0) {
                io.to(user._id.toString()).emit('account:locked', {
                    message: `Tài khoản bị khóa tạm thời ${minutes} phút`,
                    lockUntil: user.lock_until,
                });
            }
        }

        await logAction(
            req.user._id,
            minutes === 0 ? 'unlock_user' : 'lock_user',
            user._id,
            minutes === 0
                ? `Unlocked ${user.username} immediately`
                : `Locked ${user.username} for ${minutes} minutes`,
            req.ip
        );

        if (minutes === 0) {
            return res.status(200).json({ message: `Đã mở khóa ngay cho user ${user.username}`, user });
        }

        return res.status(200).json({ message: `Đã khóa user ${user.username} trong ${minutes} phút`, user });
    } catch (error) {
        console.error('Lock/Ban Error:', error.message);
        return res.status(500).json({ message: error.message });
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

// ─── Mute / Unmute đã bị xóa ────────────────────────────────────────

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

        // If maintenance mode is being turned ON, force disconnect all non-admin users
        if (updates.maintenanceMode === true) {
            const io = req.app.get('io');
            if (io) {
                const sockets = await io.fetchSockets();
                for (const s of sockets) {
                    if (s.user && !['sub_admin', 'super_admin'].includes(s.user.role)) {
                        s.emit('system:maintenance', { message: 'Hệ thống đang bảo trì. Bạn sẽ bị đăng xuất.' });
                        s.disconnect(true);
                    }
                }
            }
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
    getUsers, getStats, getUserById, updateUser, deleteUser, toggleVerified,
    banUser, unbanUser, lockUser, resetPassword,
    getReports, resolveReport,
    getBadWords, addBadWord, removeBadWord,
    getSystemConfig, updateSystemConfig,
    getAdminLogs,
};
