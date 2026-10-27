const mongoose = require('mongoose');
const Workout = require('./workout.model');
const WorkoutLog = require('./workoutLog.model');
const User = require('../user/user.model');
const WellnessEngine = require('../engine/wellnessEngine.service');
const WorkoutXService = require('./workoutx.service');
const logger = require('../../utils/logger');

class WorkoutService {
  /**
   * Get all workouts (WorkoutX API for library + user custom workouts for my_workouts)
   */
  static async getWorkouts(userId, filters = {}) {
    try {
      const { search, category, intensity, page = 1, limit = 20, offset, tab = 'discover', gender } = filters;

      const user = userId ? await User.findById(userId).select('gender goalType age height weight').lean() : null;
      const userGender = WorkoutXService.normalizeGender(gender || user?.gender);

      // If user specifically requested 'my_workouts', return from MongoDB
      if (tab === 'my_workouts') {
        const query = { userId, isActive: true };
        if (search) query.$text = { $search: search };
        if (category) query.category = category;
        if (intensity) query.intensity = intensity;

        const skip = offset !== undefined ? parseInt(offset) : (parseInt(page) - 1) * parseInt(limit);
        const workouts = await Workout.find(query)
          .sort({ createdAt: -1 })
          .skip(skip)
          .limit(parseInt(limit))
          .populate('userId', 'name')
          .lean();

        const total = await Workout.countDocuments(query);
        return {
          workouts,
          recommended: [],
          pagination: {
            page: parseInt(page),
            limit: parseInt(limit),
            offset: skip,
            total,
            pages: Math.ceil(total / limit),
            hasMore: skip + workouts.length < total,
          },
        };
      }

      // Default: Discover / Workout Library from WorkoutX API strictly for userGender
      const calculatedOffset = offset !== undefined ? parseInt(offset) : (parseInt(page) - 1) * parseInt(limit);
      const wxData = await WorkoutXService.getLibraryExercises({
        limit: parseInt(limit),
        offset: calculatedOffset,
        search,
        gender: userGender,
        bodyPart: category,
      });

      // Fetch 2 recommended exercises for today strictly for userGender (only on initial load / offset 0 when not searching)
      let recommended = [];
      if (calculatedOffset === 0 && !search && user) {
        user.gender = userGender;
        recommended = await WorkoutXService.getRecommendedForUser(user);
      }

      return {
        workouts: wxData.results,
        recommended,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          offset: calculatedOffset,
          total: wxData.total,
          pages: Math.ceil(wxData.total / limit),
          hasMore: wxData.hasMore,
        },
      };
    } catch (error) {
      logger.error(`Get workouts error: ${error.message}`);
      throw error;
    }
  }

  /**
   * Get 2 recommended exercises for user today matching user's gender
   */
  static async getRecommendedWorkouts(userId, explicitGender) {
    try {
      let user = userId ? await User.findById(userId).select('gender goalType age height weight').lean() : null;
      if (!user) {
        user = { _id: userId || 'default', gender: explicitGender || 'male' };
      }
      user.gender = WorkoutXService.normalizeGender(explicitGender || user.gender);
      return await WorkoutXService.getRecommendedForUser(user);
    } catch (error) {
      logger.error(`Get recommended workouts error: ${error.message}`);
      return [];
    }
  }

  /**
   * Get workout by ID with user gender resolution
   */
  static async getWorkoutById(workoutId, userId, explicitGender) {
    try {
      if (!workoutId || typeof workoutId !== 'string' || workoutId === '[object Object]') {
        throw new Error('Invalid workout ID');
      }

      const user = userId ? await User.findById(userId).select('gender').lean() : null;
      const userGender = WorkoutXService.normalizeGender(explicitGender || user?.gender);

      // Check if WorkoutX ID (e.g. starts with ex_ or not a Mongo ObjectId)
      if (workoutId.startsWith('ex_') || !mongoose.Types.ObjectId.isValid(workoutId)) {
        const wxExercise = await WorkoutXService.getExerciseById(workoutId, userGender);
        if (wxExercise) return wxExercise;
      }

      // Check MongoDB
      if (mongoose.Types.ObjectId.isValid(workoutId)) {
        const workout = await Workout.findById(workoutId).populate('userId', 'name email').lean();
        if (workout) {
          if (!workout.isPublic && workout.userId && workout.userId._id && workout.userId._id.toString() !== userId.toString()) {
            throw new Error('Not authorized to view this workout');
          }
          return workout;
        }
      }

      throw new Error('Workout not found');
    } catch (error) {
      logger.error(`Get workout by ID error: ${error.message}`);
      throw error;
    }
  }

  /**
   * Create custom workout
   */
  static async createWorkout(userId, workoutData) {
    try {
      const workout = await Workout.create({
        ...workoutData,
        userId,
        isPublic: false, // User's custom workouts are private by default
      });

      return workout;
    } catch (error) {
      logger.error(`Create workout error: ${error.message}`);
      throw error;
    }
  }

  /**
   * Update workout
   */
  static async updateWorkout(workoutId, userId, updateData) {
    try {
      const workout = await Workout.findById(workoutId);
      if (!workout) {
        throw new Error('Workout not found');
      }

      // Check ownership (only allow updating user's own workouts)
      if (workout.userId && workout.userId.toString() !== userId.toString()) {
        throw new Error('Not authorized to update this workout');
      }

      const allowedUpdateFields = (({
        title,
        description,
        durationMinutes,
        category,
        intensity,
        exercises,
        equipment,
        imageUrl,
        videoUrl,
        tags,
        isPublic,
      }) => ({
        title,
        description,
        durationMinutes,
        category,
        intensity,
        exercises,
        equipment,
        imageUrl,
        videoUrl,
        tags,
        isPublic,
      }))(updateData);

      const updatedWorkout = await Workout.findByIdAndUpdate(
        workoutId,
        { ...allowedUpdateFields, updatedAt: Date.now() },
        { returnDocument: 'after', runValidators: true },
      );

      return updatedWorkout;
    } catch (error) {
      logger.error(`Update workout error: ${error.message}`);
      throw error;
    }
  }

  /**
   * Delete workout
   */
  static async deleteWorkout(workoutId, userId) {
    try {
      const workout = await Workout.findById(workoutId);
      if (!workout) {
        throw new Error('Workout not found');
      }

      // Check ownership (only allow deleting user's own workouts)
      if (workout.userId && workout.userId.toString() !== userId.toString()) {
        throw new Error('Not authorized to delete this workout');
      }

      // Soft delete by marking as inactive
      workout.isActive = false;
      await workout.save();

      return true;
    } catch (error) {
      logger.error(`Delete workout error: ${error.message}`);
      throw error;
    }
  }

  /**
   * Log workout completion
   */
  static async logWorkout(userId, logData) {
    try {
      const {
        workoutId,
        scheduledTime,
        actualStartTime,
        actualEndTime,
        durationMinutes,
        intensity,
        completionPercentage,
        notes,
        rating,
        perceivedExertion,
        exercises,
        caloriesBurned,
      } = logData;

      let workout = null;
      let targetWorkoutId = workoutId;
      let externalId = null;

      // Handle WorkoutX exercise ID
      if (typeof workoutId === 'string' && (workoutId.startsWith('ex_') || !mongoose.Types.ObjectId.isValid(workoutId))) {
        externalId = workoutId;
        // Check if shadow workout exists in Mongo
        let shadowWorkout = await Workout.findOne({ externalId: workoutId });
        if (!shadowWorkout) {
          try {
            const wxEx = await WorkoutXService.getExerciseById(workoutId);
            if (wxEx) {
              shadowWorkout = await Workout.create({
                title: wxEx.title,
                description: wxEx.description,
                durationMinutes: wxEx.durationMinutes || 15,
                category: wxEx.category || 'custom',
                intensity: wxEx.intensity || 'medium',
                externalId: wxEx.id,
                imageUrl: wxEx.imageUrl,
                videoUrl: wxEx.videoUrl,
                animationUrl: wxEx.animationUrl,
                posterUrl: wxEx.posterUrl,
                model: wxEx.model,
                counterpartId: wxEx.counterpartId,
                isPublic: true,
                isActive: true,
              });
            }
          } catch (e) {
            logger.warn(`Could not create shadow workout for ${workoutId}: ${e.message}`);
          }
        }
        if (shadowWorkout) {
          workout = shadowWorkout;
          targetWorkoutId = shadowWorkout._id;
        }
      } else if (mongoose.Types.ObjectId.isValid(workoutId)) {
        workout = await Workout.findById(workoutId);
      }

      const finalDuration = durationMinutes || (workout ? workout.durationMinutes : 15);
      const finalIntensity = intensity || (workout ? workout.intensity : 'medium');
      const finalCompletionPercentage = completionPercentage !== undefined ? completionPercentage : 100;

      // Create workout log
      const workoutLog = await WorkoutLog.create({
        userId,
        workoutId: targetWorkoutId || workoutId,
        workoutExternalId: externalId,
        scheduledTime,
        actualStartTime,
        actualEndTime,
        durationMinutes: finalDuration,
        intensity: finalIntensity,
        status: finalCompletionPercentage >= 100 ? 'completed' : 'scheduled',
        completed: finalCompletionPercentage >= 100,
        completionPercentage: finalCompletionPercentage,
        notes,
        rating,
        perceivedExertion,
        exercises: exercises || (workout ? workout.exercises : []),
        caloriesBurned: caloriesBurned || (finalDuration * 6),
        date: new Date().setHours(0, 0, 0, 0),
      });

      // Trigger recovery score recalculation
      this.triggerRecoveryRecalculation(userId);

      // Populate workout if targetWorkoutId is a valid Mongo ObjectId
      if (mongoose.Types.ObjectId.isValid(targetWorkoutId)) {
        try {
          await workoutLog.populate('workoutId');
        } catch (popErr) {
          logger.warn(`Could not populate workoutId on log: ${popErr.message}`);
        }
      }

      return workoutLog;
    } catch (error) {
      logger.error(`Log workout error: ${error.message}`);
      throw error;
    }
  }

  /**
   * Get workout logs for user
   */
  static async getWorkoutLogs(userId, filters = {}) {
    try {
      const { date, workoutId, completed, startDate, endDate, page = 1, limit = 20 } = filters;

      // Build query
      const query = { userId };

      if (date) {
        const queryDate = new Date(date);
        queryDate.setHours(0, 0, 0, 0);
        query.date = queryDate;
      }

      if (workoutId) {
        query.workoutId = workoutId;
      }

      if (completed !== undefined) {
        query.completed = completed === 'true';
      }

      if (startDate || endDate) {
        query.date = {};
        if (startDate) {
          query.date.$gte = new Date(startDate);
        }
        if (endDate) {
          query.date.$lte = new Date(endDate);
        }
      }

      const skip = (page - 1) * limit;

      const logs = await WorkoutLog.find(query)
        .populate('workoutId', 'title category durationMinutes intensity')
        .sort({ date: -1, createdAt: -1 })
        .skip(skip)
        .limit(parseInt(limit))
        .lean();

      // Get total count for pagination
      const total = await WorkoutLog.countDocuments(query);

      return {
        logs,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total,
          pages: Math.ceil(total / limit),
        },
      };
    } catch (error) {
      logger.error(`Get workout logs error: ${error.message}`);
      throw error;
    }
  }

  /**
   * Get workout log by ID
   */
  static async getWorkoutLogById(logId) {
    try {
      const log = await WorkoutLog.findById(logId)
        .populate('workoutId')
        .populate('userId', 'name email')
        .lean();

      if (!log) {
        throw new Error('Workout log not found');
      }

      return log;
    } catch (error) {
      logger.error(`Get workout log by ID error: ${error.message}`);
      throw error;
    }
  }

  /**
   * Update workout log
   */
  static async updateWorkoutLog(logId, userId, updateData) {
    try {
      const log = await WorkoutLog.findById(logId);
      if (!log) {
        throw new Error('Workout log not found');
      }

      // Check ownership
      if (log.userId.toString() !== userId.toString()) {
        throw new Error('Not authorized to update this workout log');
      }

      const nextCompleted =
        updateData.completed !== undefined ? Boolean(updateData.completed) : Boolean(log.completed);
      const nextCompletionPercentage =
        updateData.completionPercentage !== undefined
          ? Number(updateData.completionPercentage)
          : Number(log.completionPercentage || 0);

      updateData.completed = nextCompleted || nextCompletionPercentage >= 100;
      updateData.completionPercentage = updateData.completed
        ? Math.max(nextCompletionPercentage, 100)
        : nextCompletionPercentage;
      updateData.status = updateData.completed
        ? 'completed'
        : updateData.scheduledTime || log.scheduledTime
          ? 'scheduled'
          : log.status;

      const updatedLog = await WorkoutLog.findByIdAndUpdate(
        logId,
        { ...updateData, updatedAt: Date.now() },
        { returnDocument: 'after' },
      );

      // Trigger recovery score recalculation if completion status changed
      if (updateData.completed !== undefined || updateData.completionPercentage !== undefined) {
        this.triggerRecoveryRecalculation(userId);
      }

      return updatedLog;
    } catch (error) {
      logger.error(`Update workout log error: ${error.message}`);
      throw error;
    }
  }

  /**
   * Delete workout log
   */
  static async deleteWorkoutLog(logId, userId) {
    try {
      const log = await WorkoutLog.findById(logId);
      if (!log) {
        throw new Error('Workout log not found');
      }

      // Check ownership
      if (log.userId.toString() !== userId.toString()) {
        throw new Error('Not authorized to delete this workout log');
      }

      await WorkoutLog.findByIdAndDelete(logId);

      // Trigger recovery score recalculation
      this.triggerRecoveryRecalculation(userId);

      return true;
    } catch (error) {
      logger.error(`Delete workout log error: ${error.message}`);
      throw error;
    }
  }

  /**
   * Get workout statistics
   */
  static async getWorkoutStats(userId, period = 'week') {
    try {
      const endDate = new Date();
      const startDate = new Date();

      switch (period) {
        case 'day':
          startDate.setDate(startDate.getDate() - 1);
          break;
        case 'week':
          startDate.setDate(startDate.getDate() - 7);
          break;
        case 'month':
          startDate.setMonth(startDate.getMonth() - 1);
          break;
        default:
          startDate.setDate(startDate.getDate() - 7);
      }

      const logs = await WorkoutLog.find({
        userId,
        date: { $gte: startDate, $lte: endDate },
        completed: true,
      }).populate('workoutId');

      // Calculate statistics
      let totalWorkouts = 0;
      let totalDuration = 0;
      let totalCalories = 0;
      const categoryCount = {};
      const intensityCount = { low: 0, medium: 0, high: 0 };

      logs.forEach(log => {
        totalWorkouts++;
        totalDuration += log.durationMinutes || 0;
        totalCalories += log.caloriesBurned || 0;

        if (log.intensity && intensityCount.hasOwnProperty(log.intensity)) {
          intensityCount[log.intensity]++;
        }

        if (log.workoutId && log.workoutId.category) {
          categoryCount[log.workoutId.category] = (categoryCount[log.workoutId.category] || 0) + 1;
        }
      });

      const avgDuration = totalWorkouts > 0 ? Math.round(totalDuration / totalWorkouts) : 0;
      const avgCalories = totalWorkouts > 0 ? Math.round(totalCalories / totalWorkouts) : 0;

      // Calculate consistency
      const uniqueDates = new Set(logs.map(log => log.date.toDateString()));
      const consistency =
        period === 'day'
          ? 100
          : Math.round((uniqueDates.size / ((endDate - startDate) / (1000 * 60 * 60 * 24))) * 100);

      // Get most frequent workout
      let mostFrequentWorkout = null;
      if (logs.length > 0) {
        const workoutCount = {};
        logs.forEach(log => {
          if (log.workoutId) {
            const workoutName = log.workoutId.title;
            workoutCount[workoutName] = (workoutCount[workoutName] || 0) + 1;
          }
        });

        mostFrequentWorkout = Object.entries(workoutCount).sort(([, a], [, b]) => b - a)[0] || null;
      }

      return {
        period,
        totalWorkouts,
        totalDuration,
        totalCalories,
        avgDuration,
        avgCalories,
        intensityDistribution: intensityCount,
        categoryDistribution: categoryCount,
        consistency,
        mostFrequentWorkout: mostFrequentWorkout
          ? {
              name: mostFrequentWorkout[0],
              count: mostFrequentWorkout[1],
            }
          : null,
        startDate,
        endDate,
      };
    } catch (error) {
      logger.error(`Get workout stats error: ${error.message}`);
      throw error;
    }
  }

  /**
   * Get scheduled workouts for user
   */
  static async getScheduledWorkouts(userId, date = null) {
    try {
      const queryDate = date ? new Date(date) : new Date();
      queryDate.setHours(0, 0, 0, 0);

      const scheduledLogs = await WorkoutLog.find({
        userId,
        date: queryDate,
        completed: false,
        scheduledTime: { $ne: null },
      })
        .populate('workoutId')
        .sort({ scheduledTime: 1 })
        .lean();

      return scheduledLogs;
    } catch (error) {
      logger.error(`Get scheduled workouts error: ${error.message}`);
      throw error;
    }
  }

  /**
   * Schedule a workout
   */
  static async scheduleWorkout(userId, workoutId, date, scheduledTime) {
    try {
      // Verify workout exists
      const workout = await Workout.findById(workoutId);
      if (!workout) {
        throw new Error('Workout not found');
      }

      const scheduleDate = new Date(date);
      scheduleDate.setHours(0, 0, 0, 0);

      // Check if already scheduled for this time
      const existingSchedule = await WorkoutLog.findOne({
        userId,
        workoutId,
        date: scheduleDate,
        scheduledTime,
        completed: false,
      });

      if (existingSchedule) {
        throw new Error('Workout already scheduled for this time');
      }

      // Create schedule
      const schedule = await WorkoutLog.create({
        userId,
        workoutId,
        date: scheduleDate,
        scheduledTime,
        status: 'scheduled',
        completed: false,
      });

      return schedule;
    } catch (error) {
      logger.error(`Schedule workout error: ${error.message}`);
      throw error;
    }
  }

  /**
   * Trigger recovery score recalculation (async)
   */
  static async triggerRecoveryRecalculation(userId) {
    try {
      logger.info(`Recovery recalculation triggered from workout for user: ${userId}`);
      const WellnessEngine = require('../engine/wellnessEngine.service');
      await WellnessEngine.buildContext(userId).catch(() => null);
      return true;
    } catch (error) {
      logger.error(`Trigger recovery recalculation error: ${error.message}`);
    }
  }

  /**
   * Seed default system workouts
   */
  static async seedDefaultWorkouts() {
    try {
      const defaultWorkouts = [
        {
          title: 'Morning Energy Boost',
          description: 'Quick full-body workout to start your day with energy',
          durationMinutes: 15,
          category: 'hiit',
          intensity: 'medium',
          exercises: [
            { name: 'Jumping Jacks', sets: 3, reps: 30, duration: 30, rest: 15 },
            { name: 'Bodyweight Squats', sets: 3, reps: 15, rest: 30 },
            { name: 'Push-ups', sets: 3, reps: 10, rest: 30 },
            { name: 'Plank', sets: 3, duration: 30, rest: 15 },
          ],
          equipment: ['bodyweight'],
          tags: ['morning', 'quick', 'full-body'],
          isPublic: true,
          isActive: true,
        },
        {
          title: 'Post-Shift Recovery Flow',
          description: 'Gentle movement to unwind after work',
          durationMinutes: 20,
          category: 'yoga',
          intensity: 'low',
          exercises: [
            { name: 'Cat-Cow Stretch', sets: 1, duration: 60 },
            { name: "Child's Pose", sets: 1, duration: 60 },
            { name: 'Forward Fold', sets: 1, duration: 60 },
            { name: 'Legs Up the Wall', sets: 1, duration: 300 },
          ],
          equipment: ['bodyweight'],
          tags: ['recovery', 'post-shift', 'relaxation'],
          isPublic: true,
          isActive: true,
        },
        {
          title: 'Strength Builder',
          description: 'Full-body strength training session',
          durationMinutes: 45,
          category: 'strength',
          intensity: 'high',
          exercises: [
            { name: 'Dumbbell Squats', sets: 4, reps: 8, rest: 60 },
            { name: 'Dumbbell Bench Press', sets: 4, reps: 8, rest: 60 },
            { name: 'Bent Over Rows', sets: 4, reps: 10, rest: 60 },
            { name: 'Shoulder Press', sets: 3, reps: 10, rest: 45 },
            { name: 'Bicep Curls', sets: 3, reps: 12, rest: 30 },
          ],
          equipment: ['dumbbells'],
          tags: ['strength', 'full-body', 'dumbbells'],
          isPublic: true,
          isActive: true,
        },
      ];

      // Insert or update workouts
      for (const workout of defaultWorkouts) {
        await Workout.findOneAndUpdate({ title: workout.title, userId: null }, workout, {
          upsert: true,
          returnDocument: 'after',
        });
      }

      logger.info('Default workouts seeded successfully');
      return true;
    } catch (error) {
      logger.error(`Seed default workouts error: ${error.message}`);
      throw error;
    }
  }
}

module.exports = WorkoutService;
