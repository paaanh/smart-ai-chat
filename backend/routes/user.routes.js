const router = require('express').Router();
const userController = require('../controllers/user.controller');
const { authMiddleware } = require('../middlewares/auth.middleware');

// Tất cả routes cần xác thực
router.use(authMiddleware);

// PUT /api/users/profile
router.put('/profile', userController.updateProfile);

// GET /api/users/search?q=keyword
router.get('/search', userController.searchUsers);

// GET /api/users/languages  (danh sách ngôn ngữ hỗ trợ)
router.get('/languages', userController.getSupportedLanguages);

// GET /api/users/:id
router.get('/:id', userController.getUserById);

module.exports = router;
