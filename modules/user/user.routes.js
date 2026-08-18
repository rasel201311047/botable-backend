const express = require('express');
const router = express.Router();
const UserController = require('./user.controller');
const { protect } = require('../../middlewares/auth.middleware');
const { uploadSingle } = require('../../config/upload');

// All routes are protected
router.use(protect);

// User profile
router.get('/profile', UserController.getProfile);
router.put('/profile', UserController.updateProfile);
router.post('/profile-photo', uploadSingle('profilePhoto'), UserController.uploadProfilePhoto);

// Preferences and settings
router.put('/preferences', UserController.updatePreferences);
router.put('/notifications', UserController.updateNotifications);

// User statistics and activity
router.get('/stats', UserController.getUserStats);
router.get('/activity', UserController.getActivityFeed);

// Account management
router.delete('/account', UserController.deleteAccount);

module.exports = router;