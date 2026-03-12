const express = require('express');
const router = express.Router();
const { authMiddleware } = require('../middlewares/auth.middleware');
const { adminMiddleware } = require('../middlewares/admin.middleware');
const {
    getUsers, getStats, getAnalytics, getUserById, updateUser, deleteUser, toggleVerified,
    banUser, unbanUser, lockUser, resetPassword,
    muteUser, unmuteUser,
    getReports, resolveReport,
    getBadWords, addBadWord, removeBadWord,
    getSystemConfig, updateSystemConfig,
    getAdminLogs,
} = require('../controllers/admin.controller');

// Tất cả routes đều cần auth + admin
router.use(authMiddleware, adminMiddleware);

// Users
router.get('/users', getUsers);
router.get('/stats', getStats);
router.get('/analytics', getAnalytics);
router.get('/users/:id', getUserById);
router.put('/users/:id', updateUser);
router.delete('/users/:id', deleteUser);
router.put('/users/:id/toggle-verified', toggleVerified);
router.put('/users/:id/ban', banUser);
router.put('/users/:id/unban', unbanUser);
router.put('/users/:id/lock', lockUser);
router.put('/users/:id/reset-password', resetPassword);
router.put('/users/:id/mute', muteUser);
router.put('/users/:id/unmute', unmuteUser);

// Reports
router.get('/reports', getReports);
router.put('/reports/:id/resolve', resolveReport);

// Bad words
router.get('/bad-words', getBadWords);
router.post('/bad-words', addBadWord);
router.delete('/bad-words/:id', removeBadWord);

// System config
router.get('/config', getSystemConfig);
router.put('/config', updateSystemConfig);

// Admin logs
router.get('/logs', getAdminLogs);

module.exports = router;
