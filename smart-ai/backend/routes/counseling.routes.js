const router = require('express').Router();
const counselingController = require('../controllers/counseling.controller');
const { authMiddleware } = require('../middlewares/auth.middleware');

router.use(authMiddleware);

router.get('/categories', counselingController.getCategories);
router.post('/sessions', counselingController.createSession);
router.get('/sessions', counselingController.getSessions);

// Expert dashboard (gated by role 'expert' or admin)
router.get('/expert/pending', counselingController.requireExpert, counselingController.listPendingForExpert);
router.get('/expert/mine', counselingController.requireExpert, counselingController.listMineForExpert);

router.get('/sessions/:id', counselingController.getSessionById);
router.put('/sessions/:id/close', counselingController.closeSession);
router.post('/sessions/:id/join', counselingController.joinExpert);
router.put('/sessions/:id/ai', counselingController.toggleAI);

module.exports = router;
