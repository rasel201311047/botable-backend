const express = require('express');
const router = express.Router();
const AuthController = require('./auth.controller');
const { protect } = require('../../middlewares/auth.middleware');

// Public routes
router.post('/register', AuthController.register);
router.post('/signup', AuthController.signupAlias);
router.post('/login', AuthController.login);
router.post('/signin', AuthController.signinAlias);
router.post('/verify-login-otp', AuthController.verifyLoginOTP);
router.post('/send-verification-otp', AuthController.sendVerificationOTP);
router.post('/resend-otp', AuthController.resendOTP);
router.post('/verify-email', AuthController.verifyEmail);
router.post('/verify-otp', AuthController.verifyOtpAlias);
router.post('/forgot-password', AuthController.forgotPassword);
router.post('/resend-forgot-password-otp', AuthController.resendForgotPasswordOTP);
router.post('/reset-password', AuthController.resetPassword);

// Protected routes
router.get('/me', protect, AuthController.getMe);
router.put('/update-profile', protect, AuthController.updateProfile);
router.put('/change-password', protect, AuthController.changePassword);
router.put('/change-email', protect, AuthController.changeEmail);
router.put('/profile-photo', protect, AuthController.updateProfilePhoto);

// Stateless logout endpoint for client-side token/session cleanup
router.post('/logout', (_req, res) => {
  res.status(200).json({
    success: true,
    status: 'success',
    message: 'Logged out successfully',
  });
});

module.exports = router;
