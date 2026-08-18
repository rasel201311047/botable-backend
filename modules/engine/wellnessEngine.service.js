const User = require('../user/user.model');
const Shift = require('../onboarding/shift.model');
const Goal = require('../onboarding/goal.model');
const NutritionTarget = require('../../nutrition/nutritionTarget.model');
const DailyNutritionSummary = require('../../nutrition/dailyNutritionSummary.model');
const WorkoutLog = require('../workout/workoutLog.model');
const SleepLog = require('../sleep-recovery/sleepLog.model');
const UserShiftSchedule = require('../calendar/calendar.model');
const NotificationService = require('../notification/notification.service');
const Notification = require('../notification/notification.model');
const { calculateNutritionTargets, calculateProgress, calculateRemaining } = require('../../utils/macros');
const { calculateSleepScore } = require('../../utils/sleepScore');
const { calculateRecoveryScore } = require('../../utils/recoveryScore');
const { calculateReadinessScore } = require('../../utils/readinessScore');
const logger = require('../../utils/logger');

class WellnessEngine {
  static async recordEvent(event) {
    const {
      userId,
      type,
      category,
      title,
      message,
      sourceModule,
      sourceId,
      deepLink,
      priority = 'medium',
      lifecycleState = 'active',
      dedupeKey,
      payload = {},
    } = event;

    if (!userId || !type || !category || !title || !message || !sourceModule) {
      return null;
    }

    return NotificationService.createNotification({
      userId,
      type,
      category,
      title,
      message,
      sourceModule,
      sourceId,
      deepLink,
      priority,
      lifecycleState,
      dedupeKey,
      payload,
    });
  }

  static async buildContext(userId) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const [user, shift, goal, targets, nutrition, workouts, sleepLogs, unreadCount, schedule] =
      await Promise.all([
        User.findById(userId).select('-password'),
        User.findById(userId).then(async u => (u?.shiftType ? Shift.findOne({ name: u.shiftType }) : null)),
        User.findById(userId).then(async u => (u?.goalType ? Goal.findOne({ name: u.goalType }) : null)),
        NutritionTarget.findOne({ userId }),
        DailyNutritionSummary.findOne({ userId, date: { $gte: today, $lt: tomorrow } }),
        WorkoutLog.find({ userId, date: { $gte: today, $lt: tomorrow }, completed: true }).populate(
          'workoutId',
          'title category durationMinutes intensity',
        ),
        SleepLog.find({ userId, date: { $gte: today, $lt: tomorrow } }),
        Notification.countDocuments({ userId, read: false, lifecycleState: { $ne: 'dismissed' } }),
        UserShiftSchedule.findOne({ userId, date: today }),
      ]);

    const sleepTotalHours = sleepLogs.reduce((sum, log) => sum + (log.durationMinutes || 0) / 60, 0);
    const sleepQuality = sleepLogs.some(log => log.quality === 'good')
      ? 'good'
      : sleepLogs.some(log => log.quality === 'average')
        ? 'average'
        : sleepLogs.length
          ? 'poor'
          : 'no_data';
    const sleepScore = sleepLogs.length ? calculateSleepScore(sleepTotalHours, sleepQuality) : 0;
    const workoutCount = workouts.length;
    const workoutIntensity = workouts.some(w => w.intensity === 'high')
      ? 'high'
      : workouts.some(w => w.intensity === 'medium')
        ? 'medium'
        : 'low';
    const recoveryScore = calculateRecoveryScore({
      sleepScore,
      workoutsToday: workoutCount,
      workoutIntensity,
      recoveryActivities: sleepLogs.length,
      consecutiveWorkoutDays: workoutCount > 0 ? 1 : 0,
      stressLevel: sleepScore < 50 ? 'high' : 'medium',
    });
    const readiness = calculateReadinessScore({
      recoveryScore,
      nutritionAdherence:
        nutrition && targets ? calculateProgress(nutrition.calories, targets.calorieTarget) : 0,
      sleepConsistency: sleepLogs.length ? 100 : 0,
      hrvScore: 0,
    });

    return {
      user,
      shift,
      goal,
      targets,
      nutrition,
      workouts,
      sleepLogs,
      unreadNotificationCount: unreadCount,
      schedule,
      scores: {
        sleep: sleepScore,
        recovery: recoveryScore,
        readiness,
      },
      macroProgress:
        targets && nutrition
          ? {
              calories: calculateProgress(nutrition.calories, targets.calorieTarget),
              protein: calculateProgress(nutrition.protein, targets.proteinTarget),
              carbs: calculateProgress(nutrition.carbs, targets.carbTarget),
              fat: calculateProgress(nutrition.fat, targets.fatTarget),
            }
          : null,
      macroRemaining:
        targets && nutrition
          ? {
              calories: calculateRemaining(nutrition.calories, targets.calorieTarget),
              protein: calculateRemaining(nutrition.protein, targets.proteinTarget),
              carbs: calculateRemaining(nutrition.carbs, targets.carbTarget),
              fat: calculateRemaining(nutrition.fat, targets.fatTarget),
            }
          : null,
    };
  }

  static async buildActionPlan(userId) {
    const context = await this.buildContext(userId);
    const actions = [];

    if (context.macroRemaining?.protein > 0) {
      actions.push({
        title: 'Hit protein target',
        type: 'nutrition',
        reason: 'Protein is still below target today.',
        priority: 'high',
        deepLink: '/home',
      });
    }

    if (context.scores.readiness < 50) {
      actions.push({
        title: 'Reduce workout intensity',
        type: 'recovery',
        reason: 'Readiness is low and recovery should come first.',
        priority: 'high',
        deepLink: '/workout',
      });
    }

    if (!context.sleepLogs.length) {
      actions.push({
        title: 'Log sleep',
        type: 'sleep',
        reason: 'No sleep data has been logged for today.',
        priority: 'medium',
        deepLink: '/sleeprecovery',
      });
    }

    return {
      now: actions.slice(0, 2),
      later: actions.slice(2, 4),
      skip:
        context.scores.readiness > 70
          ? []
          : [{ title: 'Skip hard training', reason: 'Recovery is not strong enough yet.' }],
      context,
    };
  }

  static async recalculateNutritionTargets(userId) {
    const user = await User.findById(userId);
    if (!user) {
      throw new Error('User not found');
    }

    const targets = calculateNutritionTargets({
      goalType: user.goalType,
      shiftType: user.shiftType,
      height: user.height || 170,
      weight: user.weight || 70,
      age: user.age || 30,
      gender: user.gender || 'male',
    });

    return NutritionTarget.findOneAndUpdate(
      { userId },
      { ...targets, lastUpdated: new Date() },
      { upsert: true, returnDocument: 'after', runValidators: true },
    );
  }

  static async syncShiftTask(userId, payload = {}) {
    const user = await User.findById(userId);
    if (!user) return null;

    return UserShiftSchedule.findOneAndUpdate(
      { userId, date: payload.date || new Date().setHours(0, 0, 0, 0) },
      {
        userId,
        date: payload.date || new Date().setHours(0, 0, 0, 0),
        dayType: payload.dayType || 'work',
        taskType: payload.taskType || 'system',
        title: payload.title || 'Shift-aware task',
        description: payload.description || null,
        scheduledStart: payload.scheduledStart || null,
        scheduledEnd: payload.scheduledEnd || null,
        sourceModule: payload.sourceModule || 'calendar',
        sourceId: payload.sourceId || null,
        dependency: payload.dependency || null,
        status: payload.status || 'suggested',
        priority: payload.priority || 'medium',
        deepLink: payload.deepLink || '/calendar',
        isAutoGenerated: true,
      },
      { upsert: true, returnDocument: 'after', runValidators: true },
    );
  }
}

module.exports = WellnessEngine;
