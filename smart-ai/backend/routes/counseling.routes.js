const router = require('express').Router();
const counselingController = require('../controllers/counseling.controller');
const { authMiddleware } = require('../middlewares/auth.middleware');

router.use(authMiddleware);

router.get('/categories', counselingController.getCategories);
router.post('/sessions', counselingController.createSession);
router.get('/sessions', counselingController.getSessions);
router.get('/sessions/:id', counselingController.getSessionById);
router.post('/sessions/:id/messages', counselingController.sendMessage);
router.put('/sessions/:id/close', counselingController.closeSession);

module.exports = router;
