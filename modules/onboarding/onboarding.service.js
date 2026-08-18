const Shift = require('./shift.model');
const Goal = require('./goal.model');
const User = require('../user/user.model');
const WellnessEngine = require('../engine/wellnessEngine.service');
const CalendarService = require('../calendar/calendar.service');
const WorkoutLog = require('../workout/workoutLog.model');
const Meal = require('../nutrition/meal.model');
const logger = require('../../utils/logger');

class OnboardingService {
  /**
   * Get all available shifts
   */
  static async getShifts() {
    try {
      const shifts = await Shift.find({ isActive: true });
      return shifts;
    } catch (error) {
      logger.error(`Get shifts error: ${error.message}`);
      throw error;
    }
  }

  /**
   * Get all available goals
   */
  static async getGoals() {
    try {
      const goals = await Goal.find({ isActive: true });
      return goals;
    } catch (error) {
      logger.error(`Get goals error: ${error.message}`);
      throw error;
    }
  }

  /**
   * Update user shift
   */
  static async updateUserShift(userId, shiftName) {
    try {
      // Validate shift exists
      const shift = await Shift.findOne({ name: shiftName, isActive: true });
      if (!shift) {
        throw new Error('Invalid shift selection');
      }

      // Fetch user to check current status
      const existingUser = await User.findById(userId);
      if (!existingUser) {
        throw new Error('User not found');
      }

      // Determine new account status
      let newStatus = existingUser.accountStatus;
      if (!existingUser.onboardingCompleted) {
        newStatus = 'onboarding_incomplete';
      }

      // Update user
      const user = await User.findByIdAndUpdate(
        userId,
        { shiftType: shiftName, accountStatus: newStatus },
        { returnDocument: 'after' },
      );

      // System-wide re-initialization
      // 1. Recalculate basic nutrition timing & targets based on new circadian schedule
      await WellnessEngine.recalculateNutritionTargets(userId);

      // 2. Clear out any future, uncompleted dynamically scheduled items so they don't leak into the new schedule
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      await WorkoutLog.deleteMany({
        userId,
        date: { $gte: today },
        completed: false
      });

      await Meal.deleteMany({
        userId,
        date: { $gte: today },
        status: { $ne: 'completed' }
      });

      // 3. Force calendar regeneration
      await CalendarService.generateSchedule(
        userId,
        new Date(),
        new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      ).catch(() => null);

      await WellnessEngine.recordEvent({
        userId,
        type: 'CALENDAR',
        category: 'calendar',
        title: 'Shift updated',
        message: `Your shift has been updated to ${shift.displayName}.`,
        sourceModule: 'onboarding',
        sourceId: shift._id.toString(),
        deepLink: '/home',
        priority: 'MEDIUM',
        dedupeKey: `shift:${userId}:${shiftName}`,
      });

      return user;
    } catch (error) {
      logger.error(`Update user shift error: ${error.message}`);
      throw error;
    }
  }

  /**
   * Update user goal and calculate nutrition targets
   */
  static async updateUserGoal(userId, goalName) {
    try {
      // Validate goal exists
      const goal = await Goal.findOne({ name: goalName, isActive: true });
      if (!goal) {
        throw new Error('Invalid goal selection');
      }

      // Get user with updated shift
      const user = await User.findById(userId);
      if (!user) {
        throw new Error('User not found');
      }

      // Update user goal
      user.goalType = goalName;
      await user.save();

      // Calculate and save nutrition targets
      const nutritionTargets = await WellnessEngine.recalculateNutritionTargets(userId);

      // 2. Clear out any future, uncompleted dynamically scheduled items so they don't leak into the new schedule
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      await WorkoutLog.deleteMany({
        userId,
        date: { $gte: today },
        completed: false
      });

      await Meal.deleteMany({
        userId,
        date: { $gte: today },
        status: { $ne: 'completed' }
      });

      await CalendarService.generateSchedule(
        userId,
        new Date(),
        new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      ).catch(() => null);

      // Mark onboarding as completed if both shift and goal are set
      if (user.shiftType && user.goalType) {
        user.onboardingCompleted = true;
        user.accountStatus = 'active';
        await user.save();
      }

      await WellnessEngine.recordEvent({
        userId,
        type: 'SYSTEM',
        category: 'system',
        title: 'Goal updated',
        message: `Your goal is now ${goal.displayName}. Nutrition targets were updated automatically.`,
        sourceModule: 'onboarding',
        sourceId: goal._id.toString(),
        deepLink: '/home',
        priority: 'MEDIUM',
        dedupeKey: `goal:${userId}:${goalName}`,
        payload: { nutritionTargetsId: nutritionTargets?._id?.toString() || null },
      });

      return user;
    } catch (error) {
      logger.error(`Update user goal error: ${error.message}`);
      throw error;
    }
  }

  /**
   * Complete user onboarding
   */
  static async completeOnboarding(userId) {
    try {
      const user = await User.findById(userId);
      if (!user) {
        throw new Error('User not found');
      }

      if (!user.shiftType || !user.goalType) {
        throw new Error('Please complete shift and goal selection first');
      }

      user.onboardingCompleted = true;
      user.accountStatus = 'active';
      await user.save();

      await CalendarService.generateSchedule(
        userId,
        new Date(),
        new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      ).catch(() => null);

      await WellnessEngine.recordEvent({
        userId,
        type: 'SYSTEM',
        category: 'system',
        title: 'Onboarding completed',
        message: 'Your shift-aware plan is ready.',
        sourceModule: 'onboarding',
        sourceId: user._id.toString(),
        deepLink: '/home',
        priority: 'MEDIUM',
        dedupeKey: `onboarding-complete:${userId}`,
      });

      return user;
    } catch (error) {
      logger.error(`Complete onboarding error: ${error.message}`);
      throw error;
    }
  }

  /**
   * Seed default shifts and goals (for initial setup)
   */
  static async seedDefaultData() {
    try {
      // Default shifts
      const defaultShifts = [
        {
          name: 'fixed_night',
          displayName: 'Fixed Night',
          description: 'Consistent overnight schedule, usually 10pm–6am',
          defaultWakeTime: '18:00',
          defaultSleepTime: '10:00',
          tags: ['sleep', 'workout', 'recovery'],
          isActive: true,
        },
        {
          name: 'rotating',
          displayName: 'Rotating Shifts',
          description: 'Schedule changes weekly or bi-weekly',
          defaultWakeTime: '06:00',
          defaultSleepTime: '22:00',
          tags: ['sleep', 'workout', 'recovery', 'calendar'],
          isActive: true,
        },
        {
          name: 'early_morning',
          displayName: 'Early Mornings',
          description: 'Starting before 6am, early wake times',
          defaultWakeTime: '04:00',
          defaultSleepTime: '20:00',
          tags: ['sleep', 'workout', 'calendar'],
          isActive: true,
        },
        {
          name: 'off_shift',
          displayName: 'Off Shift',
          description: 'A rest-heavy schedule for recovery days and leave.',
          defaultWakeTime: '08:00',
          defaultSleepTime: '22:00',
          tags: ['sleep', 'recovery', 'calendar'],
          isActive: true,
        },
      ];

      // Default goals
      const defaultGoals = [
        {
          name: 'fat_loss',
          displayName: 'Fat Loss',
          description: 'Support healthy fat reduction through smart routines',
          calorieAdjustment: -15, // 15% deficit
          proteinRatio: 0.4,
          carbRatio: 0.35,
          fatRatio: 0.25,
          tags: ['weight', 'workout', 'recovery'],
          isActive: true,
        },
        {
          name: 'strength_building',
          displayName: 'Strength Building',
          description: 'Increase force output and muscular efficiency safely',
          calorieAdjustment: 10, // 10% surplus
          proteinRatio: 0.35,
          carbRatio: 0.45,
          fatRatio: 0.2,
          tags: ['sleep', 'workout', 'recovery', 'calendar'],
          isActive: true,
        },
        {
          name: 'maintenance',
          displayName: 'Maintenance',
          description: 'Maintain current fitness levels while supporting health',
          calorieAdjustment: 0, // No adjustment
          proteinRatio: 0.3,
          carbRatio: 0.4,
          fatRatio: 0.3,
          tags: ['weight', 'workout'],
          isActive: true,
        },
      ];

      // Insert shifts if not exists
      for (const shift of defaultShifts) {
        await Shift.findOneAndUpdate({ name: shift.name }, shift, { upsert: true });
      }

      // Insert goals if not exists
      for (const goal of defaultGoals) {
        await Goal.findOneAndUpdate({ name: goal.name }, goal, { upsert: true });
      }

      logger.info('Default shifts and goals seeded successfully');
      return true;
    } catch (error) {
      logger.error(`Seed default data error: ${error.message}`);
      throw error;
    }
  }
}

module.exports = OnboardingService;
