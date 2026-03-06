const router = require('express').Router();
const roomController = require('../controllers/room.controller');
const { authMiddleware } = require('../middlewares/auth.middleware');

// Tất cả routes cần xác thực
router.use(authMiddleware);

// POST /api/rooms          (tạo room)
router.post('/', roomController.createRoom);

// GET /api/rooms            (danh sách rooms của user)
router.get('/', roomController.getUserRooms);

// GET /api/rooms/:id        (chi tiết room)
router.get('/:id', roomController.getRoomById);

// GET /api/rooms/:id/messages  (tin nhắn của room, phân trang)
router.get('/:id/messages', roomController.getRoomMessages);

// POST /api/rooms/:id/members  (thêm thành viên)
router.post('/:id/members', roomController.addMember);

// DELETE /api/rooms/:id/leave  (rời room)
router.delete('/:id/leave', roomController.leaveRoom);

module.exports = router;
