const express = require('express');
const router = express.Router();
const { authMiddleware } = require('../middlewares/auth.middleware');
const { adminMiddleware } = require('../middlewares/admin.middleware');
const {
    getUsers,
    getStats,
    getUserById,
    updateUser,
    deleteUser,
    toggleVerified,
} = require('../controllers/admin.controller');

// Tất cả routes đều cần auth + admin
router.use(authMiddleware, adminMiddleware);

router.get('/users', getUsers);
router.get('/stats', getStats);
router.get('/users/:id', getUserById);
router.put('/users/:id', updateUser);
router.delete('/users/:id', deleteUser);
router.put('/users/:id/toggle-verified', toggleVerified);

module.exports = router;
