const Friendship = require('../models/Friendship');
const { User } = require('../models/User');
const ChatDuration = require('../models/ChatDuration');
const TopicRoom = require('../models/TopicRoom');
const Room = require('../models/Room');

// Helper: emit socket event to a specific user
const emitToUser = async (io, userId, event, data) => {
    const userDoc = await User.findById(userId).select('socketId').lean();
    if (userDoc?.socketId) {
        io.to(userDoc.socketId).emit(event, data);
    }
};

// POST /api/friends/request — Send a friend request
exports.sendRequest = async (req, res, next) => {
    try {
        const requesterId = req.user._id;
        const { recipientId } = req.body;

        if (!recipientId) {
            return res.status(400).json({ error: 'recipientId là bắt buộc' });
        }

        if (requesterId.toString() === recipientId) {
            return res.status(400).json({ error: 'Không thể kết bạn với chính mình' });
        }

        // Check recipient exists
        const recipient = await User.findById(recipientId);
        if (!recipient) {
            return res.status(404).json({ error: 'Người dùng không tồn tại' });
        }

        const existing = await Friendship.findOne({
            $or: [
                { requester: requesterId, recipient: recipientId },
                { requester: recipientId, recipient: requesterId },
            ],
        });

        if (existing) {
            if (existing.status === 'accepted') {
                return res.status(409).json({ error: 'Đã là bạn bè' });
            }
            if (existing.status === 'pending') {
                return res.status(409).json({ error: 'Đã gửi lời mời kết bạn' });
            }
            // If rejected, allow re-request by updating
            existing.requester = requesterId;
            existing.recipient = recipientId;
            existing.status = 'pending';
            await existing.save();
            const populated = await existing.populate('requester recipient', 'username avatar googlePicture status preferredLanguage preferredLanguageLabel');

            // Notify recipient in real-time
            const io = req.app.get('io');
            if (io) {
                await emitToUser(io, recipientId, 'friend:request-received', { friendship: populated });
            }

            return res.json({ friendship: populated });
        }

        // Use findOneAndUpdate with upsert to prevent race conditions creating duplicates
        // We ensure a deterministic order for the query
        const user1 = requesterId.toString() < recipientId.toString() ? requesterId : recipientId;
        const user2 = requesterId.toString() < recipientId.toString() ? recipientId : requesterId;

        // Since we cannot easily use findOneAndUpdate across two fields dynamically without a specific direction, 
        // we handle race conditions by checking unique constraints if we had one. 
        // Since we don't, we'll try a safe create and catch duplicates. But we must ensure it's not duplicating.
        // Actually, we can use a distributed lock or just findOneAndUpdate.
        // Let's create it. If two requests happen concurrently, we'll delete the newer one if a duplicate exists.
        
        let friendship = await Friendship.create({
            requester: requesterId,
            recipient: recipientId,
        });

        // Double check after create
        const duplicateCheck = await Friendship.find({
            $or: [
                { requester: requesterId, recipient: recipientId },
                { requester: recipientId, recipient: requesterId },
            ]
        }).sort({ createdAt: 1 });

        if (duplicateCheck.length > 1) {
            // Keep the first one, delete the rest
            await Friendship.deleteMany({ _id: { $in: duplicateCheck.slice(1).map(f => f._id) } });
            friendship = duplicateCheck[0];
            if (friendship.status === 'pending' && friendship._id.toString() !== duplicateCheck[duplicateCheck.length - 1]._id.toString()) {
                 return res.status(409).json({ error: 'Đã gửi lời mời kết bạn' });
            }
        }

        const populated2 = await friendship.populate('requester recipient', 'username avatar googlePicture status preferredLanguage preferredLanguageLabel');

        // Notify recipient in real-time
        const io = req.app.get('io');
        if (io) {
            await emitToUser(io, recipientId, 'friend:request-received', { friendship: populated2 });
        }

        res.status(201).json({ friendship: populated2 });
    } catch (error) {
        if (error.code === 11000) {
            return res.status(409).json({ error: 'Lời mời kết bạn đã tồn tại' });
        }
        next(error);
    }
};

// PUT /api/friends/:id/accept — Accept a friend request
exports.acceptRequest = async (req, res, next) => {
    try {
        const friendship = await Friendship.findById(req.params.id);
        if (!friendship) {
            return res.status(404).json({ error: 'Lời mời không tồn tại' });
        }

        // Only recipient can accept
        if (friendship.recipient.toString() !== req.user._id.toString()) {
            return res.status(403).json({ error: 'Không có quyền' });
        }

        if (friendship.status !== 'pending') {
            return res.status(400).json({ error: 'Lời mời không ở trạng thái chờ' });
        }

        friendship.status = 'accepted';
        await friendship.save();

        // Auto-create direct room if not existing
        let directRoom = await Room.findOne({
            type: 'direct',
            $and: [
                { 'members.user': friendship.requester },
                { 'members.user': friendship.recipient },
            ],
        });

        if (!directRoom) {
            directRoom = await Room.create({
                type: 'direct',
                members: [
                    { user: friendship.requester, role: 'admin' },
                    { user: friendship.recipient, role: 'member' },
                ],
            });
            console.log(`[Friend Accept REST] Auto-created direct room ${directRoom._id} for ${friendship.requester} <-> ${friendship.recipient}`);
        }

        const populated = await friendship.populate('requester recipient', 'username avatar googlePicture status preferredLanguage preferredLanguageLabel');

        const roomId = directRoom._id;

        // Notify both users in real-time
        const io = req.app.get('io');
        if (io) {
            await emitToUser(io, friendship.requester._id, 'friend:accepted', { friendship: populated, roomId });
            await emitToUser(io, friendship.recipient._id, 'friend:accepted', { friendship: populated, roomId });
        }

        res.json({ friendship: populated, roomId });
    } catch (error) {
        next(error);
    }
};

// PUT /api/friends/:id/reject — Reject a friend request
exports.rejectRequest = async (req, res, next) => {
    try {
        const friendship = await Friendship.findById(req.params.id);
        if (!friendship) {
            return res.status(404).json({ error: 'Lời mời không tồn tại' });
        }

        if (friendship.recipient.toString() !== req.user._id.toString()) {
            return res.status(403).json({ error: 'Không có quyền' });
        }

        friendship.status = 'rejected';
        await friendship.save();

        res.json({ message: 'Đã từ chối lời mời kết bạn' });
    } catch (error) {
        next(error);
    }
};

// DELETE /api/friends/request/:id — Cancel a pending friend request
exports.cancelRequest = async (req, res, next) => {
    try {
        const friendship = await Friendship.findById(req.params.id);
        if (!friendship) {
            return res.status(404).json({ error: 'Lời mời không tồn tại' });
        }

        if (friendship.status !== 'pending') {
            return res.status(400).json({ error: 'Chỉ có thể hủy lời mời đang chờ' });
        }

        const userId = req.user._id.toString();
        const isRequester = friendship.requester.toString() === userId;
        const isRecipient = friendship.recipient.toString() === userId;

        if (!isRequester && !isRecipient) {
            return res.status(403).json({ error: 'Không có quyền' });
        }

        const otherUserId = isRequester
            ? friendship.recipient
            : friendship.requester;

        await Friendship.findByIdAndDelete(req.params.id);

        // Notify the other party in real-time
        const io = req.app.get('io');
        if (io) {
            await emitToUser(io, otherUserId, 'friend:request-cancelled', {
                friendshipId: friendship._id,
            });
        }

        res.json({ message: 'Đã hủy lời mời kết bạn' });
    } catch (error) {
        next(error);
    }
};

// DELETE /api/friends/:id — Unfriend / cancel request
exports.removeFriend = async (req, res, next) => {
    try {
        const friendship = await Friendship.findById(req.params.id);
        if (!friendship) {
            return res.status(404).json({ error: 'Không tìm thấy' });
        }

        const userId = req.user._id.toString();
        if (friendship.requester.toString() !== userId && friendship.recipient.toString() !== userId) {
            return res.status(403).json({ error: 'Không có quyền' });
        }

        const otherUserId = friendship.requester.toString() === userId
            ? friendship.recipient
            : friendship.requester;

        await Friendship.findByIdAndDelete(req.params.id);

        // Notify the other party in real-time
        const io = req.app.get('io');
        if (io) {
            await emitToUser(io, otherUserId, 'friend:removed', {
                friendshipId: friendship._id,
            });
        }

        res.json({ message: 'Đã hủy kết bạn' });
    } catch (error) {
        next(error);
    }
};

// GET /api/friends — Get accepted friends list
exports.getFriends = async (req, res, next) => {
    try {
        const friends = await Friendship.getFriends(req.user._id);
        res.json({ friends });
    } catch (error) {
        next(error);
    }
};

// GET /api/friends/requests — Get pending friend requests received
exports.getRequests = async (req, res, next) => {
    try {
        const requests = await Friendship.getPendingRequests(req.user._id);
        res.json({ requests });
    } catch (error) {
        next(error);
    }
};

// GET /api/friends/sent — Get sent friend requests
exports.getSentRequests = async (req, res, next) => {
    try {
        const requests = await Friendship.getSentRequests(req.user._id);
        res.json({ requests });
    } catch (error) {
        next(error);
    }
};

// GET /api/friends/status/:userId — Check friendship status with a user
exports.getStatus = async (req, res, next) => {
    try {
        const currentUserId = req.user._id;
        const otherUserId = req.params.userId;

        const friendship = await Friendship.findOne({
            $or: [
                { requester: currentUserId, recipient: otherUserId },
                { requester: otherUserId, recipient: currentUserId },
            ],
        });

        if (!friendship) {
            return res.json({ status: 'none', friendshipId: null });
        }

        res.json({
            status: friendship.status,
            friendshipId: friendship._id,
            isRequester: friendship.requester.toString() === currentUserId.toString(),
        });
    } catch (error) {
        next(error);
    }
};

const normalizeText = (value = '') => String(value || '').trim().toLowerCase();

const toSet = (items = []) => new Set((items || []).map((item) => normalizeText(item)).filter(Boolean));

const intersectCount = (leftSet, rightSet) => {
    let count = 0;
    leftSet.forEach((item) => {
        if (rightSet.has(item)) count += 1;
    });
    return count;
};

const buildReasonBadges = ({ sharedHobbiesCount, chatMessages, sharedCategoriesCount, sharedTagsCount }) => {
    const badges = [];
    if (sharedHobbiesCount > 0) badges.push(`${sharedHobbiesCount} sở thích chung`);
    if (chatMessages > 0) badges.push(`Đã chat ${chatMessages} tin`);
    if (sharedCategoriesCount > 0) badges.push(`${sharedCategoriesCount} chủ đề chung`);
    if (sharedTagsCount > 0) badges.push(`${sharedTagsCount} tag chung`);
    return badges;
};

// GET /api/friends/suggestions — topSimilarity + topicAffinity
exports.getSuggestions = async (req, res, next) => {
    try {
        const currentUserId = req.user._id;

        const currentUser = await User.findById(currentUserId)
            .select('hobbies interests preferredLanguage address education blockedUsers')
            .lean();
        if (!currentUser) return res.status(404).json({ error: 'Không tìm thấy người dùng' });

        const excludedUserIds = new Set([currentUserId.toString()]);

        // Exclude users blocked by current user
        (currentUser.blockedUsers || []).forEach((id) => excludedUserIds.add(id.toString()));

        // Exclude users that blocked current user
        const blockedByUsers = await User.find({ blockedUsers: currentUserId }).select('_id').lean();
        blockedByUsers.forEach((item) => excludedUserIds.add(item._id.toString()));

        // Exclude all existing friendship relations (pending/accepted/rejected)
        const relations = await Friendship.find({
            $or: [{ requester: currentUserId }, { recipient: currentUserId }],
        }).lean();
        relations.forEach((item) => {
            const otherId = item.requester.toString() === currentUserId.toString()
                ? item.recipient.toString()
                : item.requester.toString();
            excludedUserIds.add(otherId);
        });

        const candidates = await User.find({
            _id: { $nin: Array.from(excludedUserIds) },
            accountStatus: 'active',
        })
            .select('username avatar googlePicture preferredLanguage preferredLanguageLabel address education hobbies interests')
            .limit(300)
            .lean();

        if (!candidates.length) {
            return res.json({ topSimilarity: [], topicAffinity: [] });
        }

        const candidateIds = new Set(candidates.map((item) => item._id.toString()));

        // Chat interaction map: otherUserId -> totalMessages
        const chatDurations = await ChatDuration.find({ participants: currentUserId })
            .select('participants totalMessages')
            .lean();
        const chatMap = new Map();
        chatDurations.forEach((item) => {
            const others = (item.participants || []).map((p) => p.toString()).filter((id) => id !== currentUserId.toString());
            if (!others.length) return;
            const otherId = others[0];
            chatMap.set(otherId, (chatMap.get(otherId) || 0) + (item.totalMessages || 0));
        });

        // My topic metadata
        const myTopicRooms = await Room.find({ type: 'topic', 'members.user': currentUserId }).select('_id').lean();
        const myRoomIds = myTopicRooms.map((item) => item._id);
        const myTopicMeta = await TopicRoom.find({ room: { $in: myRoomIds }, isActive: true }).select('room category tags').lean();
        const myCategories = new Set(myTopicMeta.map((item) => normalizeText(item.category)).filter(Boolean));
        const myTags = new Set();
        myTopicMeta.forEach((item) => {
            (item.tags || []).forEach((tag) => {
                const normalized = normalizeText(tag);
                if (normalized) myTags.add(normalized);
            });
        });

        // Candidate topic participation map
        const candidateTopicRooms = await Room.find({
            type: 'topic',
            'members.user': { $in: Array.from(candidateIds) },
        }).select('_id members.user').lean();

        const candidateTopicRoomIds = candidateTopicRooms.map((item) => item._id);
        const candidateTopicMeta = await TopicRoom.find({ room: { $in: candidateTopicRoomIds }, isActive: true })
            .select('room category tags')
            .lean();
        const roomMetaMap = new Map(candidateTopicMeta.map((item) => [item.room.toString(), item]));

        const candidateTopicMap = new Map();
        candidateTopicRooms.forEach((room) => {
            const meta = roomMetaMap.get(room._id.toString());
            if (!meta) return;

            const hasCurrentUser = (room.members || []).some((member) => member.user.toString() === currentUserId.toString());

            (room.members || []).forEach((member) => {
                const memberId = member.user.toString();
                if (!candidateIds.has(memberId)) return;

                if (!candidateTopicMap.has(memberId)) {
                    candidateTopicMap.set(memberId, {
                        categories: new Set(),
                        tags: new Set(),
                        sharedRooms: 0,
                    });
                }

                const entry = candidateTopicMap.get(memberId);
                const category = normalizeText(meta.category);
                if (category) entry.categories.add(category);

                (meta.tags || []).forEach((tag) => {
                    const normalizedTag = normalizeText(tag);
                    if (normalizedTag) entry.tags.add(normalizedTag);
                });

                if (hasCurrentUser) entry.sharedRooms += 1;
            });
        });

        const myHobbySet = toSet(currentUser.hobbies);
        const myInterestSet = toSet(currentUser.interests);

        const scored = candidates.map((candidate) => {
            const candidateId = candidate._id.toString();
            const candidateHobbySet = toSet(candidate.hobbies);
            const candidateInterestSet = toSet(candidate.interests);
            const mergedCandidateTopicSignals = new Set([...candidateHobbySet, ...candidateInterestSet]);
            const mergedMyTopicSignals = new Set([...myHobbySet, ...myInterestSet]);

            const sharedHobbiesCount = intersectCount(myHobbySet, candidateHobbySet);
            const hobbyDenominator = Math.max(1, myHobbySet.size, candidateHobbySet.size);
            const hobbiesScore = (sharedHobbiesCount / hobbyDenominator) * 35;

            const languageScore = normalizeText(candidate.preferredLanguage) === normalizeText(currentUser.preferredLanguage) ? 15 : 0;

            const myAddress = normalizeText(currentUser.address);
            const candidateAddress = normalizeText(candidate.address);
            const addressScore = myAddress && candidateAddress
                && (myAddress.includes(candidateAddress) || candidateAddress.includes(myAddress))
                ? 15
                : 0;

            const educationScore = normalizeText(currentUser.education)
                && normalizeText(currentUser.education) === normalizeText(candidate.education)
                ? 10
                : 0;

            const chatMessages = chatMap.get(candidateId) || 0;
            const chatScore = Math.min(chatMessages / 100, 1) * 25;

            const topicData = candidateTopicMap.get(candidateId) || { categories: new Set(), tags: new Set(), sharedRooms: 0 };
            const sharedCategoriesCount = intersectCount(myCategories, topicData.categories);
            const sharedTagsCount = intersectCount(myTags, topicData.tags);

            const topicBonus = sharedCategoriesCount > 0 ? 5 : 0;
            const similarityScore = Math.min(
                hobbiesScore + languageScore + addressScore + educationScore + chatScore + topicBonus,
                100,
            );

            const topicSignalOverlap = intersectCount(mergedMyTopicSignals, mergedCandidateTopicSignals);
            const topicSignalDenominator = Math.max(1, mergedMyTopicSignals.size, mergedCandidateTopicSignals.size);
            const topicSignalScore = (topicSignalOverlap / topicSignalDenominator) * 50;

            const categoryScore = myCategories.size > 0
                ? (sharedCategoriesCount / myCategories.size) * 30
                : 0;

            const tagDenominator = Math.max(1, myTags.size, topicData.tags.size);
            const tagScore = (sharedTagsCount / tagDenominator) * 20;

            const roomBonus = Math.min(topicData.sharedRooms, 3) * 2;
            const topicAffinityScore = Math.min(topicSignalScore + categoryScore + tagScore + roomBonus, 100);

            return {
                _id: candidate._id,
                username: candidate.username,
                avatar: candidate.avatar,
                googlePicture: candidate.googlePicture,
                preferredLanguage: candidate.preferredLanguage,
                preferredLanguageLabel: candidate.preferredLanguageLabel,
                sharedHobbiesCount,
                chatMessages,
                sharedCategoriesCount,
                sharedTagsCount,
                similarityScore: Math.round(similarityScore),
                topicAffinityScore: Math.round(topicAffinityScore),
                reasonBadges: buildReasonBadges({
                    sharedHobbiesCount,
                    chatMessages,
                    sharedCategoriesCount,
                    sharedTagsCount,
                }),
            };
        });

        const topSimilarity = scored
            .slice()
            .sort((a, b) => b.similarityScore - a.similarityScore || b.chatMessages - a.chatMessages || a.username.localeCompare(b.username))
            .slice(0, 5);

        const selectedIds = new Set(topSimilarity.map((item) => item._id.toString()));

        const topicAffinity = scored
            .filter((item) => !selectedIds.has(item._id.toString()) && item.topicAffinityScore > 0)
            .sort((a, b) => b.topicAffinityScore - a.topicAffinityScore || b.sharedCategoriesCount - a.sharedCategoriesCount || a.username.localeCompare(b.username))
            .slice(0, 5);

        res.json({ topSimilarity, topicAffinity });
    } catch (error) {
        next(error);
    }
};
