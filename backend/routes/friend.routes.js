const router = require('express').Router();
const friendController = require('../controllers/friend.controller');
const { authMiddleware } = require('../middlewares/auth.middleware');

router.use(authMiddleware);

// GET /api/friends              (danh sách bạn bè)
router.get('/', friendController.getFriends);

// GET /api/friends/requests     (lời mời kết bạn nhận được)
router.get('/requests', friendController.getRequests);

// GET /api/friends/sent         (lời mời đã gửi)
router.get('/sent', friendController.getSentRequests);

// GET /api/friends/status/:userId  (trạng thái kết bạn với 1 user)
router.get('/status/:userId', friendController.getStatus);

// POST /api/friends/request     (gửi lời mời kết bạn)
router.post('/request', friendController.sendRequest);

// PUT /api/friends/:id/accept   (chấp nhận lời mời)
router.put('/:id/accept', friendController.acceptRequest);

// PUT /api/friends/:id/reject   (từ chối lời mời)
router.put('/:id/reject', friendController.rejectRequest);

// DELETE /api/friends/:id       (hủy kết bạn / hủy lời mời)
router.delete('/:id', friendController.removeFriend);

module.exports = router;
