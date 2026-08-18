const RecoveryActivity = require('./recoveryActivity.model');
const SleepLog = require('./sleepLog.model');
const User = require('../user/user.model');
const { calculateSleepScore } = require('../../utils/sleepScore');
const { validateTimeRange } = require('../../utils/healthValidation');
const WellnessEngine = require('../engine/wellnessEngine.service');
const logger = require('../../utils/logger');

class SleepRecoveryService {
  /**
   * Get all recovery activities
   */
  static async getRecoveryActivities(userId = null) {
    try {
      let query = { isActive: true };

      // If user ID provided, filter by applicable shifts
      if (userId) {
        const user = await User.findById(userId);
        if (user && user.shiftType) {
          query = {
            ...query,
            $or: [
              { applicableShifts: { $size: 0 } }, // Activities for all shifts
              { applicableShifts: user.shiftType },
            ],
          };
        }
      }

      const activities = await RecoveryActivity.find(query).sort({ order: 1, title: 1 });
      
      // Dynamic AI Recommendation Logic
      let recommendedActivities = activities.map(act => act.toObject());
      
      if (userId) {
        try {
          const context = await WellnessEngine.buildContext(userId);
          const sleepScore = context.scores?.sleepScore || 100;
          const sleepTotalHours = (context.sleepLogs || []).reduce((sum, log) => sum + (log.durationMinutes || 0) / 60, 0);
          
          recommendedActivities = recommendedActivities.map(activity => {
            let isRecommended = false;
            let reason = null;
            
            // Logic for recommendations based on fatigue / sleep debt
            if (sleepTotalHours > 0 && sleepTotalHours < 6 && (activity.key === 'nap' || activity.key === 'daytime_sleep')) {
              isRecommended = true;
              reason = `Recommended due to short sleep deficit (${sleepTotalHours.toFixed(1)}h)`;
            } else if (sleepScore < 60 && activity.key === 'nervous_system_reset') {
              isRecommended = true;
              reason = "Recommended to lower cortisol and improve sleep readiness";
            } else if (context.user?.shiftType === 'fixed_night' && activity.key === 'post_shift_wind_down') {
              isRecommended = true;
              reason = "Crucial for transitioning from night shift to daytime sleep";
            } else if (sleepTotalHours === 0 && activity.key === 'night_sleep') {
               // If it's a standard user and no sleep logged
               if (context.user?.shiftType !== 'fixed_night') {
                   isRecommended = true;
                   reason = "Log your primary rest phase to get accurate readiness scores";
               }
            }

            return {
              ...activity,
              recommended: isRecommended,
              recommendationReason: reason
            };
          });
        } catch (engineError) {
          logger.error(`Failed to build context for recommendations: ${engineError.message}`);
        }
      }

      // Sort so recommended items appear first (though frontend can also sort)
      recommendedActivities.sort((a, b) => {
        if (a.recommended && !b.recommended) return -1;
        if (!a.recommended && b.recommended) return 1;
        return (a.order || 0) - (b.order || 0);
      });

      return recommendedActivities;
    } catch (error) {
      logger.error(`Get recovery activities error: ${error.message}`);
      throw error;
    }
  }

  /**
   * Log sleep/recovery activity
   */
  static async logActivity(userId, activityData) {
    try {
      const {
        activityKey,
        startTime,
        endTime,
        quality,
        notes,
        energyBefore,
        energyAfter,
        shiftContext,
        splitSleep,
        interruptedSleep,
        naps = 0,
      } = activityData;

      // Validate activity exists
      const activity = await RecoveryActivity.findOne({ key: activityKey, isActive: true });
      if (!activity) {
        throw new Error('Invalid recovery activity');
      }

      const timeValidation = validateTimeRange(startTime, endTime);
      if (!timeValidation.valid) {
        throw new Error(timeValidation.message);
      }

      const durationMinutes = timeValidation.durationMinutes;

      if (durationMinutes < activity.minDuration) {
        throw new Error(`Minimum duration for this activity is ${activity.minDuration} minutes`);
      }

      if (durationMinutes > activity.maxDuration) {
        throw new Error(`Maximum duration for this activity is ${activity.maxDuration} minutes`);
      }

      // Create sleep log
      const sleepLog = await SleepLog.create({
        userId,
        activityKey,
        startTime,
        endTime,
        durationMinutes,
        status: 'logged',
        quality: quality || 'average',
        notes,
        energyBefore,
        energyAfter,
        shiftContext,
        splitSleep: Boolean(splitSleep),
        interruptedSleep: Boolean(interruptedSleep),
        naps: Number(naps || 0),
        readinessEffect: durationMinutes >= 420 ? 20 : durationMinutes >= 300 ? 10 : -10,
        date: new Date().setHours(0, 0, 0, 0),
      });

      // Trigger recovery score recalculation (async)
      this.triggerRecoveryRecalculation(userId);

      return sleepLog;
    } catch (error) {
      logger.error(`Log activity error: ${error.message}`);
      throw error;
    }
  }

  /**
   * Get user sleep logs for a date
   */
  static async getUserSleepLogs(userId, date = null, limit = null) {
    try {
      const queryDate = date ? new Date(date) : new Date();
      queryDate.setHours(0, 0, 0, 0);

      const query = {
        userId,
        date: queryDate,
      };

      const sleepLogs = await SleepLog.find(query).sort({ startTime: 1 });

      // If limit specified, get latest logs
      if (limit) {
        return await SleepLog.find({ userId }).sort({ createdAt: -1 }).limit(parseInt(limit));
      }

      return sleepLogs;
    } catch (error) {
      logger.error(`Get user sleep logs error: ${error.message}`);
      throw error;
    }
  }

  /**
   * Get sleep log by ID
   */
  static async getSleepLogById(logId) {
    try {
      const sleepLog = await SleepLog.findById(logId).populate('userId', 'name email shiftType');

      if (!sleepLog) {
        throw new Error('Sleep log not found');
      }

      return sleepLog;
    } catch (error) {
      logger.error(`Get sleep log by ID error: ${error.message}`);
      throw error;
    }
  }

  /**
   * Update sleep log
   */
  static async updateSleepLog(logId, userId, updateData) {
    try {
      const allowedUpdateData = (({
        activityKey,
        date,
        startTime,
        endTime,
        durationMinutes,
        quality,
        notes,
      }) => ({
        activityKey,
        date,
        startTime,
        endTime,
        durationMinutes,
        quality,
        notes,
      }))(updateData);

      const sleepLog = await SleepLog.findById(logId);
      if (!sleepLog) {
        throw new Error('Sleep log not found');
      }

      // Check ownership
      if (sleepLog.userId.toString() !== userId.toString()) {
        throw new Error('Not authorized to update this sleep log');
      }

      // If times are being updated, recalculate duration
      if (allowedUpdateData.startTime || allowedUpdateData.endTime) {
        const startTime = allowedUpdateData.startTime || sleepLog.startTime;
        const endTime = allowedUpdateData.endTime || sleepLog.endTime;

        // Validate time format
        const timeRegex = /^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/;
        if (!timeRegex.test(startTime) || !timeRegex.test(endTime)) {
          throw new Error('Invalid time format. Use HH:MM (24-hour format)');
        }

        // Calculate duration
        const start = new Date(`2000-01-01T${startTime}`);
        const end = new Date(`2000-01-01T${endTime}`);

        if (end < start) {
          end.setDate(end.getDate() + 1);
        }

        const durationMinutes = Math.round((end - start) / (1000 * 60));

        if (durationMinutes <= 0) {
          throw new Error('End time must be after start time');
        }

        // Validate against activity constraints if activityKey not changing
        if (!allowedUpdateData.activityKey) {
          const activity = await RecoveryActivity.findOne({
            key: sleepLog.activityKey,
            isActive: true,
          });

          if (activity) {
            if (durationMinutes < activity.minDuration) {
              throw new Error(`Minimum duration for this activity is ${activity.minDuration} minutes`);
            }

            if (durationMinutes > activity.maxDuration) {
              throw new Error(`Maximum duration for this activity is ${activity.maxDuration} minutes`);
            }
          }
        }

        allowedUpdateData.durationMinutes = durationMinutes;
      }

      // Update sleep log
      const updatedLog = await SleepLog.findByIdAndUpdate(
        logId,
        { ...allowedUpdateData, updatedAt: Date.now() },
        { returnDocument: 'after', runValidators: true },
      );

      // Trigger recovery score recalculation
      this.triggerRecoveryRecalculation(userId);

      return updatedLog;
    } catch (error) {
      logger.error(`Update sleep log error: ${error.message}`);
      throw error;
    }
  }

  /**
   * Delete sleep log
   */
  static async deleteSleepLog(logId, userId) {
    try {
      const sleepLog = await SleepLog.findById(logId);
      if (!sleepLog) {
        throw new Error('Sleep log not found');
      }

      // Check ownership
      if (sleepLog.userId.toString() !== userId.toString()) {
        throw new Error('Not authorized to delete this sleep log');
      }

      await SleepLog.findByIdAndDelete(logId);

      // Trigger recovery score recalculation
      this.triggerRecoveryRecalculation(userId);

      return true;
    } catch (error) {
      logger.error(`Delete sleep log error: ${error.message}`);
      throw error;
    }
  }

  /**
   * Get sleep statistics
   */
  static async getSleepStats(userId, period = 'week') {
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

      const sleepLogs = await SleepLog.find({
        userId,
        date: { $gte: startDate, $lte: endDate },
      });

      // Calculate statistics
      let totalDuration = 0;
      let totalLogs = 0;
      const qualityCount = { poor: 0, average: 0, good: 0 };
      const activityCount = {};

      sleepLogs.forEach(log => {
        totalDuration += log.durationMinutes;
        totalLogs++;

        if (log.quality && qualityCount.hasOwnProperty(log.quality)) {
          qualityCount[log.quality]++;
        }

        if (log.activityKey) {
          activityCount[log.activityKey] = (activityCount[log.activityKey] || 0) + 1;
        }
      });

      const avgDuration = totalLogs > 0 ? Math.round(totalDuration / totalLogs) : 0;
      const avgHours = Math.round((avgDuration / 60) * 10) / 10;

      // Calculate sleep consistency
      const uniqueDates = new Set(sleepLogs.map(log => log.date.toDateString()));
      const consistency =
        period === 'day'
          ? 100
          : Math.round((uniqueDates.size / ((endDate - startDate) / (1000 * 60 * 60 * 24))) * 100);

      return {
        period,
        totalLogs,
        totalDuration: Math.round(totalDuration / 60), // Convert to hours
        avgDuration: avgDuration,
        avgHours,
        qualityDistribution: qualityCount,
        activityDistribution: activityCount,
        consistency,
        startDate,
        endDate,
      };
    } catch (error) {
      logger.error(`Get sleep stats error: ${error.message}`);
      throw error;
    }
  }

  /**
   * Get sleep score for a date
   */
  static async getSleepScore(userId, date = null) {
    try {
      const queryDate = date ? new Date(date) : new Date();
      queryDate.setHours(0, 0, 0, 0);

      const sleepLogs = await SleepLog.find({
        userId,
        date: queryDate,
      });

      if (sleepLogs.length === 0) {
        return {
          score: 0,
          totalHours: 0,
          quality: 'no_data',
          message: 'No sleep data for today',
        };
      }

      // Calculate total sleep duration
      let totalDurationHours = 0;
      let bestQuality = 'poor';
      const qualityCount = { poor: 0, average: 0, good: 0 };

      sleepLogs.forEach(log => {
        totalDurationHours += log.durationMinutes / 60;
        if (log.quality && qualityCount.hasOwnProperty(log.quality)) {
          qualityCount[log.quality]++;
        }
      });

      // Determine overall quality
      if (qualityCount.good > 0) {
        bestQuality = 'good';
      } else if (qualityCount.average > 0) {
        bestQuality = 'average';
      }

      const score = calculateSleepScore(totalDurationHours, bestQuality);

      return {
        score,
        totalHours: Math.round(totalDurationHours * 10) / 10,
        quality: bestQuality,
        logs: sleepLogs.length,
        breakdown: qualityCount,
      };
    } catch (error) {
      logger.error(`Get sleep score error: ${error.message}`);
      throw error;
    }
  }

  /**
   * Seed default recovery activities
   */
  static async seedDefaultActivities() {
    try {
      const defaultActivities = [
        {
          key: 'night_sleep',
          title: 'Night Sleep',
          description: 'Track your main sleep block for the day.',
          minDuration: 240,
          maxDuration: 720,
          timingTag: 'sleep',
          applicableShifts: ['fixed_night', 'rotating', 'early_morning', 'off_shift'],
          color: '#6366F1',
          instructions: 'Log your primary sleep window, even if it crosses midnight.',
          order: 0,
        },
        {
          key: 'nap',
          title: 'Nap',
          description: 'Short recovery nap to restore energy.',
          minDuration: 10,
          maxDuration: 120,
          timingTag: 'any_time',
          applicableShifts: ['fixed_night', 'rotating', 'early_morning', 'off_shift'],
          color: '#06B6D4',
          instructions: 'Keep naps short and intentional to avoid grogginess.',
          order: 1,
        },
        {
          key: 'post_shift_wind_down',
          title: 'Post-Shift Wind Down',
          description: 'Gentle sessions to help your mind transition from work mode.',
          minDuration: 5,
          maxDuration: 15,
          timingTag: 'after_shift',
          applicableShifts: ['fixed_night', 'rotating', 'early_morning'],
          color: '#8B5CF6',
          instructions: 'Find a quiet space, practice deep breathing for 5-15 minutes, avoid screens.',
          order: 1,
        },
        {
          key: 'daytime_sleep',
          title: 'Daytime Sleep',
          description: 'Deep relaxation designed for night-shift workers.',
          minDuration: 20,
          maxDuration: 45,
          timingTag: 'sleep',
          applicableShifts: ['fixed_night', 'rotating'],
          color: '#10B981',
          instructions:
            'Use blackout curtains, eye mask, and white noise. Keep naps under 45 minutes to avoid sleep inertia.',
          order: 2,
        },
        {
          key: 'nervous_system_reset',
          title: 'Nervous System Reset',
          description: 'Calm your nervous system with guided relaxation.',
          minDuration: 10,
          maxDuration: 30,
          timingTag: 'any_time',
          applicableShifts: ['fixed_night', 'rotating', 'early_morning'],
          color: '#3B82F6',
          instructions: 'Use guided meditation apps, progressive muscle relaxation, or gentle stretching.',
          order: 3,
        },
        {
          key: 'pre_shift_focus',
          title: 'Pre-Shift Focus',
          description: 'Prepare your mind and body for an upcoming shift.',
          minDuration: 5,
          maxDuration: 20,
          timingTag: 'before_shift',
          applicableShifts: ['fixed_night', 'rotating', 'early_morning'],
          color: '#F59E0B',
          instructions: 'Light exercise, caffeine timing (if appropriate), mental preparation.',
          order: 4,
        },
      ];

      // Insert or update activities
      for (const activity of defaultActivities) {
        await RecoveryActivity.findOneAndUpdate({ key: activity.key }, activity, {
          upsert: true,
          returnDocument: 'after',
        });
      }

      logger.info('Default recovery activities seeded successfully');
      return true;
    } catch (error) {
      logger.error(`Seed default activities error: ${error.message}`);
      throw error;
    }
  }

  /**
   * Trigger recovery score recalculation (async)
   */
  static async triggerRecoveryRecalculation(userId) {
    try {
      logger.info(`Recovery recalculation triggered for user: ${userId}`);
      const WellnessEngine = require('../engine/wellnessEngine.service');
      await WellnessEngine.buildContext(userId).catch(() => null);

      return true;
    } catch (error) {
      logger.error(`Trigger recovery recalculation error: ${error.message}`);
      // Don't throw error here as this is an async operation
    }
  }
}

module.exports = SleepRecoveryService;
