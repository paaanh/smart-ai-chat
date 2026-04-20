const CounselingSession = require('../models/CounselingSession');
const { generateCounselingResponse } = require('../services/ai.service');

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

        const session = await CounselingSession.create({
            userId: req.user._id,
            category,
            title: (title || '').trim(),
            isAnonymous: !!isAnonymous,
            messages: [
                {
                    role: 'system',
                    content: 'Chào bạn, mình là trợ lý tư vấn AI. Bạn có thể chia sẻ điều bạn đang cần hỗ trợ.',
                    timestamp: new Date(),
                },
            ],
        });

        res.status(201).json({ session });
    } catch (error) {
        next(error);
    }
};

exports.getSessions = async (req, res, next) => {
    try {
        const sessions = await CounselingSession.find({ userId: req.user._id })
            .sort({ updatedAt: -1 })
            .lean();

        const data = sessions.map((item) => {
            const lastMessage = item.messages?.[item.messages.length - 1] || null;
            return {
                _id: item._id,
                category: item.category,
                title: item.title || 'Phiên tư vấn',
                status: item.status,
                isAnonymous: item.isAnonymous,
                messageCount: item.messages?.length || 0,
                lastMessage,
                createdAt: item.createdAt,
                updatedAt: item.updatedAt,
            };
        });

        res.json({ sessions: data });
    } catch (error) {
        next(error);
    }
};

exports.getSessionById = async (req, res, next) => {
    try {
        const session = await CounselingSession.findById(req.params.id);
        if (!session) return res.status(404).json({ error: 'Phiên tư vấn không tồn tại' });

        if (session.userId.toString() !== req.user._id.toString()) {
            return res.status(403).json({ error: 'Không có quyền truy cập phiên này' });
        }

        res.json({ session });
    } catch (error) {
        next(error);
    }
};

exports.sendMessage = async (req, res, next) => {
    try {
        const { content } = req.body;
        if (!content || !content.trim()) {
            return res.status(400).json({ error: 'Nội dung không được để trống' });
        }

        const session = await CounselingSession.findById(req.params.id);
        if (!session) return res.status(404).json({ error: 'Phiên tư vấn không tồn tại' });

        if (session.userId.toString() !== req.user._id.toString()) {
            return res.status(403).json({ error: 'Không có quyền truy cập phiên này' });
        }

        if (session.status === 'closed') {
            return res.status(400).json({ error: 'Phiên tư vấn đã đóng' });
        }

        const userMessage = {
            role: 'user',
            content: content.trim(),
            timestamp: new Date(),
        };
        session.messages.push(userMessage);

        if (!session.title) {
            session.title = content.trim().slice(0, 60);
        }

        const aiReply = await generateCounselingResponse(content.trim(), session.category, session.messages);
        const assistantMessage = {
            role: 'assistant',
            content: aiReply,
            timestamp: new Date(),
        };
        session.messages.push(assistantMessage);

        await session.save();

        res.json({
            message: assistantMessage,
            session,
        });
    } catch (error) {
        next(error);
    }
};

exports.closeSession = async (req, res, next) => {
    try {
        const session = await CounselingSession.findById(req.params.id);
        if (!session) return res.status(404).json({ error: 'Phiên tư vấn không tồn tại' });

        if (session.userId.toString() !== req.user._id.toString()) {
            return res.status(403).json({ error: 'Không có quyền truy cập phiên này' });
        }

        session.status = 'closed';
        await session.save();

        res.json({ message: 'Đã đóng phiên tư vấn', session });
    } catch (error) {
        next(error);
    }
};
