const mongoose = require('mongoose');
const { User } = require('../models/User');
const Room = require('../models/Room');
const Message = require('../models/Message');
const Friendship = require('../models/Friendship');

function buildSessionToken(user) {
    return `demo-session-${user._id}-${Date.now()}`;
}

async function upsertOneById(collection, doc) {
    await collection.updateOne(
        { _id: doc._id },
        { $set: doc },
        { upsert: true }
    );
}

async function main() {
    const uriFromArg = process.argv[2];
    const uri = uriFromArg || process.env.MONGODB_URI || 'mongodb://localhost:27017/smart-ai-chat';

    try {
        await mongoose.connect(uri, { serverSelectionTimeoutMS: 10000 });

        const db = mongoose.connection.db;
        const sessionsCol = db.collection('sessions');
        const friendsCol = db.collection('friends');
        const friendRequestsCol = db.collection('friendrequests');
        const conversationsCol = db.collection('conversations');

        const [users, friendships, rooms] = await Promise.all([
            User.find({}).select('_id username email avatar status').lean(),
            Friendship.find({}).select('_id requester recipient status createdAt updatedAt').lean(),
            Room.find({}).select('_id type name members lastMessage createdAt updatedAt').lean(),
        ]);

        if (users.length === 0) {
            console.log('No users found. Please create users first, then run again.');
            return;
        }

        // 1) sessions: create 1 demo session per user
        for (const user of users) {
            const sessionDoc = {
                _id: user._id,
                userId: user._id,
                email: user.email,
                username: user.username,
                token: buildSessionToken(user),
                status: 'active',
                createdAt: new Date(),
                updatedAt: new Date(),
                expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
            };
            await upsertOneById(sessionsCol, sessionDoc);
        }

        // 2) friends/friendrequests: map from friendships
        for (const f of friendships) {
            const base = {
                _id: f._id,
                requester: f.requester,
                recipient: f.recipient,
                createdAt: f.createdAt || new Date(),
                updatedAt: f.updatedAt || new Date(),
            };

            if (f.status === 'accepted') {
                await upsertOneById(friendsCol, {
                    ...base,
                    status: 'accepted',
                });
            } else if (f.status === 'pending') {
                await upsertOneById(friendRequestsCol, {
                    ...base,
                    status: 'pending',
                });
            }
        }

        // 3) conversations: map from rooms + message count snapshot
        for (const room of rooms) {
            const messageCount = await Message.countDocuments({ room: room._id });
            const memberIds = (room.members || []).map((m) => m.user);

            const conversationDoc = {
                _id: room._id,
                roomId: room._id,
                type: room.type,
                name: room.name || null,
                members: memberIds,
                memberCount: memberIds.length,
                lastMessage: room.lastMessage || null,
                messageCount,
                createdAt: room.createdAt || new Date(),
                updatedAt: room.updatedAt || new Date(),
            };

            await upsertOneById(conversationsCol, conversationDoc);
        }

        const [sessionsCount, friendsCount, friendRequestsCount, conversationsCount] = await Promise.all([
            sessionsCol.countDocuments(),
            friendsCol.countDocuments(),
            friendRequestsCol.countDocuments(),
            conversationsCol.countDocuments(),
        ]);

        console.log('Legacy demo collections synced successfully:');
        console.log(JSON.stringify({
            sessions: sessionsCount,
            friends: friendsCount,
            friendrequests: friendRequestsCount,
            conversations: conversationsCount,
        }, null, 2));
    } catch (error) {
        console.error('Seed legacy collections failed:', error.message);
        process.exit(1);
    } finally {
        await mongoose.disconnect();
    }
}

main();
