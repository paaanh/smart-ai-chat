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

        // Add expert to room
        room.members.push({ user: req.user._id, role: 'admin' });
        await room.save();

        // Update session
        session.expert = req.user._id;
        session.aiActive = false; // Turn off AI when expert joins
        await session.save();

        const io = req.app.get('io');
        if (io) {
            io.to(room._id.toString()).emit('counseling:expert-joined', {
                expertId: req.user._id,
                sessionId: session._id,
                roomId: room._id
            });
        }

        res.json({ message: 'Đã tham gia tư vấn', session, roomId: room._id });
    } catch (error) {
        next(error);
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
