const Notification = require('./notification.model');
const socketService = require('../../config/socket');
const logger = require('../../utils/logger');

/**
 * Create and send notification to user
 */
const createNotification = async notificationData => {
  try {
    const normalized = {
      priority: 'MEDIUM',
      category: 'system',
      lifecycleState: 'active',
      ...notificationData,
    };

    const userId = normalized.userId || normalized.user;
    const dedupeKey = normalized.dedupeKey || null;

    if (!userId) {
      throw new Error('userId is required');
    }

    if (dedupeKey) {
      const existing = await Notification.findOne({
        userId,
        dedupeKey,
        lifecycleState: { $ne: 'dismissed' },
      });

      if (existing) {
        existing.title = normalized.title;
        existing.message = normalized.message;
        existing.data = normalized.data || existing.data;
        existing.payload = normalized.payload || existing.payload;
        existing.priority = normalized.priority;
        existing.category = normalized.category;
        existing.sourceModule = normalized.sourceModule;
        existing.sourceId = normalized.sourceId ?? existing.sourceId;
        existing.deepLink = normalized.deepLink || normalized.actionUrl || existing.deepLink;
        existing.lifecycleState = 'active';
        await existing.save();

        socketService.sendNotification(userId.toString(), {
          id: existing._id,
          type: existing.type,
          category: existing.category,
          title: existing.title,
          message: existing.message,
          data: existing.data,
          priority: existing.priority,
          deepLink: existing.deepLink,
          sourceModule: existing.sourceModule,
          sourceId: existing.sourceId,
          createdAt: existing.createdAt,
        });

        return existing;
      }
    }

    const notification = await Notification.create({
      ...normalized,
      userId,
    });

    // Send real-time notification via Socket.IO
    socketService.sendNotification(userId.toString(), {
      id: notification._id,
      type: notification.type,
      category: notification.category,
      title: notification.title,
      message: notification.message,
      data: notification.data,
      priority: notification.priority,
      deepLink: notification.deepLink || notification.actionUrl,
      sourceModule: notification.sourceModule,
      sourceId: notification.sourceId,
      createdAt: notification.createdAt,
    });

    return notification;
  } catch (error) {
    logger.error(`Create notification error: ${error.message}`);
    throw error;
  }
};

/**
 * Get user notifications with pagination
 */
const getUserNotifications = async (userId, options = {}) => {
  const { page = 1, limit = 20, read, type, priority, category } = options;

  const query = { userId, lifecycleState: { $ne: 'archived' } };

  if (read !== undefined) {
    query.read = read;
  }

  if (type) {
    query.type = type;
  }

  if (priority) {
    query.priority = priority;
  }

  if (category) {
    query.category = category;
  }

  const skip = (page - 1) * limit;

  const [notifications, total] = await Promise.all([
    Notification.find(query).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
    Notification.countDocuments(query),
  ]);

  return {
    notifications,
    pagination: {
      page: parseInt(page),
      limit: parseInt(limit),
      total,
      pages: Math.ceil(total / limit),
    },
    unreadCount: await Notification.getUnreadCount(userId),
    categoryCounts: await Notification.getCategoryCounts(userId),
  };
};

/**
 * Get notification by ID
 */
const getNotificationById = async (notificationId, userId) => {
  const notification = await Notification.findOne({
    _id: notificationId,
    userId,
  });

  if (!notification) {
    throw new Error('Notification not found');
  }

  return notification;
};

/**
 * Mark notification as read
 */
const markAsRead = async (notificationId, userId) => {
  const notification = await getNotificationById(notificationId, userId);
  await notification.markAsRead();

  // Emit event to update UI
  socketService.emitToUser(userId, 'notification_read', {
    notificationId: notification._id,
    readAt: notification.readAt,
  });

  return notification;
};

/**
 * Mark all notifications as read
 */
const markAllAsRead = async userId => {
  const result = await Notification.updateMany(
    { userId, read: false, lifecycleState: { $ne: 'dismissed' } },
    {
      $set: {
        read: true,
        readAt: new Date(),
        lifecycleState: 'read',
      },
    },
  );

  // Emit event to update UI
  socketService.emitToUser(userId, 'all_notifications_read', {
    count: result.modifiedCount,
  });

  return result;
};

/**
 * Mark multiple notifications as read
 */
const markManyAsRead = async (userId, notificationIds) => {
  const result = await Notification.markManyAsRead(userId, notificationIds);

  // Emit event to update UI
  socketService.emitToUser(userId, 'notifications_read', {
    notificationIds,
    count: result.modifiedCount,
  });

  return result;
};

/**
 * Delete notification
 */
const deleteNotification = async (notificationId, userId) => {
  const notification = await getNotificationById(notificationId, userId);
  await notification.dismiss();

  // Emit event to update UI
  socketService.emitToUser(userId, 'notification_deleted', {
    notificationId: notification._id,
  });

  return { message: 'Notification deleted successfully' };
};

/**
 * Delete all read notifications
 */
const deleteAllRead = async userId => {
  const result = await Notification.dismissMany(userId);

  // Emit event to update UI
  socketService.emitToUser(userId, 'read_notifications_deleted', {
    count: result.modifiedCount,
  });

  return result;
};

/**
 * Get unread count
 */
const getUnreadCount = async userId => {
  return await Notification.getUnreadCount(userId);
};

/**
 * Clear all notifications without deleting them
 */
const clearAll = async userId => {
  const result = await Notification.dismissMany(userId);

  socketService.emitToUser(userId, 'notifications_cleared', {
    count: result.modifiedCount,
  });

  return result;
};

/**
 * Send bulk notifications to multiple users
 */
const sendBulkNotifications = async (userIds, notificationData) => {
  const notifications = userIds.map(userId => ({
    ...notificationData,
    userId,
  }));

  const created = await Notification.insertMany(notifications);

  // Send real-time notifications to all users
  created.forEach(notification => {
    socketService.sendNotification(notification.userId.toString(), {
      id: notification._id,
      type: notification.type,
      category: notification.category,
      title: notification.title,
      message: notification.message,
      data: notification.data,
      priority: notification.priority,
      deepLink: notification.deepLink || notification.actionUrl,
      sourceModule: notification.sourceModule,
      sourceId: notification.sourceId,
      createdAt: notification.createdAt,
    });
  });

  return created;
};

/**
 * Create notification for subscription events
 */
const sendSubscriptionNotification = async (userId, eventType, data = {}) => {
  const notifications = {
    subscription_created: {
      title: 'Subscription Activated',
      message: `Your ${data.planName} subscription is now active!`,
      icon: '🎉',
    },
    subscription_renewed: {
      title: 'Subscription Renewed',
      message: `Your ${data.planName} subscription has been renewed.`,
      icon: '🔄',
    },
    subscription_cancelled: {
      title: 'Subscription Cancelled',
      message: 'Your subscription has been cancelled.',
      icon: '⚠️',
    },
    subscription_expired: {
      title: 'Subscription Expired',
      message: 'Your subscription has expired. Renew to continue enjoying premium features.',
      icon: '⏰',
      priority: 'HIGH',
    },
    payment_failed: {
      title: 'Payment Failed',
      message: 'Your payment could not be processed. Please update your payment method.',
      icon: '❌',
      priority: 'URGENT',
    },
  };

  const notification = notifications[eventType];

    if (notification) {
      return await createNotification({
        userId,
        type: 'SUBSCRIPTION',
        category: 'subscription',
        ...notification,
        data,
        deepLink: '/subscription',
        sourceModule: 'subscription',
        sourceId: data.subscriptionId || null,
        dedupeKey: `subscription:${eventType}:${data.subscriptionId || 'general'}`,
      });
    }
};

/**
 * Create notification for workout events
 */
const sendWorkoutNotification = async (userId, eventType, data = {}) => {
  const notifications = {
    workout_completed: {
      title: 'Workout Completed! 💪',
      message: `Great job! You've completed ${data.workoutName || 'your workout'}.`,
      icon: '✅',
    },
    workout_reminder: {
      title: 'Workout Reminder',
      message: `Time for your workout: ${data.workoutName || 'scheduled workout'}`,
      icon: '⏰',
      priority: 'HIGH',
    },
    new_workout_plan: {
      title: 'New Workout Plan Available',
      message: data.message || 'A new workout plan has been created for you.',
      icon: '📋',
    },
  };

  const notification = notifications[eventType];

  if (notification) {
    return await createNotification({
      userId,
      type: 'WORKOUT',
      category: 'workout',
      ...notification,
      data,
      deepLink: data.actionUrl || '/workout',
      sourceModule: 'workout',
      sourceId: data.workoutId || data.logId || null,
      dedupeKey: `workout:${eventType}:${data.workoutId || data.workoutName || 'general'}`,
    });
  }
};

/**
 * Create notification for meal/nutrition events
 */
const sendNutritionNotification = async (userId, eventType, data = {}) => {
  const notifications = {
    meal_logged: {
      title: 'Meal Logged',
      message: 'Your meal has been successfully logged.',
      icon: '🍽️',
    },
    meal_reminder: {
      title: 'Meal Reminder',
      message: data.message || 'Time for your next meal!',
      icon: '🔔',
      priority: 'MEDIUM',
    },
    nutrition_goal_reached: {
      title: 'Goal Achieved! 🎯',
      message: data.message || "You've reached your nutrition goal for today!",
      icon: '⭐',
    },
  };

  const notification = notifications[eventType];

  if (notification) {
    return await createNotification({
      userId,
      type: 'MEAL',
      category: 'meal',
      ...notification,
      data,
      deepLink: data.actionUrl || '/home',
      sourceModule: 'nutrition',
      sourceId: data.mealId || data.mealSessionId || null,
      dedupeKey: `meal:${eventType}:${data.mealSessionId || data.mealType || 'general'}`,
    });
  }
};

/**
 * Create notification for achievement events
 */
const sendAchievementNotification = async (userId, data) => {
  return await createNotification({
    userId,
    type: 'ACHIEVEMENT',
    category: 'system',
    title: 'New Achievement Unlocked! 🏆',
    message: data.message || 'Congratulations on your achievement!',
    priority: 'MEDIUM',
    data,
    sourceModule: 'ai',
    deepLink: '/home',
    dedupeKey: `achievement:${data.key || data.message || 'general'}`,
  });
};

/**
 * Send system notification to user
 */
const sendSystemNotification = async (userId, title, message, options = {}) => {
  return await createNotification({
    userId,
    type: 'SYSTEM',
    category: options.category || 'system',
    title,
    message,
    priority: options.priority || 'MEDIUM',
    data: options.data || {},
    sourceModule: options.sourceModule || 'system',
    sourceId: options.sourceId || null,
    deepLink: options.deepLink || options.actionUrl || null,
    dedupeKey: options.dedupeKey || `${title}:${message}`,
  });
};

module.exports = {
  createNotification,
  getUserNotifications,
  getNotificationById,
  markAsRead,
  markAllAsRead,
  markManyAsRead,
  deleteNotification,
  deleteAllRead,
  clearAll,
  getUnreadCount,
  sendBulkNotifications,
  sendSubscriptionNotification,
  sendWorkoutNotification,
  sendNutritionNotification,
  sendAchievementNotification,
  sendSystemNotification,
};
