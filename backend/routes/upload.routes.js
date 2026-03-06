const router = require('express').Router();
const uploadController = require('../controllers/upload.controller');
const { upload } = require('../config/multer');
const { authMiddleware } = require('../middlewares/auth.middleware');

// Tất cả routes cần xác thực
router.use(authMiddleware);

// POST /api/upload          (upload 1 file)
router.post('/', upload.single('file'), uploadController.uploadFile);

// POST /api/upload/multiple (upload nhiều file, tối đa 5)
router.post('/multiple', upload.array('files', 5), uploadController.uploadFiles);

module.exports = router;
