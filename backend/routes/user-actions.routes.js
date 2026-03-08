const router = require('express').Router();
const userActions = require('../controllers/user-actions.controller');
const { authMiddleware } = require('../middlewares/auth.middleware');

router.use(authMiddleware);

// POST /api/user-actions/block/:userId
router.post('/block/:userId', userActions.blockUser);

// DELETE /api/user-actions/block/:userId
router.delete('/block/:userId', userActions.unblockUser);

// GET /api/user-actions/blocked
router.get('/blocked', userActions.getBlockedUsers);

// POST /api/user-actions/report
router.post('/report', userActions.reportUser);

module.exports = router;
