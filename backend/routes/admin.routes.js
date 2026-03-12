const express = require('express');
const router = express.Router();
const { authMiddleware } = require('../middlewares/auth.middleware');
const { adminMiddleware, superAdminMiddleware } = require('../middlewares/admin.middleware');
const {
    getUsers, getStats, getUserById, updateUser, deleteUser, toggleVerified,
    banUser, unbanUser, lockUser, resetPassword,
    getReports, resolveReport,
    getBadWords, addBadWord, removeBadWord,
    getSystemConfig, updateSystemConfig,
    getAdminLogs,
} = require('../controllers/admin.controller');

// Tất cả routes đều cần auth + admin (sub_admin hoặc super_admin)
router.use(authMiddleware, adminMiddleware);

// ─── Sub-admin có thể dùng ────────────────────────────────────────
router.get('/users', getUsers);
router.get('/stats', getStats);
router.get('/users/:id', getUserById);
router.put('/users/:id/lock', lockUser);
router.put('/users/:id/reset-password', resetPassword);
router.get('/reports', getReports);
router.get('/logs', getAdminLogs);

// ─── Chỉ super_admin mới được dùng ───────────────────────────────
router.put('/users/:id', superAdminMiddleware, updateUser);
router.delete('/users/:id', superAdminMiddleware, deleteUser);
router.put('/users/:id/toggle-verified', superAdminMiddleware, toggleVerified);
router.put('/users/:id/ban', superAdminMiddleware, banUser);
router.put('/users/:id/unban', superAdminMiddleware, unbanUser);
router.put('/reports/:id/resolve', superAdminMiddleware, resolveReport);
router.get('/bad-words', getBadWords);
router.post('/bad-words', superAdminMiddleware, addBadWord);
router.delete('/bad-words/:id', superAdminMiddleware, removeBadWord);
router.get('/config', getSystemConfig);
router.put('/config', superAdminMiddleware, updateSystemConfig);

module.exports = router;
