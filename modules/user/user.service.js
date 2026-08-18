const User = require('./user.model');
const WorkoutLog = require('../workout/workoutLog.model');
const Meal = require('../nutrition/meal.model');
const SleepLog = require('../sleep-recovery/sleepLog.model');
const DailyNutritionSummary = require('../../nutrition/dailyNutritionSummary.model');
const logger = require('../../utils/logger');
const mongoose = require('mongoose');
const { validateProfile } = require('../../utils/healthValidation');

class UserService {
  /**
   * Get user profile
   */
  static async getProfile(userId) {
    try {
      const user = await User.findById(userId).select('-password').lean();

      if (!user) {
        throw new Error('User not found');
      }

      return user;
    } catch (error) {
      logger.error(`Get profile error: ${error.message}`);
      throw error;
    }
  }

  /**
   * Update user profile
   */
  static async updateProfile(userId, updateData) {
    try {
      // Remove sensitive fields
      const { password, email, role, ...safeUpdateData } = updateData;

      const validation = validateProfile(safeUpdateData);
      if (!validation.valid) {
        const err = new Error(validation.errors.join('. '));
        err.name = 'ValidationError';
        throw err;
      }

      const updates = { ...validation.value };

      if (updates.location && typeof updates.location === 'string') {
        updates.location = { city: updates.location };
      } else if (updates.location && typeof updates.location === 'object') {
        const { city, country } = updates.location;
        updates.location = {
          ...(city ? { city: String(city).trim() } : {}),
          ...(country ? { country: String(country).trim() } : {}),
        };
      }

      const user = await User.findByIdAndUpdate(userId, updates, {
        returnDocument: 'after',
        runValidators: true,
      }).select('-password');

      if (!user) {
        throw new Error('User not found');
      }

      return user;
    } catch (error) {
      logger.error(`Update profile error: ${error.message}`);
      throw error;
    }
  }

  /**
   * Update user preferences
   */
  static async updatePreferences(userId, preferences) {
    try {
      // Get current user to merge preferences
      const currentUser = await User.findById(userId);
      if (!currentUser) {
        throw new Error('User not found');
      }

      // Merge new preferences with existing ones
      const updatedPreferences = {
        ...currentUser.preferences,
        ...preferences,
      };

      const user = await User.findByIdAndUpdate(
        userId,
        { preferences: updatedPreferences },
        { returnDocument: 'after', runValidators: true },
      ).select('-password');

      return user;
    } catch (error) {
      logger.error(`Update preferences error: ${error.message}`);
      throw error;
    }
  }

  /**
   * Update notification settings
   */
  static async updateNotifications(userId, notifications) {
    try {
      // Get current user to merge notifications
      const currentUser = await User.findById(userId);
      if (!currentUser) {
        throw new Error('User not found');
      }

      // Merge new notifications with existing ones
      const updatedNotifications = {
        ...currentUser.notifications,
        ...notifications,
      };

      const user = await User.findByIdAndUpdate(
        userId,
        { notifications: updatedNotifications },
        { returnDocument: 'after', runValidators: true },
      ).select('-password');

      return user;
    } catch (error) {
      logger.error(`Update notifications error: ${error.message}`);
      throw error;
    }
  }

  /**
   * Update profile photo
   */
  static async updateProfilePhoto(userId, photoUrl) {
    try {
      const user = await User.findByIdAndUpdate(
        userId,
        { profilePhoto: photoUrl },
        { returnDocument: 'after' },
      ).select('-password');

      if (!user) {
        throw new Error('User not found');
      }

      return user;
    } catch (error) {
      logger.error(`Update profile photo error: ${error.message}`);
      throw error;
    }
  }

  /**
   * Get user statistics
   */
  static async getUserStats(userId) {
    try {
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

      const [user, totalWorkouts, totalMeals, totalSleepLogs, streak, recentActivities, nutritionSummary] =
        await Promise.all([
          User.findById(userId).select('createdAt shiftType goalType'),

          WorkoutLog.countDocuments({
            userId,
            completed: true,
            date: { $gte: thirtyDaysAgo },
          }),

          Meal.countDocuments({
            userId,
            date: { $gte: thirtyDaysAgo },
          }),

          SleepLog.countDocuments({
            userId,
            date: { $gte: thirtyDaysAgo },
          }),

          this.getCurrentStreak(userId),

          this.getRecentActivities(userId, 5),

          DailyNutritionSummary.findOne({
            userId,
            date: new Date().setHours(0, 0, 0, 0),
          }),
        ]);

      return {
        overview: {
          memberSince: user?.createdAt,
          shiftType: user?.shiftType,
          goalType: user?.goalType,
        },
        activity: {
          totalWorkouts,
          totalMeals,
          totalSleepLogs,
          currentStreak: streak,
        },
        recentActivities,
        todayNutrition: nutritionSummary || {
          calories: 0,
          protein: 0,
          carbs: 0,
          fat: 0,
        },
        period: '30 days',
      };
    } catch (error) {
      logger.error(`Get user stats error: ${error.message}`);
      throw error;
    }
  }

  /**
   * Get current streak (consecutive days with activity)
   */
  static async getCurrentStreak(userId) {
    try {
      let streak = 0;
      let currentDate = new Date();
      currentDate.setHours(0, 0, 0, 0);

      // Check up to 365 days for streak
      for (let i = 0; i < 365; i++) {
        const startOfDay = new Date(currentDate);
        const endOfDay = new Date(currentDate);
        endOfDay.setHours(23, 59, 59, 999);

        // Check if user had any activity on this day
        const [hasWorkout, hasMeal, hasSleepLog] = await Promise.all([
          WorkoutLog.findOne({
            userId,
            date: { $gte: startOfDay, $lte: endOfDay },
            completed: true,
          }),

          Meal.findOne({
            userId,
            date: { $gte: startOfDay, $lte: endOfDay },
          }),

          SleepLog.findOne({
            userId,
            date: { $gte: startOfDay, $lte: endOfDay },
          }),
        ]);

        if (hasWorkout || hasMeal || hasSleepLog) {
          streak++;
          currentDate.setDate(currentDate.getDate() - 1);
        } else {
          break;
        }
      }

      return streak;
    } catch (error) {
      logger.error(`Get current streak error: ${error.message}`);
      return 0;
    }
  }

  /**
   * Get recent activities
   */
  static async getRecentActivities(userId, limit = 10) {
    try {
      const activities = [];

      // Get recent workouts
      const recentWorkouts = await WorkoutLog.find({ userId })
        .populate('workoutId', 'title')
        .sort({ createdAt: -1 })
        .limit(limit)
        .lean();

      recentWorkouts.forEach(workout => {
        activities.push({
          type: 'workout',
          action: workout.completed ? 'completed' : 'scheduled',
          title: workout.workoutId?.title || 'Workout',
          timestamp: workout.createdAt,
          data: {
            duration: workout.durationMinutes,
            intensity: workout.intensity,
          },
        });
      });

      // Get recent meals
      const recentMeals = await Meal.find({ userId })
        .populate('foodId', 'name')
        .sort({ createdAt: -1 })
        .limit(limit)
        .lean();

      recentMeals.forEach(meal => {
        activities.push({
          type: 'meal',
          action: 'logged',
          title: meal.title,
          timestamp: meal.createdAt,
          data: {
            calories: meal.calories,
            mealType: meal.mealType,
          },
        });
      });

      // Get recent sleep logs
      const recentSleepLogs = await SleepLog.find({ userId }).sort({ createdAt: -1 }).limit(limit).lean();

      recentSleepLogs.forEach(log => {
        activities.push({
          type: 'sleep',
          action: 'logged',
          title: log.title,
          timestamp: log.createdAt,
          data: {
            duration: log.durationMinutes,
            quality: log.quality,
          },
        });
      });

      // Sort by timestamp and limit
      activities.sort((a, b) => b.timestamp - a.timestamp);
      return activities.slice(0, limit);
    } catch (error) {
      logger.error(`Get recent activities error: ${error.message}`);
      return [];
    }
  }

  /**
   * Get activity feed with pagination
   */
  static async getActivityFeed(userId, limit = 20, page = 1) {
    try {
      const skip = (page - 1) * limit;

      // Get all activities
      const activities = await this.getRecentActivities(userId, 100);

      // Paginate
      const paginatedActivities = activities.slice(skip, skip + limit);

      return {
        activities: paginatedActivities,
        pagination: {
          page,
          limit,
          total: activities.length,
          pages: Math.ceil(activities.length / limit),
        },
      };
    } catch (error) {
      logger.error(`Get activity feed error: ${error.message}`);
      throw error;
    }
  }

  /**
   * Delete user account
   */
  static async deleteAccount(userId, password) {
    const session = await mongoose.startSession();
    session.startTransaction();

    try {
      const user = await User.findById(userId).select('+password').session(session);

      if (!user) {
        throw new Error('User not found');
      }

      // Verify password
      const isPasswordValid = await user.comparePassword(password);
      if (!isPasswordValid) {
        throw new Error('Invalid password');
      }

      // Soft delete - mark as inactive
      user.isActive = false;
      user.email = `deleted_${Date.now()}_${user.email}`;
      await user.save({ session });

      // In a real application, you might want to:
      // 1. Anonymize user data
      // 2. Schedule permanent deletion
      // 3. Cancel subscriptions
      // 4. Send confirmation email

      await session.commitTransaction();
      session.endSession();

      return true;
    } catch (error) {
      await session.abortTransaction();
      session.endSession();
      logger.error(`Delete account error: ${error.message}`);
      throw error;
    }
  }
}

module.exports = UserService;
