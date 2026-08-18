const notificationService = require('./notification.service');
const logger = require('../../utils/logger');

/**
 * Get user notifications
 * @route GET /api/notifications
 */
exports.getNotifications = async (req, res) => {
  try {
    const userId = req.user._id;
    const { page, limit, read, type, priority, category } = req.query;

    const result = await notificationService.getUserNotifications(userId, {
      page: parseInt(page) || 1,
      limit: parseInt(limit) || 20,
      read: read !== undefined ? read === 'true' : undefined,
      type,
      priority,
      category
    });

    res.status(200).json({
      status: 'success',
      data: result
    });
  } catch (error) {
    logger.error(`Get notifications error: ${error.message}`);
    res.status(500).json({
      status: 'error',
      message: error.message
    });
  }
};

/**
 * Get notification by ID
 * @route GET /api/notifications/:id
 */
exports.getNotificationById = async (req, res) => {
  try {
    const userId = req.user._id;
    const { id } = req.params;

    const notification = await notificationService.getNotificationById(id, userId);

    res.status(200).json({
      status: 'success',
      data: { notification }
    });
  } catch (error) {
    logger.error(`Get notification by ID error: ${error.message}`);
    res.status(error.message === 'Notification not found' ? 404 : 500).json({
      status: 'error',
      message: error.message
    });
  }
};

/**
 * Get unread count
 * @route GET /api/notifications/unread/count
 */
exports.getUnreadCount = async (req, res) => {
  try {
    const userId = req.user._id;
    const count = await notificationService.getUnreadCount(userId);

    res.status(200).json({
      status: 'success',
      data: { count }
    });
  } catch (error) {
    logger.error(`Get unread count error: ${error.message}`);
    res.status(500).json({
      status: 'error',
      message: error.message
    });
  }
};

/**
 * Mark notification as read
 * @route PATCH /api/notifications/:id/read
 */
exports.markAsRead = async (req, res) => {
  try {
    const userId = req.user._id;
    const { id } = req.params;

    const notification = await notificationService.markAsRead(id, userId);

    res.status(200).json({
      status: 'success',
      data: { notification }
    });
  } catch (error) {
    logger.error(`Mark as read error: ${error.message}`);
    res.status(error.message === 'Notification not found' ? 404 : 500).json({
      status: 'error',
      message: error.message
    });
  }
};

/**
 * Mark all notifications as read
 * @route PATCH /api/notifications/read-all
 */
exports.markAllAsRead = async (req, res) => {
  try {
    const userId = req.user._id;
    const result = await notificationService.markAllAsRead(userId);

    res.status(200).json({
      status: 'success',
      message: 'All notifications marked as read',
      data: {
        modifiedCount: result.modifiedCount
      }
    });
  } catch (error) {
    logger.error(`Mark all as read error: ${error.message}`);
    res.status(500).json({
      status: 'error',
      message: error.message
    });
  }
};

/**
 * Mark multiple notifications as read
 * @route PATCH /api/notifications/read-many
 */
exports.markManyAsRead = async (req, res) => {
  try {
    const userId = req.user._id;
    const { notificationIds } = req.body;

    if (!Array.isArray(notificationIds) || notificationIds.length === 0) {
      return res.status(400).json({
        status: 'error',
        message: 'notificationIds array is required'
      });
    }

    const result = await notificationService.markManyAsRead(userId, notificationIds);

    res.status(200).json({
      status: 'success',
      message: 'Notifications marked as read',
      data: {
        modifiedCount: result.modifiedCount
      }
    });
  } catch (error) {
    logger.error(`Mark many as read error: ${error.message}`);
    res.status(500).json({
      status: 'error',
      message: error.message
    });
  }
};

/**
 * Delete notification
 * @route DELETE /api/notifications/:id
 */
exports.deleteNotification = async (req, res) => {
  try {
    const userId = req.user._id;
    const { id } = req.params;

    await notificationService.deleteNotification(id, userId);

    res.status(200).json({
      status: 'success',
      message: 'Notification deleted successfully'
    });
  } catch (error) {
    logger.error(`Delete notification error: ${error.message}`);
    res.status(error.message === 'Notification not found' ? 404 : 500).json({
      status: 'error',
      message: error.message
    });
  }
};

/**
  * Clear all read notifications
  * @route DELETE /api/notifications/read
  */
exports.deleteAllRead = async (req, res) => {
  try {
    const userId = req.user._id;
    const result = await notificationService.deleteAllRead(userId);

    res.status(200).json({
      status: 'success',
      message: 'All read notifications cleared',
      data: {
        modifiedCount: result.modifiedCount
      }
    });
  } catch (error) {
    logger.error(`Delete all read error: ${error.message}`);
    res.status(500).json({
      status: 'error',
      message: error.message
    });
  }
};

/**
 * Create custom notification (admin only)
 * @route POST /api/notifications/custom
 */
exports.createCustomNotification = async (req, res) => {
  try {
    const { userId, type, title, message, priority, data, actionUrl } = req.body;

    if (!userId || !title || !message) {
      return res.status(400).json({
        status: 'error',
        message: 'userId, title, and message are required'
      });
    }

    const notification = await notificationService.createNotification({
      userId,
      type: type || 'SYSTEM',
      category: 'system',
      title,
      message,
      priority: priority || 'MEDIUM',
      data,
      deepLink: actionUrl,
      sourceModule: 'admin',
      dedupeKey: `admin:${userId}:${title}`,
    });

    res.status(201).json({
      status: 'success',
      data: { notification }
    });
  } catch (error) {
    logger.error(`Create custom notification error: ${error.message}`);
    res.status(500).json({
      status: 'error',
      message: error.message
    });
  }
};

/**
 * Send bulk notifications (admin only)
 * @route POST /api/notifications/bulk
 */
exports.sendBulkNotifications = async (req, res) => {
  try {
    const { userIds, type, title, message, priority, data, actionUrl } = req.body;

    if (!Array.isArray(userIds) || userIds.length === 0) {
      return res.status(400).json({
        status: 'error',
        message: 'userIds array is required'
      });
    }

    if (!title || !message) {
      return res.status(400).json({
        status: 'error',
        message: 'title and message are required'
      });
    }

    const notifications = await notificationService.sendBulkNotifications(userIds, {
      type: type || 'SYSTEM',
      title,
      message,
      priority: priority || 'MEDIUM',
      data,
      actionUrl,
    });

    res.status(201).json({
      status: 'success',
      message: `Bulk notifications sent to ${notifications.length} users`,
      data: {
        count: notifications.length
      }
    });
  } catch (error) {
    logger.error(`Send bulk notifications error: ${error.message}`);
    res.status(500).json({
      status: 'error',
      message: error.message
    });
  }
};

/**
 * Test notification (development only)
 * @route POST /api/notifications/test
 */
exports.testNotification = async (req, res) => {
  try {
    if (process.env.NODE_ENV === 'production') {
      return res.status(403).json({
        status: 'error',
        message: 'Test notifications are not allowed in production'
      });
    }

    const userId = req.user._id;
    const { type = 'SYSTEM', title = 'Test Notification', message = 'This is a test notification', priority = 'MEDIUM' } = req.body;

    const notification = await notificationService.createNotification({
      user: userId,
      type,
      title,
      message,
      priority,
      icon: '🧪',
      data: { test: true }
    });

    res.status(201).json({
      status: 'success',
      message: 'Test notification sent',
      data: { notification }
    });
  } catch (error) {
    logger.error(`Test notification error: ${error.message}`);
    res.status(500).json({
      status: 'error',
      message: error.message
    });
  }
};
