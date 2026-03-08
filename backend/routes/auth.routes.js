const router = require('express').Router();
const authController = require('../controllers/auth.controller');
const { authMiddleware } = require('../middlewares/auth.middleware');

// POST /api/auth/register
router.post('/register', authController.register);

// POST /api/auth/send-register-otp
router.post('/send-register-otp', authController.sendRegisterOTP);

// POST /api/auth/login
router.post('/login', authController.login);

// GET /api/auth/me  (cần token)
router.get('/me', authMiddleware, authController.getMe);

// ─── Forgot password flow ──────────────────────────────────────────
router.post('/forgot-password', authController.forgotPassword);
router.post('/verify-otp', authController.verifyOTP);
router.post('/reset-password', authController.resetPassword);

// ─── Google OAuth2 ─────────────────────────────────────────────────
router.post('/google', authController.googleLogin);

module.exports = router;
