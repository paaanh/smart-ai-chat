const mongoose = require('mongoose');
const { User } = require('../models/User');
const Friendship = require('../models/Friendship');
const Room = require('../models/Room');
const Message = require('../models/Message');
const TopicRoom = require('../models/TopicRoom');
const CounselingSession = require('../models/CounselingSession');
const Note = require('../models/Note');
const Report = require('../models/Report');
const AdminLog = require('../models/AdminLog');
const ChatDuration = require('../models/ChatDuration');

const API_BASE = process.env.QA_API_BASE || 'http://localhost:5000/api';
const DEFAULT_MONGO_URI = 'mongodb://localhost:27018/smart-ai-chat';

const QA_ACCOUNTS = [
    { alias: 'userA', username: 'qaFriendA', email: 'qa.friend.a@local.test', password: 'Qa123456!', role: 'user' },
    { alias: 'userB', username: 'qaFriendB', email: 'qa.friend.b@local.test', password: 'Qa123456!', role: 'user' },
    { alias: 'counselor', username: 'qaCounselor', email: 'qa.counselor@local.test', password: 'Qa123456!', role: 'user' },
    { alias: 'admin', username: 'qaAdmin', email: 'qa.admin@local.test', password: 'Qa123456!', role: 'super_admin' },
];

const QA_EMAILS = QA_ACCOUNTS.map((x) => x.email);

function getMongoUri() {
    return process.env.QA_MONGODB_URI || process.env.MONGODB_URI || DEFAULT_MONGO_URI;
}

async function withDb(fn) {
    const uri = getMongoUri();
    await mongoose.connect(uri, { serverSelectionTimeoutMS: 10000 });
    try {
        return await fn();
    } finally {
        await mongoose.disconnect();
    }
}

async function ensureQaUsers() {
    return withDb(async () => {
        const result = [];
        for (const acc of QA_ACCOUNTS) {
            let user = await User.findOne({ email: acc.email }).select('+password');
            if (!user) {
                user = new User({
                    username: acc.username,
                    email: acc.email,
                    password: acc.password,
                    provider: 'local',
                    isVerified: true,
                    role: acc.role,
                    preferredLanguage: 'vi',
                });
                await user.save();
                result.push({ email: acc.email, action: 'created', role: user.role });
                continue;
            }

            user.username = acc.username;
            user.password = acc.password;
            user.provider = 'local';
            user.isVerified = true;
            user.role = acc.role;
            user.preferredLanguage = 'vi';
            user.accountStatus = 'active';
            user.is_locked = false;
            user.lock_until = null;
            user.status = 'active';
            await user.save();
            result.push({ email: acc.email, action: 'updated', role: user.role });
        }
        return result;
    });
}

async function cleanupQaData() {
    return withDb(async () => {
        const qaUsers = await User.find({ email: { $in: QA_EMAILS } }).select('_id email').lean();
        const qaUserIds = qaUsers.map((u) => u._id);

        if (qaUserIds.length === 0) {
            return { users: 0, rooms: 0, messages: 0, friendships: 0, reports: 0, notes: 0 };
        }

        const qaRooms = await Room.find({
            $or: [
                { 'members.user': { $in: qaUserIds } },
                { pendingMembers: { $in: qaUserIds } },
                { mutedBy: { $in: qaUserIds } },
                { hiddenFor: { $in: qaUserIds } },
            ],
        }).select('_id').lean();

        const qaRoomIds = qaRooms.map((r) => r._id);

        const qaMessages = await Message.find({
            $or: [
                { room: { $in: qaRoomIds } },
                { sender: { $in: qaUserIds } },
                { 'forwardedFrom.sender': { $in: qaUserIds } },
                { deletedFor: { $in: qaUserIds } },
            ],
        }).select('_id').lean();

        const qaMessageIds = qaMessages.map((m) => m._id);

        const [
            delReports,
            delAdminLogs,
            delNotes,
            delFriendships,
            delChatDuration,
            delCounseling,
            delTopicRooms,
            delMessages,
            delRooms,
            delUsers,
        ] = await Promise.all([
            Report.deleteMany({
                $or: [
                    { reporter: { $in: qaUserIds } },
                    { reportedUser: { $in: qaUserIds } },
                    { resolvedBy: { $in: qaUserIds } },
                    { room: { $in: qaRoomIds } },
                    { message: { $in: qaMessageIds } },
                ],
            }),
            AdminLog.deleteMany({
                $or: [
                    { admin: { $in: qaUserIds } },
                    { targetUser: { $in: qaUserIds } },
                ],
            }),
            Note.deleteMany({ author: { $in: qaUserIds } }),
            Friendship.deleteMany({
                $or: [
                    { requester: { $in: qaUserIds } },
                    { recipient: { $in: qaUserIds } },
                ],
            }),
            ChatDuration.deleteMany({
                $or: [
                    { participants: { $in: qaUserIds } },
                    { roomId: { $in: qaRoomIds } },
                ],
            }),
            CounselingSession.deleteMany({
                $or: [
                    { user: { $in: qaUserIds } },
                    { expert: { $in: qaUserIds } },
                    { room: { $in: qaRoomIds } },
                ],
            }),
            TopicRoom.deleteMany({
                $or: [
                    { creator: { $in: qaUserIds } },
                    { room: { $in: qaRoomIds } },
                ],
            }),
            Message.deleteMany({ _id: { $in: qaMessageIds } }),
            Room.deleteMany({ _id: { $in: qaRoomIds } }),
            User.deleteMany({ _id: { $in: qaUserIds } }),
        ]);

        return {
            users: delUsers.deletedCount,
            rooms: delRooms.deletedCount,
            messages: delMessages.deletedCount,
            friendships: delFriendships.deletedCount,
            reports: delReports.deletedCount,
            notes: delNotes.deletedCount,
            counselingSessions: delCounseling.deletedCount,
            topicRooms: delTopicRooms.deletedCount,
            adminLogs: delAdminLogs.deletedCount,
            chatDuration: delChatDuration.deletedCount,
        };
    });
}

function toErrString(err) {
    if (!err) return 'unknown error';
    if (typeof err === 'string') return err;
    if (err.status) return `HTTP ${err.status} ${JSON.stringify(err.data || {})}`;
    return err.message || JSON.stringify(err);
}

async function api(method, path, { token, body } = {}) {
    const headers = {};
    if (token) headers.Authorization = `Bearer ${token}`;
    if (body !== undefined) headers['Content-Type'] = 'application/json';

    const res = await fetch(`${API_BASE}${path}`, {
        method,
        headers,
        body: body !== undefined ? JSON.stringify(body) : undefined,
    });

    const text = await res.text();
    let data = null;
    try {
        data = text ? JSON.parse(text) : null;
    } catch {
        data = text;
    }

    if (!res.ok) {
        const e = new Error(`Request failed: ${method} ${path}`);
        e.status = res.status;
        e.data = data;
        throw e;
    }

    return { status: res.status, data };
}

async function runQaSmoke() {
    const results = [];
    const ctx = { tokens: {}, users: {}, ids: {} };

    async function test(name, fn) {
        try {
            const detail = await fn();
            results.push({ name, ok: true, detail: detail || null });
        } catch (err) {
            results.push({ name, ok: false, error: toErrString(err) });
        }
    }

    async function login(alias) {
        const account = QA_ACCOUNTS.find((x) => x.alias === alias);
        const { data } = await api('POST', '/auth/login', {
            body: { email: account.email, password: account.password },
        });
        ctx.tokens[alias] = data.token;
        ctx.users[alias] = data.user;
        return { id: data.user._id, role: data.user.role };
    }

    async function ensureNoFriendshipAB() {
        const statusRes = await api('GET', `/friends/status/${ctx.users.userB._id}`, { token: ctx.tokens.userA });
        const status = statusRes.data.status;
        const fid = statusRes.data.friendshipId;
        if (!fid || status === 'none') return 'clean';

        if (status === 'accepted' || status === 'rejected') {
            await api('DELETE', `/friends/${fid}`, { token: ctx.tokens.userA });
            return `removed ${status}`;
        }

        if (status === 'pending') {
            if (statusRes.data.isRequester) {
                await api('DELETE', `/friends/request/${fid}`, { token: ctx.tokens.userA });
                return 'cancelled pending by A';
            }
            await api('DELETE', `/friends/request/${fid}`, { token: ctx.tokens.userB });
            return 'cancelled pending by B';
        }

        return `unknown status ${status}`;
    }

    const stamp = Date.now();

    await test('Health check', async () => {
        const { data } = await api('GET', '/health');
        if (data?.status !== 'OK') throw new Error('health status not OK');
        return { status: data.status };
    });

    await test('Login userA', () => login('userA'));
    await test('Login userB', () => login('userB'));
    await test('Login counselor', () => login('counselor'));
    await test('Login admin', () => login('admin'));

    if (!ctx.tokens.userA || !ctx.tokens.userB || !ctx.tokens.counselor || !ctx.tokens.admin) {
        throw new Error('Cannot continue: some logins failed');
    }

    await test('Cleanup friendship A-B state', ensureNoFriendshipAB);

    await test('Search users (A finds B)', async () => {
        const { data } = await api('GET', '/users/search?q=qaFriendB', { token: ctx.tokens.userA });
        const found = (data.users || []).some((u) => u._id === ctx.users.userB._id);
        if (!found) throw new Error('B not found in search');
        return { count: data.users.length };
    });

    await test('Friend request A -> B', async () => {
        const { data } = await api('POST', '/friends/request', {
            token: ctx.tokens.userA,
            body: { recipientId: ctx.users.userB._id },
        });
        ctx.ids.friendshipAB = data.friendship._id;
        return { friendshipId: ctx.ids.friendshipAB };
    });

    await test('B accepts friend request', async () => {
        const { data } = await api('PUT', `/friends/${ctx.ids.friendshipAB}/accept`, { token: ctx.tokens.userB });
        ctx.ids.directRoomAB = data.roomId;
        if (!ctx.ids.directRoomAB) throw new Error('roomId missing');
        return { roomId: ctx.ids.directRoomAB };
    });

    await test('A creates group room with B', async () => {
        const { data } = await api('POST', '/rooms', {
            token: ctx.tokens.userA,
            body: { name: `QA Group ${stamp}`, type: 'group', memberIds: [ctx.users.userB._id] },
        });
        ctx.ids.groupRoom = data.room._id;
        return { roomId: ctx.ids.groupRoom };
    });

    await test('B leaves group', async () => {
        const { data } = await api('DELETE', `/rooms/${ctx.ids.groupRoom}/leave`, {
            token: ctx.tokens.userB,
            body: {},
        });
        return data;
    });

    await test('A leaves/deletes group', async () => {
        const { data } = await api('DELETE', `/rooms/${ctx.ids.groupRoom}/leave`, {
            token: ctx.tokens.userA,
            body: {},
        });
        return data;
    });

    await test('A creates topic room', async () => {
        const { data } = await api('POST', '/topics', {
            token: ctx.tokens.userA,
            body: {
                title: `QA Topic ${stamp}`,
                description: 'Topic for QA flow',
                category: 'giao_duc',
                tags: ['qa', 'topic'],
                maxMembers: 20,
                isPublic: true,
            },
        });
        ctx.ids.topicId = data.topic._id;
        return { topicId: ctx.ids.topicId };
    });

    await test('B joins topic', async () => {
        const { data } = await api('POST', `/topics/${ctx.ids.topicId}/join`, { token: ctx.tokens.userB });
        return data;
    });

    await test('B leaves topic', async () => {
        const { data } = await api('DELETE', `/topics/${ctx.ids.topicId}/leave`, { token: ctx.tokens.userB });
        return data;
    });

    await test('A leaves topic', async () => {
        const { data } = await api('DELETE', `/topics/${ctx.ids.topicId}/leave`, { token: ctx.tokens.userA });
        return data;
    });

    await test('A creates note', async () => {
        const { data } = await api('POST', '/notes', {
            token: ctx.tokens.userA,
            body: { content: 'QA note from user A' },
        });
        ctx.ids.noteId = data.note._id;
        return { noteId: ctx.ids.noteId };
    });

    await test('B replies note', async () => {
        const { data } = await api('POST', `/notes/${ctx.ids.noteId}/reply`, {
            token: ctx.tokens.userB,
            body: { content: 'Reply from B to A note' },
        });
        return { roomId: data.roomId };
    });

    await test('A reports B', async () => {
        const { data } = await api('POST', '/user-actions/report', {
            token: ctx.tokens.userA,
            body: { reportedUserId: ctx.users.userB._id, reason: 'spam', description: 'QA report flow check' },
        });
        return { reportId: data.report?._id };
    });

    await test('A creates counseling session', async () => {
        const categories = await api('GET', '/counseling/categories', { token: ctx.tokens.userA });
        const category = categories.data.categories[0]?.key || 'tam_ly';
        const { data } = await api('POST', '/counseling/sessions', {
            token: ctx.tokens.userA,
            body: { category, isAnonymous: true },
        });
        ctx.ids.counselingSessionId = data.session._id;
        return { sessionId: ctx.ids.counselingSessionId };
    });

    await test('Counselor joins counseling session', async () => {
        const { data } = await api('POST', `/counseling/sessions/${ctx.ids.counselingSessionId}/join`, {
            token: ctx.tokens.counselor,
        });
        return { message: data.message };
    });

    await test('Admin lock + unlock userA', async () => {
        await api('PUT', `/admin/users/${ctx.users.userA._id}/lock`, {
            token: ctx.tokens.admin,
            body: { minutes: 1 },
        });

        let locked = false;
        try {
            await api('POST', '/auth/login', {
                body: { email: QA_ACCOUNTS[0].email, password: QA_ACCOUNTS[0].password },
            });
        } catch (err) {
            if (err.status === 403) locked = true;
        }
        if (!locked) throw new Error('userA login should be blocked while locked');

        await api('PUT', `/admin/users/${ctx.users.userA._id}/lock`, {
            token: ctx.tokens.admin,
            body: { minutes: 0 },
        });

        return { lockedCheck: true, unlocked: true };
    });

    const passed = results.filter((x) => x.ok).length;
    return {
        summary: { total: results.length, passed, failed: results.length - passed },
        results,
    };
}

async function main() {
    const args = new Set(process.argv.slice(2));
    const cleanupOnly = args.has('--cleanup-only');
    const keepData = args.has('--keep-data');

    console.log('=== QA MULTI-ROLE OFFICIAL ===');
    console.log(`API base: ${API_BASE}`);
    console.log(`Mongo URI: ${getMongoUri()}`);

    let testReport = null;
    let cleanupReport = null;
    let failed = false;

    try {
        if (cleanupOnly) {
            cleanupReport = await cleanupQaData();
            console.log('Cleanup only finished');
            console.log(JSON.stringify({ cleanup: cleanupReport }, null, 2));
            return;
        }

        const ensured = await ensureQaUsers();
        console.log('QA accounts prepared');
        console.log(JSON.stringify(ensured, null, 2));

        testReport = await runQaSmoke();
        console.log('QA test report');
        console.log(JSON.stringify(testReport, null, 2));

        if (testReport.summary.failed > 0) {
            failed = true;
        }
    } catch (err) {
        failed = true;
        console.error('QA run failed:', toErrString(err));
    } finally {
        if (!cleanupOnly && !keepData) {
            try {
                cleanupReport = await cleanupQaData();
                console.log('QA cleanup finished');
                console.log(JSON.stringify({ cleanup: cleanupReport }, null, 2));
            } catch (cleanupErr) {
                failed = true;
                console.error('Cleanup failed:', toErrString(cleanupErr));
            }
        }
    }

    if (failed) process.exit(2);
}

main();
