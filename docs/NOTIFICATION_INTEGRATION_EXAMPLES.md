# Notification Integration Examples

This file contains examples of how to integrate the notification service into your existing modules.

## 📦 Import the Notification Service

```javascript
const notificationService = require('../notification/notification.service');
```

---

## 🔔 Subscription Module Integration

### In `subscription.controller.js` or `subscription.service.js`

```javascript
// When subscription is created
const createSubscription = async (userId, planData) => {
  // Create subscription logic
  const subscription = await Subscription.create({
    user: userId,
    plan: planData.planId,
    // ... other fields
  });

  // Send notification
  await notificationService.sendSubscriptionNotification(
    userId,
    'subscription_created',
    {
      planName: planData.planName,
      subscriptionId: subscription._id
    }
  );

  return subscription;
};

// When payment fails
const handlePaymentFailed = async (userId, subscriptionId) => {
  await notificationService.sendSubscriptionNotification(
    userId,
    'payment_failed',
    {
      subscriptionId,
      actionRequired: true
    }
  );
};

// When subscription expires
const handleSubscriptionExpired = async (userId, subscription) => {
  await notificationService.sendSubscriptionNotification(
    userId,
    'subscription_expired',
    {
      planName: subscription.plan.name,
      expiredAt: subscription.endDate
    }
  );
};
```

---

## 💪 Workout Module Integration

### In `workout.controller.js` or `workout.service.js`

```javascript
// When workout is completed
const completeWorkout = async (userId, workoutId) => {
  const workout = await Workout.findById(workoutId);
  
  // Mark as complete
  workout.status = 'completed';
  workout.completedAt = new Date();
  await workout.save();

  // Send notification
  await notificationService.sendWorkoutNotification(
    userId,
    'workout_completed',
    {
      workoutName: workout.name,
      duration: workout.duration,
      caloriesBurned: workout.calories,
      actionUrl: `/workouts/${workoutId}`
    }
  );

  return workout;
};

// Send workout reminder
const sendWorkoutReminder = async (userId, workout) => {
  await notificationService.sendWorkoutNotification(
    userId,
    'workout_reminder',
    {
      workoutName: workout.name,
      scheduledTime: workout.scheduledAt,
      actionUrl: `/workouts/${workout._id}`
    }
  );
};

// New workout plan created
const createWorkoutPlan = async (userId, planData) => {
  const plan = await WorkoutPlan.create(planData);

  await notificationService.sendWorkoutNotification(
    userId,
    'new_workout_plan',
    {
      message: `A new ${planData.name} workout plan is ready for you!`,
      planId: plan._id,
      actionUrl: `/workout-plans/${plan._id}`
    }
  );

  return plan;
};
```

---

## 🍽️ Nutrition/Meal Module Integration

### In `nutrition.controller.js` or `nutrition.service.js`

```javascript
// When meal is logged
const logMeal = async (userId, mealData) => {
  const meal = await Meal.create({
    user: userId,
    ...mealData
  });

  // Send notification
  await notificationService.sendNutritionNotification(
    userId,
    'meal_logged',
    {
      mealType: mealData.type,
      calories: mealData.calories,
      mealId: meal._id,
      actionUrl: `/nutrition/meals/${meal._id}`
    }
  );

  return meal;
};

// Send meal reminder
const sendMealReminder = async (userId, mealType) => {
  await notificationService.sendNutritionNotification(
    userId,
    'meal_reminder',
    {
      message: `Don't forget to log your ${mealType}!`,
      mealType,
      actionUrl: '/nutrition/log-meal'
    }
  );
};

// Nutrition goal reached
const checkNutritionGoal = async (userId, dailyNutrition) => {
  const target = await NutritionTarget.findOne({ user: userId });

  if (dailyNutrition.calories >= target.dailyCalories * 0.95) {
    await notificationService.sendNutritionNotification(
      userId,
      'nutrition_goal_reached',
      {
        message: 'You\'ve reached your daily nutrition goal!',
        achieved: dailyNutrition.calories,
        target: target.dailyCalories,
        actionUrl: '/nutrition/dashboard'
      }
    );
  }
};
```

---

## 🏆 Achievement Module Integration

```javascript
// When user unlocks achievement
const unlockAchievement = async (userId, achievementData) => {
  await notificationService.sendAchievementNotification(userId, {
    message: `You've unlocked: ${achievementData.name}!`,
    achievementId: achievementData.id,
    achievementName: achievementData.name,
    description: achievementData.description,
    points: achievementData.points
  });
};

// Milestone reached
const checkMilestone = async (userId, type, count) => {
  const milestones = {
    workouts: [10, 25, 50, 100],
    meals: [50, 100, 250, 500],
    days: [7, 30, 90, 365]
  };

  if (milestones[type]?.includes(count)) {
    await notificationService.sendAchievementNotification(userId, {
      message: `Milestone reached: ${count} ${type}!`,
      milestoneType: type,
      count
    });
  }
};
```

---

## 😴 Sleep/Recovery Module Integration

```javascript
// When sleep goal is reached
const checkSleepGoal = async (userId, sleepData) => {
  if (sleepData.duration >= sleepData.target) {
    await notificationService.createNotification({
      user: userId,
      type: 'SLEEP_RECOVERY',
      title: 'Sleep Goal Achieved! 😴',
      message: `Great job! You got ${sleepData.duration} hours of sleep.`,
      priority: 'MEDIUM',
      icon: '✅',
      data: {
        duration: sleepData.duration,
        target: sleepData.target,
        quality: sleepData.quality
      },
      actionUrl: '/sleep-recovery'
    });
  }
};

// Recovery score notification
const sendRecoveryScore = async (userId, score) => {
  let priority = 'LOW';
  let message = 'Your recovery score is good.';

  if (score < 50) {
    priority = 'HIGH';
    message = 'Your recovery score is low. Consider taking it easy today.';
  } else if (score < 70) {
    priority = 'MEDIUM';
    message = 'Your recovery score is moderate. Listen to your body.';
  }

  await notificationService.createNotification({
    user: userId,
    type: 'SLEEP_RECOVERY',
    title: `Recovery Score: ${score}/100`,
    message,
    priority,
    icon: '💪',
    data: { score },
    actionUrl: '/sleep-recovery/dashboard'
  });
};
```

---

## 🤖 AI Insights Integration

```javascript
// Send AI-generated insight
const sendAIInsight = async (userId, insight) => {
  await notificationService.createNotification({
    user: userId,
    type: 'AI_INSIGHT',
    title: '💡 New AI Insight',
    message: insight.summary,
    priority: 'MEDIUM',
    icon: '🤖',
    data: {
      insightType: insight.type,
      details: insight.details,
      recommendations: insight.recommendations
    },
    actionUrl: '/ai/insights'
  });
};
```

---

## 📅 Calendar Integration

```javascript
// Event reminder
const sendEventReminder = async (userId, event) => {
  await notificationService.createNotification({
    user: userId,
    type: 'CALENDAR',
    title: 'Upcoming Event',
    message: `${event.title} starts in 30 minutes`,
    priority: 'HIGH',
    icon: '📅',
    data: {
      eventId: event._id,
      eventTitle: event.title,
      startTime: event.startTime
    },
    actionUrl: `/calendar/event/${event._id}`
  });
};
```

---

## 👨‍💼 Admin Notifications

```javascript
// Send notification to specific user (admin action)
const adminNotifyUser = async (userId, notification) => {
  await notificationService.sendSystemNotification(
    userId,
    notification.title,
    notification.message,
    {
      priority: 'HIGH',
      icon: '👨‍💼',
      data: { sentBy: 'admin' },
      actionUrl: notification.actionUrl
    }
  );
};

// Broadcast to all users
const broadcastToAllUsers = async (notification) => {
  const users = await User.find({ isActive: true });
  const userIds = users.map(u => u._id);

  await notificationService.sendBulkNotifications(userIds, {
    type: 'SYSTEM',
    title: notification.title,
    message: notification.message,
    priority: notification.priority || 'MEDIUM',
    icon: '📢'
  });
};
```

---

## ⏰ Scheduled Notifications (with Jobs)

### In `jobs/reminder.job.js`

```javascript
const notificationService = require('../modules/notification/notification.service');

// Daily workout reminder
const sendDailyWorkoutReminders = async () => {
  const users = await User.find({
    isActive: true,
    'preferences.workoutReminders': true
  });

  for (const user of users) {
    const todayWorkout = await Workout.findOne({
      user: user._id,
      scheduledDate: { $gte: startOfDay, $lte: endOfDay },
      status: 'pending'
    });

    if (todayWorkout) {
      await notificationService.sendWorkoutNotification(
        user._id,
        'workout_reminder',
        {
          workoutName: todayWorkout.name,
          scheduledTime: todayWorkout.scheduledTime,
          actionUrl: `/workouts/${todayWorkout._id}`
        }
      );
    }
  }
};

// Daily meal reminders
const sendMealReminders = async () => {
  const users = await User.find({
    isActive: true,
    'preferences.mealReminders': true
  });

  const mealTimes = {
    breakfast: '08:00',
    lunch: '12:00',
    dinner: '18:00'
  };

  const currentHour = new Date().getHours();
  let mealType = null;

  if (currentHour === 8) mealType = 'breakfast';
  else if (currentHour === 12) mealType = 'lunch';
  else if (currentHour === 18) mealType = 'dinner';

  if (mealType) {
    for (const user of users) {
      await notificationService.sendNutritionNotification(
        user._id,
        'meal_reminder',
        {
          message: `Time to log your ${mealType}!`,
          mealType,
          actionUrl: '/nutrition/log-meal'
        }
      );
    }
  }
};

module.exports = {
  sendDailyWorkoutReminders,
  sendMealReminders
};
```

---

## 🎯 Custom Notification Helper

```javascript
// Create a custom notification with all options
const sendCustomNotification = async (options) => {
  const {
    userId,
    type = 'SYSTEM',
    title,
    message,
    priority = 'MEDIUM',
    icon,
    data = {},
    actionUrl,
    expiresAt
  } = options;

  return await notificationService.createNotification({
    user: userId,
    type,
    title,
    message,
    priority,
    icon,
    data,
    actionUrl,
    expiresAt
  });
};

// Usage
await sendCustomNotification({
  userId: '65f123...',
  type: 'SYSTEM',
  title: 'Welcome! 👋',
  message: 'Thank you for joining our platform!',
  priority: 'MEDIUM',
  icon: '🎉',
  data: { newUser: true },
  actionUrl: '/getting-started'
});
```

---

## 🧪 Testing Notifications

```javascript
// Test notification function for development
const testNotifications = async (userId) => {
  // Test subscription notification
  await notificationService.sendSubscriptionNotification(
    userId,
    'subscription_created',
    { planName: 'Premium' }
  );

  // Test workout notification
  await notificationService.sendWorkoutNotification(
    userId,
    'workout_completed',
    { workoutName: 'Morning Run' }
  );

  // Test meal notification
  await notificationService.sendNutritionNotification(
    userId,
    'meal_logged',
    { mealType: 'breakfast' }
  );

  // Test achievement notification
  await notificationService.sendAchievementNotification(userId, {
    message: 'First workout completed!'
  });

  // Test system notification
  await notificationService.sendSystemNotification(
    userId,
    'Test Notification',
    'This is a test notification'
  );
};
```

---

## 📊 Best Practices

1. **Always use try-catch** when sending notifications:
```javascript
try {
  await notificationService.sendWorkoutNotification(userId, type, data);
} catch (error) {
  logger.error(`Failed to send notification: ${error.message}`);
  // Don't let notification failures break the main flow
}
```

2. **Don't block main operations**:
```javascript
// Fire and forget - don't await if not critical
notificationService.sendWorkoutNotification(userId, 'workout_completed', data)
  .catch(err => logger.error(`Notification error: ${err.message}`));
```

3. **Use appropriate priority levels**:
- `URGENT`: Payment failures, account issues
- `HIGH`: Reminders, time-sensitive actions
- `MEDIUM`: Achievements, completions
- `LOW`: Informational updates

4. **Include actionUrl** when applicable to guide users

5. **Set expiresAt** for time-sensitive notifications:
```javascript
const expiresAt = new Date();
expiresAt.setHours(expiresAt.getHours() + 24); // Expires in 24 hours

await notificationService.createNotification({
  user: userId,
  type: 'REMINDER',
  title: 'Limited Time Offer',
  message: '50% off premium plans today only!',
  expiresAt
});
```

---

## 🔄 Migration Script

If you have existing features that should send notifications, add them gradually:

```javascript
// migration-add-notifications.js
const notificationService = require('./modules/notification/notification.service');
const Workout = require('./modules/workout/workout.model');

const migrateWorkoutNotifications = async () => {
  // Find recently completed workouts without notifications
  const recentWorkouts = await Workout.find({
    status: 'completed',
    completedAt: { $gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) }
  });

  for (const workout of recentWorkouts) {
    await notificationService.sendWorkoutNotification(
      workout.user,
      'workout_completed',
      {
        workoutName: workout.name,
        retrospective: true
      }
    );
  }

  console.log(`Sent ${recentWorkouts.length} retrospective notifications`);
};
```

---

This integration guide should help you seamlessly add notifications throughout your application!
