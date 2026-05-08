const { User } = require('../models/User');
const SystemConfig = require('../models/SystemConfig');
const { socketAuthMiddleware } = require('../middlewares/auth.middleware');
const chatHandler = require('./chat.handler');
const webrtcHandler = require('./webrtc.handler');
const aiHandler = require('./ai.handler');
const messageHandler = require('./message.handler');
const friendHandler = require('./friend.handler');
const presence = require('./presence');

const initializeSocket = (io) => {
    // ─── Middleware xác thực Socket ────────────────────────────────────
    io.use(socketAuthMiddleware);

    io.on('connection', async (socket) => {
        const user = socket.user;
        const userId = user._id.toString();

        // ─── Kiểm tra maintenance mode ────────────────────────────────
        if (!['sub_admin', 'super_admin'].includes(user.role)) {
            const config = await SystemConfig.findOne({ key: 'maintenanceMode' });
            if (config && config.value === true) {
                socket.emit('system:maintenance', { message: 'Hệ thống đang bảo trì' });
                return socket.disconnect(true);
            }
        }

        console.log(`🟢 ${user.username} connected (socket: ${socket.id})`);

        // Join personal room so admin can target user by userId
        socket.join(userId);

        const becameOnline = presence.addSocket(userId, socket.id);

        // Send current online list to the newly connected client (initial sync)
        socket.emit('presence:init', { onlineUsers: presence.getOnlineUserIds() });

        // Always update socketId to latest (used by emit-to-user code paths)
        await User.findByIdAndUpdate(user._id, {
            status: 'online',
            socketId: socket.id,
            lastOnline: new Date(),
        });

        if (becameOnline) {
            socket.broadcast.emit('user:online', { userId, status: 'online' });
        }

        // ─── Đăng ký tất cả handlers ──────────────────────────────────
        chatHandler(io, socket);
        messageHandler(io, socket);
        webrtcHandler(io, socket);
        aiHandler(io, socket);
        friendHandler(io, socket);

        // ─── Disconnect ────────────────────────────────────────────────
        socket.on('disconnect', async () => {
            console.log(`🔴 ${user.username} disconnected (socket: ${socket.id})`);

            const becameOffline = presence.removeSocket(userId, socket.id);
            if (becameOffline) {
                const lastSeen = new Date();
                await User.findByIdAndUpdate(user._id, {
                    status: 'offline',
                    socketId: null,
                    lastSeen,
                });
                socket.broadcast.emit('user:offline', { userId, lastSeen });
            }
        });
    });
};

module.exports = initializeSocket;
