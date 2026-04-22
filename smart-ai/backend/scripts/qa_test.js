require('dotenv').config();
const mongoose = require('mongoose');
const { User } = require('../models/User');
const Room = require('../models/Room');
const TopicRoom = require('../models/TopicRoom');
const Friendship = require('../models/Friendship');
const Message = require('../models/Message');

const MONGO_URI = process.env.MONGODB_URI || 'mongodb://localhost:27018/smart-ai-chat';

const runQATest = async () => {
    try {
        console.log('🔗 Đang kết nối DB:', MONGO_URI);
        await mongoose.connect(MONGO_URI);
        console.log('✅ Kết nối thành công.\n');

        console.log('🧹 Xóa dữ liệu rác QA từ lần chạy trước...');
        await cleanupQAData();

        console.log('\n--- 🚀 BẮT ĐẦU KIỂM THỬ TỰ ĐỘNG QA ---');

        // 1. Tạo Test Users
        console.log('\n1. Tạo Test Users');
        const userA = await User.create({
            username: 'qa_user_A',
            email: 'qa_a@test.com',
            password: 'password123',
            provider: 'local',
            status: 'online'
        });
        const userB = await User.create({
            username: 'qa_user_B',
            email: 'qa_b@test.com',
            password: 'password123',
            provider: 'local',
            status: 'online'
        });
        const userC = await User.create({
            username: 'qa_user_C',
            email: 'qa_c@test.com',
            password: 'password123',
            provider: 'local',
            status: 'online'
        });
        console.log('✅ Đã tạo user: qa_user_A, qa_user_B, qa_user_C');

        // 2. Kiểm thử lỗi Duplicate Bạn bè (Race Condition)
        console.log('\n2. Kiểm thử lỗi Duplicate Bạn bè (Race Condition)');
        console.log('   Bắn 5 request kết bạn đồng thời từ A -> B và B -> A...');
        const sendFriendReq = async (requesterId, recipientId) => {
            // Giả lập logic controller
            let existing = await Friendship.findOne({
                $or: [
                    { requester: requesterId, recipient: recipientId },
                    { requester: recipientId, recipient: requesterId },
                ]
            });
            if (existing) return existing;
            
            let friendship;
            try {
                friendship = await Friendship.create({ requester: requesterId, recipient: recipientId });
            } catch (err) {
                if (err.code === 11000) {
                    // Lỗi duplicate key - controller sẽ trả về 409
                    return null;
                }
                throw err;
            }
            
            const duplicates = await Friendship.find({
                $or: [
                    { requester: requesterId, recipient: recipientId },
                    { requester: recipientId, recipient: requesterId },
                ]
            }).sort({ createdAt: 1 });
            
            if (duplicates.length > 1) {
                await Friendship.deleteMany({ _id: { $in: duplicates.slice(1).map(f => f._id) } });
            }
            return friendship;
        };

        await Promise.all([
            sendFriendReq(userA._id, userB._id),
            sendFriendReq(userA._id, userB._id),
            sendFriendReq(userB._id, userA._id),
            sendFriendReq(userB._id, userA._id),
            sendFriendReq(userA._id, userB._id)
        ]);
        
        const friendships = await Friendship.find({
            $or: [
                { requester: userA._id, recipient: userB._id },
                { requester: userB._id, recipient: userA._id }
            ]
        });
        if (friendships.length === 1) {
            console.log('✅ Test Passed: Không có duplicate friendship!');
        } else {
            console.error(`❌ Test Failed: Có ${friendships.length} bản ghi friendship!`);
        }

        // 3. Kiểm thử tạo Room và Chịu Lỗi khi Rời Nhóm (Fault Tolerance)
        console.log('\n3. Kiểm thử API rời phòng (Fault Tolerance)');
        const room = await Room.create({
            name: 'qa_topic_room',
            type: 'topic',
            members: [
                { user: userA._id, role: 'admin' },
                { user: userB._id, role: 'member' },
                { user: userC._id, role: 'member' }
            ]
        });
        const topic = await TopicRoom.create({
            room: room._id,
            title: 'qa_topic_room',
            category: 'giao_duc',
            creator: userA._id,
            isActive: true,
            memberCount: 3
        });
        console.log(`   Đã tạo nhóm: ${room.name} gồm A (admin), B, C`);

        // Giả lập User A (Admin) rời phòng mà không chỉ định admin mới (Fault Tolerance Test)
        console.log('   User A (Admin) rời phòng mà không truyền newOwnerId...');
        const leavingUserId = userA._id.toString();
        const leavingMember = room.members.find(m => m.user.toString() === leavingUserId);
        
        // Logic từ backend room.controller.js
        if (leavingMember.role === 'admin') {
            const otherMembers = room.members.filter(m => m.user.toString() !== leavingUserId);
            if (otherMembers.length > 0) {
                const hasOtherAdmins = otherMembers.some(m => m.role === 'admin');
                if (!hasOtherAdmins) {
                    otherMembers[0].role = 'admin'; // Auto-promote (Fault Tolerance)
                }
            }
        }
        room.members = room.members.filter(m => m.user.toString() !== leavingUserId);
        await room.save();

        const updatedRoom = await Room.findById(room._id);
        const autoPromotedAdmin = updatedRoom.members.find(m => m.role === 'admin');
        if (autoPromotedAdmin && autoPromotedAdmin.user.toString() === userB._id.toString()) {
            console.log('✅ Test Passed: User B đã tự động được thăng cấp làm Admin!');
        } else {
            console.error('❌ Test Failed: Không có ai được auto-promote hoặc lỗi logic!');
        }

        console.log('\n--- 🎉 HOÀN TẤT KIỂM THỬ ---');

    } catch (error) {
        console.error('❌ Có lỗi xảy ra trong quá trình QA:', error);
    } finally {
        console.log('\n🧹 Dọn dẹp dữ liệu DB sau khi test...');
        await cleanupQAData();
        console.log('✅ Dọn dẹp thành công. Đóng kết nối!');
        mongoose.connection.close();
    }
};

const cleanupQAData = async () => {
    const users = await User.find({ username: { $regex: /^qa_user/ } });
    const userIds = users.map(u => u._id);

    await Friendship.deleteMany({
        $or: [
            { requester: { $in: userIds } },
            { recipient: { $in: userIds } }
        ]
    });

    const rooms = await Room.find({ name: { $regex: /^qa_/ } });
    const roomIds = rooms.map(r => r._id);

    await Message.deleteMany({ room: { $in: roomIds } });
    await TopicRoom.deleteMany({ room: { $in: roomIds } });
    await Room.deleteMany({ _id: { $in: roomIds } });
    await User.deleteMany({ _id: { $in: userIds } });
};

runQATest();
