const express = require('express');
const http = require('http');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
require('dotenv').config();

const { Server } = require('socket.io');
const connectDB = require('./config/db');
const { corsOptions, allowedOrigins, isOriginAllowed } = require('./config/cors');
const errorHandler = require('./middlewares/errorHandler');
const { initAI, getAIStats } = require('./services/ai.service');
const initializeSocket = require('./socket');

// ─── Khởi tạo Express + HTTP Server ──────────────────────────────────
const app = express();
const server = http.createServer(app);

// ─── Khởi tạo Socket.io ──────────────────────────────────────────────
const io = new Server(server, {
    cors: {
        origin: function (origin, callback) {
            if (!origin) return callback(null, true);
            if (isOriginAllowed(origin)) {
                callback(null, true);
            } else {
                callback(new Error('Not allowed by CORS'));
            }
        },
        credentials: true,
    },
    maxHttpBufferSize: 1e8, // 100MB cho file transfer
    transports: ['websocket', 'polling'],
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
const userActionsRoutes = require('./routes/user-actions.routes');
const adminRoutes = require('./routes/admin.routes');
const noteRoutes = require('./routes/note.routes');

app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/rooms', roomRoutes);
app.use('/api/upload', uploadRoutes);
app.use('/api/friends', friendRoutes);
app.use('/api/user-actions', userActionsRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/notes', noteRoutes);

// ─── Health Check ─────────────────────────────────────────────────────
app.get('/api/health', (req, res) => {
    res.json({
        status: 'OK',
        server: 'Smart AI Chat Server',
        timestamp: new Date().toISOString(),
        ai: getAIStats(),
    });
});

// ─── ICE Servers (TURN/STUN for WebRTC) ───────────────────────────────
app.get('/api/ice-servers', async (req, res) => {
    try {
        console.log(`❄️  ICE Servers requested by ${req.ip}`);
        const iceServers = [
            { urls: 'stun:stun.l.google.com:19302' },
            { urls: 'stun:stun1.l.google.com:19302' },
            { urls: 'stun:stun2.l.google.com:19302' },
        ];

        let hasTurn = false;

        // If Metered.ca API key is configured, fetch real TURN credentials
        const meteredApiKey = process.env.METERED_API_KEY;
        const meteredDomain = process.env.METERED_DOMAIN || 'smart-ai-chat.metered.live';
        if (meteredApiKey) {
            const controller = new AbortController();
            const timeout = setTimeout(() => controller.abort(), 5000);
            try {
                const response = await fetch(
                    `https://${meteredDomain}/api/v1/turn/credentials?apiKey=${encodeURIComponent(meteredApiKey)}`,
                    { signal: controller.signal }
                );
                clearTimeout(timeout);
                if (response.ok) {
                    const turnServers = await response.json();
                    const normalized = turnServers.map(s => ({
                        urls: s.urls || s.url,
                        ...(s.username && { username: s.username }),
                        ...(s.credential && { credential: s.credential }),
                    })).filter(s => s.urls);
                    iceServers.push(...normalized);
                    hasTurn = normalized.length > 0;
                    console.log(`✅ Fetched ${normalized.length} TURN servers from Metered.ca`);
                } else {
                    console.warn('⚠️ Failed to fetch Metered TURN credentials:', response.status);
                }
            } catch (fetchErr) {
                clearTimeout(timeout);
                console.warn('⚠️ Metered API timeout/error:', fetchErr.message);
            }
        }

        // Fallback: Open Relay free TURN servers (static auth)
        if (!hasTurn) {
            const crypto = require('crypto');
            const unixTimestamp = Math.floor(Date.now() / 1000) + 24 * 3600;
            const username = `${unixTimestamp}:openrelayproject`;
            const hmac = crypto.createHmac('sha1', 'openrelayprojectsecret');
            hmac.update(username);
            const credential = hmac.digest('base64');

            iceServers.push(
                { urls: 'stun:stun.relay.metered.ca:80' },
                { urls: 'turn:global.relay.metered.ca:80', username, credential },
                { urls: 'turn:global.relay.metered.ca:80?transport=tcp', username, credential },
                { urls: 'turn:global.relay.metered.ca:443', username, credential },
                { urls: 'turns:global.relay.metered.ca:443?transport=tcp', username, credential }
            );
            hasTurn = true;
            console.log('✅ Using Open Relay free TURN servers (static auth)');
        }

        // Manual TURN server from env vars
        const turnUrl = process.env.TURN_URL;
        const turnUser = process.env.TURN_USERNAME;
        const turnCred = process.env.TURN_CREDENTIAL;
        if (turnUrl) {
            iceServers.push({
                urls: turnUrl.split(',').map(u => u.trim()),
                username: turnUser || '',
                credential: turnCred || '',
            });
        }

        res.json({ iceServers });
    } catch (error) {
        console.error('ICE servers error:', error.message);
        res.json({
            iceServers: [
                { urls: 'stun:stun.l.google.com:19302' },
                { urls: 'stun:stun1.l.google.com:19302' },
            ],
        });
    }
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
