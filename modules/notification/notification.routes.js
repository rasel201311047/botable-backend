const express = require('express');
const router = express.Router();
const notificationController = require('./notification.controller');
const { protect, admin } = require('../../middlewares/auth.middleware');

// Apply authentication to all routes
router.use(protect);

/**
 * @route   GET /api/notifications
 * @desc    Get user notifications with pagination and filters
 * @access  Private
 */
router.get('/', notificationController.getNotifications);

/**
 * @route   GET /api/notifications/unread/count
 * @desc    Get unread notifications count
 * @access  Private
 */
router.get('/unread/count', notificationController.getUnreadCount);

/**
 * @route   GET /api/notifications/:id
 * @desc    Get notification by ID
 * @access  Private
 */
router.get('/:id', notificationController.getNotificationById);

/**
 * @route   PATCH /api/notifications/read-all
 * @desc    Mark all notifications as read
 * @access  Private
 */
router.patch('/read-all', notificationController.markAllAsRead);

/**
 * @route   PATCH /api/notifications/read-many
 * @desc    Mark multiple notifications as read
 * @access  Private
 */
router.patch('/read-many', notificationController.markManyAsRead);

/**
 * @route   PATCH /api/notifications/:id/read
 * @desc    Mark notification as read
 * @access  Private
 */
router.patch('/:id/read', notificationController.markAsRead);

/**
 * @route   DELETE /api/notifications/read
 * @desc    Delete all read notifications
 * @access  Private
 */
router.delete('/read', notificationController.deleteAllRead);
router.patch('/clear-all', notificationController.deleteAllRead);

/**
 * @route   DELETE /api/notifications/:id
 * @desc    Delete notification
 * @access  Private
 */
router.delete('/:id', notificationController.deleteNotification);

// Admin routes
/**
 * @route   POST /api/notifications/custom
 * @desc    Create custom notification (admin only)
 * @access  Admin
 */
router.post('/custom', admin, notificationController.createCustomNotification);

/**
 * @route   POST /api/notifications/bulk
 * @desc    Send bulk notifications to multiple users (admin only)
 * @access  Admin
 */
router.post('/bulk', admin, notificationController.sendBulkNotifications);

// Development/Testing route
/**
 * @route   POST /api/notifications/test
 * @desc    Send test notification (development only)
 * @access  Private
 */
if (process.env.NODE_ENV !== 'production') {
  router.post('/test', notificationController.testNotification);
}

module.exports = router;
