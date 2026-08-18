# Automatic Notification Integration Guide

## Overview
This guide shows how to automatically trigger notifications from your existing controllers when users perform actions like completing workouts, logging meals, achieving goals, etc. The notification functions will be called automatically as part of your server workflow.

## Current Notification Functions Available

### 1. `sendWorkoutNotification(userId, eventType, data)`
- **workout_completed**: When user finishes a workout
- **workout_reminder**: Scheduled workout reminders
- **new_workout_plan**: New workout plan assigned

### 2. `sendNutritionNotification(userId, eventType, data)`
- **meal_logged**: When user logs a meal
- **meal_reminder**: Meal time reminders
- **nutrition_goal_reached**: When nutrition goals are achieved
- **nutrition_goal_reached**: When nutrition achived of batter sized of collection

### 3. `sendAchievementNotification(userId, data)`
- **General achievements**: Custom achievement notifications


### 4. `sendAcipment of Notifaction(UserId, data)

### 4. `sendSystemNotification(userId, title, message, options)`
- **System messages**: Maintenance, updates, important announcements

## Integration Points

### 1. Workout Completion Notifications

**File:** `modules/workout/workout.controller.js`
**Function:** `logWorkout` (when completionPercentage >= 100)

```javascript
// Add to existing logWorkout function
static async logWorkout(req, res, next) {
  try {
    // ... existing code ...

    const workoutLog = await WorkoutService.logWorkout(req.user.id, {
      // ... existing parameters ...
    });

    // ADD: Send workout completion notification
    if (completionPercentage >= 100) {
      const notificationService = require('../notification/notification.service');
      await notificationService.sendWorkoutNotification(req.user.id, 'workout_completed', {
        workoutName: workoutLog.workout?.title || 'Workout',
        duration: workoutLog.durationMinutes,
        caloriesBurned: workoutLog.caloriesBurned,
        completionDate: workoutLog.actualEndTime
      });
    }

    res.status(201).json({
      status: 'success',
      message: 'Workout logged successfully',
      data: workoutLog
    });
  } catch (error) {
    next(error);
  }
}
```

### 2. Meal Logging Notifications

**File:** `nutrition/nutrition.controller.js`
**Function:** `addMeal`

```javascript
// Add to existing addMeal function
static async addMeal(req, res, next) {
  try {
    // ... existing code ...

    const meal = await NutritionService.addMeal(req.user.id, {
      // ... existing parameters ...
    });

    // ADD: Send meal logged notification
    const notificationService = require('../modules/notification/notification.service');
    await notificationService.sendNutritionNotification(req.user.id, 'meal_logged', {
      mealType: meal.mealType,
      foodName: meal.food?.description || meal.title,
      calories: Math.round(meal.calories),
      protein: Math.round(meal.protein || 0),
      carbs: Math.round(meal.carbs || 0),
      fat: Math.round(meal.fat || 0)
    });

    res.status(201).json({
      status: 'success',
      message: 'Meal added successfully',
      data: { meal }
    });
  } catch (error) {
    next(error);
  }
}
```

### 3. Sleep/Recovery Activity Notifications

**File:** `modules/sleep-recovery/sleepRecovery.controller.js`
**Function:** `logActivity`

```javascript
// Add to existing logActivity function
static async logActivity(req, res, next) {
  try {
    // ... existing code ...

    const sleepLog = await SleepRecoveryService.logActivity(req.user.id, {
      // ... existing parameters ...
    });

    // ADD: Send sleep/recovery notification
    const notificationService = require('../notification/notification.service');

    if (activityKey === 'sleep') {
      // Sleep quality notification
      if (quality >= 8) {
        await notificationService.sendSystemNotification(
          req.user.id,
          'Excellent Sleep! 🌙',
          `You got ${sleepLog.durationHours} hours of quality sleep. Great recovery!`,
          { icon: '😴', priority: 'LOW' }
        );
      } else if (quality <= 4) {
        await notificationService.sendSystemNotification(
          req.user.id,
          'Sleep Quality Alert',
          'Consider improving your sleep hygiene for better recovery.',
          { icon: '⚠️', priority: 'MEDIUM' }
        );
      }
    } else {
      // Other recovery activities
      await notificationService.sendSystemNotification(
        req.user.id,
        'Recovery Activity Completed',
        `Great job completing your ${activityKey} session!`,
        { icon: '💪', priority: 'LOW' }
      );
    }

    res.status(201).json({
      status: 'success',
      message: 'Activity logged successfully',
      data: sleepLog
    });
  } catch (error) {
    next(error);
  }
}
```

### 4. Subscription Event Notifications

**File:** `modules/subscription/subscription.controller.js`
**Function:** Various subscription functions

```javascript
// Add to subscription success/cancellation functions
static async handleSubscriptionSuccess(req, res, next) {
  try {
    // ... existing subscription creation logic ...

    // ADD: Send subscription activated notification
    const notificationService = require('../notification/notification.service');
    await notificationService.sendSubscriptionNotification(req.user.id, 'subscription_created', {
      planName: subscription.plan.name,
      amount: subscription.plan.price,
      interval: subscription.plan.interval
    });

    res.status(200).json({
      status: 'success',
      message: 'Subscription activated successfully'
    });
  } catch (error) {
    next(error);
  }
}

// Add to subscription cancellation
static async cancelSubscription(req, res, next) {
  try {
    // ... existing cancellation logic ...

    // ADD: Send subscription cancelled notification
    const notificationService = require('../notification/notification.service');
    await notificationService.sendSubscriptionNotification(req.user.id, 'subscription_cancelled', {
      planName: subscription.plan.name,
      cancelledAt: new Date()
    });

    res.status(200).json({
      status: 'success',
      message: 'Subscription cancelled successfully'
    });
  } catch (error) {
    next(error);
  }
}
```

### 5. Achievement Notifications

**File:** `modules/user/user.controller.js` or create achievement tracking

```javascript
// Example: Track workout streaks and send achievement notifications
static async checkAchievements(req, res, next) {
  try {
    const userId = req.user.id;
    const notificationService = require('../notification/notification.service');

    // Check workout streak
    const workoutCount = await WorkoutLog.countDocuments({
      user: userId,
      completed: true,
      actualEndTime: { $gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) }
    });

    if (workoutCount === 7) {
      await notificationService.sendAchievementNotification(userId, {
        title: 'Week Warrior! 🏆',
        message: 'You completed 7 workouts this week! Keep it up!',
        type: 'streak',
        value: 7,
        unit: 'workouts'
      });
    }

    // Check nutrition goals
    const todayMeals = await Meal.countDocuments({
      user: userId,
      date: new Date().toISOString().split('T')[0]
    });

    if (todayMeals >= 3) {
      await notificationService.sendNutritionNotification(userId, 'nutrition_goal_reached', {
        goal: 'meals_per_day',
        achieved: todayMeals,
        target: 3,
        message: 'You\'ve logged all your meals today!'
      });
    }

    res.status(200).json({
      status: 'success',
      message: 'Achievements checked'
    });
  } catch (error) {
    next(error);
  }
}
```

### 6. Goal Achievement Notifications

**File:** `modules/onboarding/onboarding.controller.js` or goal tracking

```javascript
// Example: When user achieves their target weight/goal
static async updateProgress(req, res, next) {
  try {
    const { goalId, currentValue } = req.body;
    const notificationService = require('../notification/notification.service');

    // ... existing progress update logic ...

    // Check if goal is achieved
    if (currentValue >= goal.targetValue) {
      await notificationService.sendAchievementNotification(req.user.id, {
        title: 'Goal Achieved! 🎯',
        message: `Congratulations! You've reached your ${goal.type} goal of ${goal.targetValue} ${goal.unit}!`,
        type: 'goal_achievement',
        goalType: goal.type,
        achievedValue: currentValue,
        targetValue: goal.targetValue
      });
    }

    res.status(200).json({
      status: 'success',
      message: 'Progress updated successfully'
    });
  } catch (error) {
    next(error);
  }
}
```

## System-Level Notifications

### 1. Scheduled Reminders (Background Jobs)

**File:** `jobs/reminder.job.js`

```javascript
// Add to existing reminder job
const sendWorkoutReminders = async () => {
  // ... existing reminder logic ...

  // ADD: Send workout reminder notification
  const notificationService = require('../modules/notification/notification.service');
  await notificationService.sendWorkoutNotification(userId, 'workout_reminder', {
    workoutName: scheduledWorkout.title,
    scheduledTime: scheduledWorkout.scheduledTime,
    reminderTime: new Date()
  });
};

const sendMealReminders = async () => {
  // ... existing meal reminder logic ...

  // ADD: Send meal reminder notification
  const notificationService = require('../modules/notification/notification.service');
  await notificationService.sendNutritionNotification(userId, 'meal_reminder', {
    mealType: nextMealType,
    scheduledTime: mealSchedule.time,
    reminderTime: new Date()
  });
};
```

### 2. Maintenance/System Notifications

**File:** `jobs/system.job.js` or admin controller

```javascript
// System maintenance notifications
const sendMaintenanceNotification = async () => {
  const notificationService = require('../modules/notification/notification.service');
  const users = await User.find({ isActive: true });

  for (const user of users) {
    await notificationService.sendSystemNotification(
      user._id,
      'Scheduled Maintenance',
      'The app will be undergoing maintenance tonight from 2-4 AM. Some features may be unavailable.',
      {
        icon: '🔧',
        priority: 'MEDIUM',
        actionUrl: '/maintenance'
      }
    );
  }
};
```

## Implementation Checklist

### ✅ Completed Integrations:
- [ ] Workout completion notifications
- [ ] Meal logging notifications
- [ ] Sleep/recovery activity notifications
- [ ] Subscription event notifications
- [ ] Achievement notifications
- [ ] Goal achievement notifications
- [ ] System maintenance notifications
- [ ] Scheduled reminders

### Required Imports:
Add to each controller file:
```javascript
const notificationService = require('../notification/notification.service');
// or
const notificationService = require('../../modules/notification/notification.service');
```

### Error Handling:
All notification calls should be wrapped in try-catch or made non-blocking:
```javascript
try {
  await notificationService.sendWorkoutNotification(userId, 'workout_completed', data);
} catch (notificationError) {
  logger.error('Failed to send notification:', notificationError);
  // Don't fail the main operation
}
```

### Testing:
1. Perform the action (complete workout, log meal, etc.)
2. Check database for notification record
3. Verify Socket.IO event emission
4. Test real-time delivery in frontend

## Benefits

- **Real-time User Engagement**: Users get instant feedback on their actions
- **Motivation**: Achievement notifications encourage continued progress
- **Reminders**: Automated reminders for workouts and meals
- **System Communication**: Important updates and maintenance notices
- **Personalization**: Context-specific messages with relevant data

This implementation ensures your notification system works automatically as part of your existing server workflow, providing users with timely and relevant updates about their fitness journey.