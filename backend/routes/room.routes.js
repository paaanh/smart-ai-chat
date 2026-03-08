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

// ─── Chat Info Sidebar APIs ────────────────────────────────────────
// PUT  /api/rooms/:id/nickname     (đặt biệt danh)
router.put('/:id/nickname', roomController.setNickname);

// PUT  /api/rooms/:id/mute         (tắt/bật thông báo)
router.put('/:id/mute', roomController.toggleMute);

// POST /api/rooms/:id/request-join (mời người vào danh sách chờ)
router.post('/:id/request-join', roomController.requestJoin);

// PUT  /api/rooms/:id/approve      (admin duyệt thành viên)
router.put('/:id/approve', roomController.approveMember);

// PUT  /api/rooms/:id/reject       (admin từ chối thành viên)
router.put('/:id/reject', roomController.rejectMember);

// GET  /api/rooms/:id/pending      (lấy danh sách chờ duyệt)
router.get('/:id/pending', roomController.getPendingMembers);

// PUT  /api/rooms/:id/settings     (admin cập nhật ảnh & thông tin nhóm)
router.put('/:id/settings', roomController.updateGroupSettings);

module.exports = router;
