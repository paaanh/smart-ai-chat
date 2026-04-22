const router = require('express').Router();
const topicController = require('../controllers/topic.controller');
const { authMiddleware } = require('../middlewares/auth.middleware');

router.use(authMiddleware);

router.post('/', topicController.createTopic);
router.get('/', topicController.getTopics);
router.get('/my', topicController.getMyTopics);
router.get('/:id', topicController.getTopicById);
router.post('/:id/join', topicController.joinTopic);
router.delete('/:id/leave', topicController.leaveTopic);
router.put('/:id/settings', topicController.updateTopicSettings);

module.exports = router;
