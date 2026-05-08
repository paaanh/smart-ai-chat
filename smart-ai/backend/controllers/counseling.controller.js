const CounselingSession = require('../models/CounselingSession');
const Room = require('../models/Room');
const Message = require('../models/Message');

const COUNSELING_CATEGORIES = [
    {
        key: 'tam_ly',
        title: 'Tâm lý và sức khỏe tinh thần',
        description: 'Lo âu, căng thẳng, cô đơn, áp lực học tập và công việc.',
    },
    {
        key: 'phap_luat',
        title: 'Pháp luật và quyền lợi cơ bản',
        description: 'Thông tin quyền lợi lao động, bảo hiểm, thủ tục pháp lý cơ bản.',
    },
    {
        key: 'bao_luc_gia_dinh',
        title: 'Hỗ trợ bạo lực gia đình',
        description: 'Nhận diện nguy cơ, kế hoạch an toàn và kết nối hỗ trợ.',
    },
    {
        key: 'suc_khoe',
        title: 'Sức khỏe và dinh dưỡng',
        description: 'Tư vấn sức khỏe phổ thông và chăm sóc hằng ngày.',
    },
    {
        key: 'giao_duc',
        title: 'Giáo dục và hướng nghiệp',
        description: 'Định hướng học tập, kỹ năng và cơ hội nghề nghiệp.',
    },
];

const HOTLINES = [
    { name: 'Bảo vệ trẻ em', phone: '111' },
    { name: 'Cấp cứu y tế', phone: '115' },
    { name: 'Cảnh sát khẩn cấp', phone: '113' },
];

const isValidCategory = (category) => COUNSELING_CATEGORIES.some((item) => item.key === category);

exports.getCategories = async (req, res) => {
    res.json({
        disclaimer: 'AI chỉ mang tính hỗ trợ thông tin, không thay thế chuyên gia y tế hoặc pháp lý.',
        categories: COUNSELING_CATEGORIES,
        hotlines: HOTLINES,
    });
};

exports.createSession = async (req, res, next) => {
    try {
        const { category, title, isAnonymous } = req.body;

        if (!category || !isValidCategory(category)) {
            return res.status(400).json({ error: 'Danh mục tư vấn không hợp lệ' });
        }

        // Idempotency: nếu đã có session active cho user+category này → trả về session hiện tại,
        // tránh tạo trùng do double click hoặc retry network.
        const existing = await CounselingSession.findOne({
            user: req.user._id,
            category,
            status: 'active',
        }).populate('room');
        if (existing) {
            return res.status(200).json({
                session: existing,
                room: existing.room,
                roomId: existing.room?._id || existing.room,
                reused: true,
            });
        }

        const roomName = title ? title.trim() : `Tư vấn: ${COUNSELING_CATEGORIES.find(c => c.key === category).title}`;

        // Create Room
        const room = await Room.create({
            name: roomName,
            type: 'counseling',
            members: [{ user: req.user._id, role: 'admin' }],
        });

        // Create Counseling Session
        const session = await CounselingSession.create({
            room: room._id,
            user: req.user._id,
            category,
            title: roomName,
            isAnonymous: !!isAnonymous,
            aiActive: true,
        });

        // Add welcome message from AI
        const welcomeMessage = await Message.create({
            room: room._id,
            sender: req.user._id,
            type: 'ai-response',
            content: `Chào bạn, mình là trợ lý tư vấn AI chuyên mục ${COUNSELING_CATEGORIES.find(c => c.key === category).title}. Bạn có thể chia sẻ điều bạn đang cần hỗ trợ.`,
            aiMetadata: { isAIResponse: true },
        });

        // Broadcast to experts so their dashboard updates in realtime
        const io = req.app.get('io');
        if (io) {
            const populated = await CounselingSession.findById(session._id)
                .populate('user', 'username avatar googlePicture')
                .populate('room', 'name updatedAt')
                .lean();
            io.emit('counseling:pending-added', { session: populated });
        }

        res.status(201).json({ session, room, roomId: room._id, welcomeMessage });
    } catch (error) {
        next(error);
    }
};

exports.getSessions = async (req, res, next) => {
    try {
        const sessions = await CounselingSession.find({ user: req.user._id })
            .populate('room', 'name type updatedAt')
            .populate('expert', 'username avatar')
            .sort({ updatedAt: -1 })
            .lean();

        res.json({ sessions });
    } catch (error) {
        next(error);
    }
};

exports.getSessionById = async (req, res, next) => {
    try {
        const session = await CounselingSession.findById(req.params.id)
            .populate('room', 'name type')
            .populate('expert', 'username avatar');
            
        if (!session) return res.status(404).json({ error: 'Phiên tư vấn không tồn tại' });

        if (session.user.toString() !== req.user._id.toString() && 
            (!session.expert || session.expert._id.toString() !== req.user._id.toString())) {
            return res.status(403).json({ error: 'Không có quyền truy cập phiên này' });
        }

        res.json({ session });
    } catch (error) {
        next(error);
    }
};

exports.closeSession = async (req, res, next) => {
    try {
        const session = await CounselingSession.findById(req.params.id);
        if (!session) return res.status(404).json({ error: 'Phiên tư vấn không tồn tại' });

        if (session.user.toString() !== req.user._id.toString()) {
            return res.status(403).json({ error: 'Không có quyền truy cập phiên này' });
        }

        session.status = 'closed';
        session.aiActive = false;
        await session.save();

        res.json({ message: 'Đã đóng phiên tư vấn', session });
    } catch (error) {
        next(error);
    }
};

// Expert joins the counseling session
exports.joinExpert = async (req, res, next) => {
    try {
        if (!['expert', 'sub_admin', 'super_admin'].includes(req.user.role)) {
            return res.status(403).json({ error: 'Chỉ chuyên gia mới có quyền nhận phiên tư vấn' });
        }

        const session = await CounselingSession.findById(req.params.id);
        if (!session) return res.status(404).json({ error: 'Phiên tư vấn không tồn tại' });

        if (session.status === 'closed') {
            return res.status(400).json({ error: 'Phiên tư vấn đã đóng' });
        }

        if (session.expert) {
            return res.status(400).json({ error: 'Phiên đã có chuyên gia phụ trách' });
        }

        const room = await Room.findById(session.room);
        if (!room) return res.status(404).json({ error: 'Room không tồn tại' });

        // Add expert to room (idempotent)
        const alreadyMember = room.members.some(m => m.user.toString() === req.user._id.toString());
        if (!alreadyMember) {
            room.members.push({ user: req.user._id, role: 'admin' });
            await room.save();
        }

        // Update session
        session.expert = req.user._id;
        session.aiActive = false;
        await session.save();

        // Re-populate expert info for client
        const populated = await CounselingSession.findById(session._id)
            .populate('expert', 'username avatar googlePicture')
            .populate('user', 'username avatar googlePicture')
            .lean();

        const io = req.app.get('io');
        if (io) {
            // Notify everyone in the counseling room (user + AI listeners)
            io.to(room._id.toString()).emit('counseling:expert-joined', {
                expertId: req.user._id,
                expert: populated.expert,
                sessionId: session._id,
                roomId: room._id,
            });
            // Notify all other experts to remove this session from pending lists
            io.emit('counseling:pending-removed', { sessionId: session._id });

            // System message vào chat counseling
            try {
                const sysMsg = await Message.create({
                    room: room._id,
                    sender: req.user._id,
                    type: 'system',
                    content: `🩺 ${req.user.username} (chuyên gia) đã tham gia phiên tư vấn. AI tự động đã tạm dừng.`,
                });
                const populatedMsg = await Message.findById(sysMsg._id)
                    .populate('sender', 'username avatar googlePicture preferredLanguage preferredBubbleFrame')
                    .lean();
                io.to(room._id.toString()).emit('message:received', { message: populatedMsg });
            } catch (e) { /* non-fatal */ }
        }

        res.json({ message: 'Đã tham gia tư vấn', session: populated, roomId: room._id });
    } catch (error) {
        next(error);
    }
};

// ── Middleware: chỉ cho phép user role 'expert' hoặc admin ──
exports.requireExpert = (req, res, next) => {
    if (!req.user) return res.status(401).json({ error: 'Chưa đăng nhập' });
    if (!['expert', 'sub_admin', 'super_admin'].includes(req.user.role)) {
        return res.status(403).json({ error: 'Chỉ chuyên gia mới có quyền truy cập' });
    }
    next();
};

// Expert dashboard: list sessions chưa có expert phụ trách
exports.listPendingForExpert = async (req, res, next) => {
    try {
        const filter = { expert: null, status: 'active' };
        // Lọc theo chuyên môn nếu user expert có khai báo expertCategories
        const me = req.user;
        if (me.role === 'expert' && Array.isArray(me.expertCategories) && me.expertCategories.length > 0) {
            filter.category = { $in: me.expertCategories };
        }
        const sessions = await CounselingSession.find(filter)
            .populate('user', 'username avatar googlePicture')
            .populate('room', 'name updatedAt')
            .sort({ createdAt: -1 })
            .lean();
        res.json({ sessions });
    } catch (err) {
        next(err);
    }
};

// Expert dashboard: list sessions mà chuyên gia đang phụ trách
exports.listMineForExpert = async (req, res, next) => {
    try {
        const sessions = await CounselingSession.find({ expert: req.user._id })
            .populate('user', 'username avatar googlePicture')
            .populate('room', 'name updatedAt')
            .sort({ updatedAt: -1 })
            .lean();
        res.json({ sessions });
    } catch (err) {
        next(err);
    }
};

// Toggle AI by @aiWeise
exports.toggleAI = async (req, res, next) => {
    try {
        const { active } = req.body;
        const session = await CounselingSession.findById(req.params.id);
        if (!session) return res.status(404).json({ error: 'Phiên tư vấn không tồn tại' });

        session.aiActive = !!active;
        await session.save();

        const io = req.app.get('io');
        if (io) {
            io.to(session.room.toString()).emit('counseling:ai-toggled', {
                aiActive: session.aiActive,
                sessionId: session._id,
                roomId: session.room
            });
        }

        res.json({ session });
    } catch (error) {
        next(error);
    }
};
