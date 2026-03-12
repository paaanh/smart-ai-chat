const router = require('express').Router();
const { authMiddleware } = require('../middlewares/auth.middleware');
const noteController = require('../controllers/note.controller');

router.use(authMiddleware);

// GET  /api/notes          (lấy notes của bạn bè)
router.get('/', noteController.getFriendNotes);

// POST /api/notes           (tạo note mới)
router.post('/', noteController.createNote);

// DELETE /api/notes/:id     (xóa note)
router.delete('/:id', noteController.deleteNote);

// POST /api/notes/:id/reply (trả lời note)
router.post('/:id/reply', noteController.replyNote);

module.exports = router;
