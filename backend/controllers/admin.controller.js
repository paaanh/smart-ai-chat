const { User } = require('../models/User');
const Room = require('../models/Room');
const Message = require('../models/Message');

// ─── Lấy danh sách users (có phân trang + tìm kiếm) ─────────────────
const getUsers = async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 20;
        const search = req.query.search || '';
        const skip = (page - 1) * limit;

        const filter = {};
        if (search) {
            filter.$or = [
                { username: { $regex: search, $options: 'i' } },
                { email: { $regex: search, $options: 'i' } },
                { phoneNumber: { $regex: search, $options: 'i' } },
            ];
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
            pagination: {
                page,
                limit,
                total,
                totalPages: Math.ceil(total / limit),
            },
        });
    } catch (error) {
        res.status(500).json({ error: 'Lỗi khi lấy danh sách users' });
    }
};

// ─── Lấy thống kê tổng quan ──────────────────────────────────────────
const getStats = async (req, res) => {
    try {
        const [totalUsers, verifiedUsers, onlineUsers, totalRooms, totalMessages] = await Promise.all([
            User.countDocuments(),
            User.countDocuments({ isVerified: true }),
            User.countDocuments({ status: 'online' }),
            Room.countDocuments(),
            Message.countDocuments(),
        ]);

        res.json({
            totalUsers,
            verifiedUsers,
            onlineUsers,
            totalRooms,
            totalMessages,
        });
    } catch (error) {
        res.status(500).json({ error: 'Lỗi khi lấy thống kê' });
    }
};

// ─── Lấy chi tiết 1 user ─────────────────────────────────────────────
const getUserById = async (req, res) => {
    try {
        const user = await User.findById(req.params.id).select('-password');
        if (!user) {
            return res.status(404).json({ error: 'Không tìm thấy user' });
        }
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
        if (!user) {
            return res.status(404).json({ error: 'Không tìm thấy user' });
        }

        // Không cho phép admin tự hạ quyền mình
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
        res.json(user);
    } catch (error) {
        if (error.code === 11000) {
            return res.status(400).json({ error: 'Username hoặc email đã tồn tại' });
        }
        res.status(500).json({ error: 'Lỗi khi cập nhật user' });
    }
};

// ─── Xóa user ─────────────────────────────────────────────────────────
const deleteUser = async (req, res) => {
    try {
        // Không cho xóa chính mình
        if (req.params.id === req.user._id.toString()) {
            return res.status(400).json({ error: 'Không thể xóa chính mình' });
        }

        const user = await User.findById(req.params.id);
        if (!user) {
            return res.status(404).json({ error: 'Không tìm thấy user' });
        }

        await User.findByIdAndDelete(req.params.id);
        res.json({ message: 'Đã xóa user thành công' });
    } catch (error) {
        res.status(500).json({ error: 'Lỗi khi xóa user' });
    }
};

// ─── Toggle trạng thái xác thực ───────────────────────────────────────
const toggleVerified = async (req, res) => {
    try {
        const user = await User.findById(req.params.id);
        if (!user) {
            return res.status(404).json({ error: 'Không tìm thấy user' });
        }

        user.isVerified = !user.isVerified;
        await user.save();
        res.json(user);
    } catch (error) {
        res.status(500).json({ error: 'Lỗi khi thay đổi trạng thái xác thực' });
    }
};

module.exports = {
    getUsers,
    getStats,
    getUserById,
    updateUser,
    deleteUser,
    toggleVerified,
};
