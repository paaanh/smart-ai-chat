const express = require('express');
const http = require('http');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
require('dotenv').config();

const { Server } = require('socket.io');
const connectDB = require('./config/db');
const { corsOptions, allowedOrigins } = require('./config/cors');
const errorHandler = require('./middlewares/errorHandler');
const { initAI, getAIStats } = require('./services/ai.service');
const initializeSocket = require('./socket');

// ─── Khởi tạo Express + HTTP Server ──────────────────────────────────
const app = express();
const server = http.createServer(app);

// ─── Khởi tạo Socket.io ──────────────────────────────────────────────
const io = new Server(server, {
    cors: {
        origin: allowedOrigins,
        credentials: true,
    },
    maxHttpBufferSize: 1e8, // 100MB cho file transfer
});

// Expose io to HTTP controllers (for real-time notifications from REST routes)
app.set('io', io);

// ─── Middleware ───────────────────────────────────────────────────────
app.use(cors(corsOptions));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// ─── Static files (uploads) ──────────────────────────────────────────
const uploadsDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadsDir)) {
    fs.mkdirSync(uploadsDir, { recursive: true });
}
app.use('/uploads', express.static(uploadsDir));

// ─── API Routes ───────────────────────────────────────────────────────
const authRoutes = require('./routes/auth.routes');
const userRoutes = require('./routes/user.routes');
const roomRoutes = require('./routes/room.routes');
const uploadRoutes = require('./routes/upload.routes');
const friendRoutes = require('./routes/friend.routes');

app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/rooms', roomRoutes);
app.use('/api/upload', uploadRoutes);
app.use('/api/friends', friendRoutes);

// ─── Health Check ─────────────────────────────────────────────────────
app.get('/api/health', (req, res) => {
    res.json({
        status: 'OK',
        server: 'Smart AI Chat Server',
        timestamp: new Date().toISOString(),
        ai: getAIStats(),
    });
});

// ─── Error Handler ────────────────────────────────────────────────────
app.use(errorHandler);

// ─── Start Server ─────────────────────────────────────────────────────
const PORT = process.env.PORT || 5000;

const startServer = async () => {
    try {
        // 1. Kết nối MongoDB
        await connectDB();

        // 2. Khởi tạo Gemini AI
        initAI();

        // 3. Khởi tạo Socket.io handlers
        initializeSocket(io);

        // 4. Start HTTP Server
        server.listen(PORT, () => {
            console.log(`\n🚀 ═══════════════════════════════════════════════`);
            console.log(`   Smart AI Chat Server`);
            console.log(`   HTTP:   http://localhost:${PORT}`);
            console.log(`   Socket: ws://localhost:${PORT}`);
            console.log(`   Env:    ${process.env.NODE_ENV || 'development'}`);
            console.log(`═══════════════════════════════════════════════════\n`);
        });
    } catch (error) {
        console.error('❌ Failed to start server:', error.message);
        process.exit(1);
    }
};

startServer();
