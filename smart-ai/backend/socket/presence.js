// In-memory presence tracker. Map<userId, Set<socketId>> so multi-tab works:
// user only goes "offline" when the LAST socket for that user disconnects.
const userSockets = new Map();

function addSocket(userId, socketId) {
    const key = String(userId);
    let set = userSockets.get(key);
    if (!set) {
        set = new Set();
        userSockets.set(key, set);
    }
    set.add(socketId);
    return set.size === 1; // true => became online
}

function removeSocket(userId, socketId) {
    const key = String(userId);
    const set = userSockets.get(key);
    if (!set) return true; // already offline
    set.delete(socketId);
    if (set.size === 0) {
        userSockets.delete(key);
        return true; // became offline
    }
    return false;
}

function isOnline(userId) {
    return userSockets.has(String(userId));
}

function getOnlineUserIds() {
    return Array.from(userSockets.keys());
}

module.exports = { addSocket, removeSocket, isOnline, getOnlineUserIds };
