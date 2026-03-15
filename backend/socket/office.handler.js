const Player = require('../models/Player');

// Throttle helper: rate-limits emissions, queuing the latest update to send after the interval
const throttleTimers = new Map();
const throttlePending = new Map();

function throttledEmit(socketId, fn, limitMs) {
    if (throttleTimers.has(socketId)) {
        // Store the latest call to fire after the interval
        throttlePending.set(socketId, fn);
        return;
    }
    fn();
    throttleTimers.set(socketId, setTimeout(() => {
        throttleTimers.delete(socketId);
        const pending = throttlePending.get(socketId);
        if (pending) {
            throttlePending.delete(socketId);
            throttledEmit(socketId, pending, limitMs);
        }
    }, limitMs));
}

module.exports = (io, socket) => {
    const user = socket.user;

    // ─── office:join ─────────────────────────────────────────────────
    socket.on('office:join', async ({ officeId = 'main-office' } = {}) => {
        try {
            const socketRoom = `office:${officeId}`;
            socket.join(socketRoom);

            // Upsert player record
            const player = await Player.findOneAndUpdate(
                { userId: user._id, officeId },
                {
                    username: user.username,
                    x: 400,
                    y: 300,
                    anim: 'idle-down',
                },
                { upsert: true, new: true, setDefaultsOnInsert: true }
            );

            // Send all existing players in this office to the new player
            const existingPlayers = await Player.find({ officeId });
            socket.emit('office:current-players', existingPlayers);

            // Broadcast new player to others in the room
            socket.to(socketRoom).emit('office:player-joined', {
                id: player.userId.toString(),
                username: player.username,
                x: player.x,
                y: player.y,
                anim: player.anim,
            });

            console.log(`🏢 ${user.username} joined office ${officeId}`);
        } catch (error) {
            console.error('office:join error:', error.message);
            socket.emit('error', { message: 'Error joining office' });
        }
    });

    // ─── office:player-movement ──────────────────────────────────────
    socket.on('office:player-movement', ({ officeId = 'main-office', x, y, anim }) => {
        // Throttle to ~20fps (50ms interval), queuing the latest position
        throttledEmit(socket.id, () => {
            const socketRoom = `office:${officeId}`;

            // Broadcast to all others in the room
            socket.to(socketRoom).emit('office:player-moved', {
                id: user._id.toString(),
                x,
                y,
                anim,
            });

            // Async DB update (fire-and-forget for performance)
            Player.findOneAndUpdate(
                { userId: user._id, officeId },
                { x, y, anim },
            ).catch((err) => console.error('Player position update error:', err.message));
        }, 50);
    });

    // ─── office:leave ────────────────────────────────────────────────
    socket.on('office:leave', async ({ officeId = 'main-office' } = {}) => {
        try {
            const socketRoom = `office:${officeId}`;
            socket.leave(socketRoom);

            await Player.findOneAndDelete({ userId: user._id, officeId });

            socket.to(socketRoom).emit('office:player-left', {
                id: user._id.toString(),
            });

            console.log(`🏢 ${user.username} left office ${officeId}`);
        } catch (error) {
            console.error('office:leave error:', error.message);
        }
    });

    // ─── disconnect — clean up player from all offices ───────────────
    socket.on('disconnect', async () => {
        try {
            // Clean up throttle state
            throttleTimers.delete(socket.id);
            throttlePending.delete(socket.id);

            const players = await Player.find({ userId: user._id });
            for (const p of players) {
                const socketRoom = `office:${p.officeId}`;
                socket.to(socketRoom).emit('office:player-left', {
                    id: user._id.toString(),
                });
            }
            await Player.deleteMany({ userId: user._id });
        } catch (error) {
            console.error('office disconnect cleanup error:', error.message);
        }
    });
};
