const Room = require('../models/Room');
const TopicRoom = require('../models/TopicRoom');

const normalizeTags = (tags) => {
    if (!tags) return [];
    if (Array.isArray(tags)) return tags.map((item) => String(item).trim()).filter(Boolean);
    if (typeof tags === 'string') {
        return tags
            .split(',')
            .map((item) => item.trim())
            .filter(Boolean);
    }
    return [];
};

const parsePagination = (query) => {
    const page = Math.max(parseInt(query.page, 10) || 1, 1);
    const limit = Math.min(Math.max(parseInt(query.limit, 10) || 20, 1), 50);
    return { page, limit, skip: (page - 1) * limit };
};

exports.createTopic = async (req, res, next) => {
    try {
        const { title, description, category, tags, maxMembers, isPublic } = req.body;

        if (!title || !title.trim()) {
            return res.status(400).json({ error: 'Tiêu đề phòng chủ đề là bắt buộc' });
        }
        if (!category) {
            return res.status(400).json({ error: 'category là bắt buộc' });
        }

        const room = await Room.create({
            name: title.trim(),
            description: (description || '').trim(),
            type: 'topic',
            members: [{ user: req.user._id, role: 'admin' }],
        });

        const topic = await TopicRoom.create({
            room: room._id,
            title: title.trim(),
            description: (description || '').trim(),
            category,
            tags: normalizeTags(tags),
            creator: req.user._id,
            maxMembers: Number(maxMembers) > 1 ? Number(maxMembers) : 50,
            isPublic: isPublic !== false,
            isActive: true,
            memberCount: 1,
        });

        const populated = await TopicRoom.findById(topic._id)
            .populate('creator', 'username avatar googlePicture')
            .populate({
                path: 'room',
                populate: { path: 'members.user', select: 'username avatar googlePicture status' },
            });

        res.status(201).json({ topic: populated });
    } catch (error) {
        next(error);
    }
};

exports.getTopics = async (req, res, next) => {
    try {
        const { category, q } = req.query;
        const { page, limit, skip } = parsePagination(req.query);

        const filter = { isActive: true, isPublic: true };
        if (category) filter.category = category;
        if (q && q.trim()) {
            const rx = new RegExp(q.trim(), 'i');
            filter.$or = [
                { title: rx },
                { description: rx },
                { tags: rx },
            ];
        }

        const [total, topics] = await Promise.all([
            TopicRoom.countDocuments(filter),
            TopicRoom.find(filter)
                .populate('creator', 'username avatar googlePicture')
                .populate({ path: 'room', select: 'name type members description groupAvatar updatedAt' })
                .sort({ memberCount: -1, updatedAt: -1 })
                .skip(skip)
                .limit(limit)
                .lean(),
        ]);

        const roomIds = topics.map((item) => item.room?._id).filter(Boolean);
        const joinedRooms = await Room.find({
            _id: { $in: roomIds },
            'members.user': req.user._id,
        }).select('_id').lean();
        const joinedSet = new Set(joinedRooms.map((item) => item._id.toString()));

        const result = topics.map((item) => ({
            ...item,
            isJoined: item.room?._id ? joinedSet.has(item.room._id.toString()) : false,
        }));

        res.json({ topics: result, page, limit, total });
    } catch (error) {
        next(error);
    }
};

exports.getTopicById = async (req, res, next) => {
    try {
        const topic = await TopicRoom.findById(req.params.id)
            .populate('creator', 'username avatar googlePicture')
            .populate({
                path: 'room',
                populate: { path: 'members.user', select: 'username avatar googlePicture status preferredLanguage preferredLanguageLabel' },
            });

        if (!topic || !topic.isActive) {
            return res.status(404).json({ error: 'Phòng chủ đề không tồn tại' });
        }

        const isJoined = topic.room?.members?.some(
            (member) => member.user?._id?.toString() === req.user._id.toString()
        );

        res.json({ topic, isJoined: !!isJoined });
    } catch (error) {
        next(error);
    }
};

exports.joinTopic = async (req, res, next) => {
    try {
        const topic = await TopicRoom.findById(req.params.id);
        if (!topic || !topic.isActive) {
            return res.status(404).json({ error: 'Phòng chủ đề không tồn tại' });
        }

        const room = await Room.findById(topic.room);
        if (!room) {
            return res.status(404).json({ error: 'Room của chủ đề không tồn tại' });
        }

        const alreadyMember = room.members.some((item) => item.user.toString() === req.user._id.toString());
        if (alreadyMember) {
            return res.json({ message: 'Bạn đã tham gia phòng này', roomId: room._id, alreadyJoined: true });
        }

        if (room.members.length >= topic.maxMembers) {
            return res.status(400).json({ error: 'Phòng chủ đề đã đủ số lượng thành viên' });
        }

        room.members.push({ user: req.user._id, role: 'member' });
        await room.save();

        topic.memberCount = room.members.length;
        await topic.save();

        res.json({ message: 'Tham gia phòng thành công', roomId: room._id, topicId: topic._id });
    } catch (error) {
        next(error);
    }
};

exports.leaveTopic = async (req, res, next) => {
    try {
        const topic = await TopicRoom.findById(req.params.id);
        if (!topic) return res.status(404).json({ error: 'Phòng chủ đề không tồn tại' });

        const room = await Room.findById(topic.room);
        if (!room) {
            await TopicRoom.findByIdAndDelete(topic._id);
            return res.status(404).json({ error: 'Room của chủ đề không tồn tại' });
        }

        const leavingMember = room.members.find((item) => item.user.toString() === req.user._id.toString());
        if (!leavingMember) {
            return res.status(403).json({ error: 'Bạn chưa tham gia phòng này' });
        }

        room.members = room.members.filter((item) => item.user.toString() !== req.user._id.toString());

        if (leavingMember.role === 'admin' && room.members.length > 0) {
            room.members[0].role = 'admin';
        }

        if (room.members.length === 0) {
            await Room.findByIdAndDelete(room._id);
            await TopicRoom.findByIdAndDelete(topic._id);
            return res.json({ message: 'Đã rời phòng, phòng chủ đề đã được đóng do không còn thành viên' });
        }

        await room.save();
        topic.memberCount = room.members.length;
        await topic.save();

        res.json({ message: 'Đã rời phòng chủ đề', roomId: room._id, topicId: topic._id });
    } catch (error) {
        next(error);
    }
};

exports.getMyTopics = async (req, res, next) => {
    try {
        const joinedRooms = await Room.find({ type: 'topic', 'members.user': req.user._id }).select('_id').lean();
        const roomIds = joinedRooms.map((item) => item._id);

        const topics = await TopicRoom.find({ room: { $in: roomIds }, isActive: true })
            .populate('creator', 'username avatar googlePicture')
            .populate({ path: 'room', select: 'name type members description groupAvatar updatedAt' })
            .sort({ updatedAt: -1 })
            .lean();

        res.json({ topics });
    } catch (error) {
        next(error);
    }
};
