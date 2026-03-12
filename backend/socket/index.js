const { User } = require('../models/User');
const { socketAuthMiddleware } = require('../middlewares/auth.middleware');
const chatHandler = require('./chat.handler');
const webrtcHandler = require('./webrtc.handler');
const aiHandler = require('./ai.handler');
const messageHandler = require('./message.handler');
const friendHandler = require('./friend.handler');

const initializeSocket = (io) => {
    // ─── Middleware xác thực Socket ────────────────────────────────────
    io.use(socketAuthMiddleware);

    io.on('connection', async (socket) => {
        const user = socket.user;
        console.log(`🟢 ${user.username} connected (socket: ${socket.id})`);

        // Cập nhật trạng thái online & socketId
        await User.findByIdAndUpdate(user._id, {
            status: 'online',
            socketId: socket.id,
            lastOnline: new Date(),
        });

        // Broadcast user online cho tất cả
        socket.broadcast.emit('user:online', {
            userId: user._id,
            status: 'online',
        });

        // ─── Đăng ký tất cả handlers ──────────────────────────────────
        chatHandler(io, socket);
        messageHandler(io, socket);
        webrtcHandler(io, socket);
        aiHandler(io, socket);
        friendHandler(io, socket);

        // ─── Disconnect ────────────────────────────────────────────────
        socket.on('disconnect', async () => {
            console.log(`🔴 ${user.username} disconnected`);

            await User.findByIdAndUpdate(user._id, {
                status: 'offline',
                socketId: null,
                lastSeen: new Date(),
            });

            socket.broadcast.emit('user:offline', {
                userId: user._id,
                lastSeen: new Date(),
            });
        });
    });
};

module.exports = initializeSocket;
