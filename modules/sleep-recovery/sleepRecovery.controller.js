const SleepRecoveryService = require('./sleepRecovery.service');
const WellnessEngine = require('../engine/wellnessEngine.service');
const logger = require('../../utils/logger');

class SleepRecoveryController {
  /**
   * @desc    Get recovery activities
   * @route   GET /api/sleep-recovery/activities
   * @access  Private
   */
  static async getRecoveryActivities(req, res, next) {
    try {
      const activities = await SleepRecoveryService.getRecoveryActivities(req.user.id);

      res.status(200).json({
        status: 'success',
        data: activities,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * @desc    Log sleep/recovery activity
   * @route   POST /api/sleep-recovery/log
   * @access  Private
   */
  static async logActivity(req, res, next) {
    try {
      const { activityKey, startTime, endTime, quality, notes, energyBefore, energyAfter, splitSleep, interruptedSleep, shiftContext } = req.body;

      if (!activityKey || !startTime || !endTime) {
        return res.status(400).json({
          status: 'error',
          message: 'Activity key, start time, and end time are required',
        });
      }

      const sleepLog = await SleepRecoveryService.logActivity(req.user.id, {
        activityKey,
        startTime,
        endTime,
        quality,
        notes,
        energyBefore,
        energyAfter,
        splitSleep,
        interruptedSleep,
        shiftContext,
      });

      try {
        const Notification = require('../notification/notification.model');
        const NotificationService = require('../notification/notification.service');

        // Find existing active reminders for sleep/recovery and mark them resolved
        const startOfDay = new Date();
        startOfDay.setHours(0, 0, 0, 0);

        const activeReminders = await Notification.find({
          userId: req.user.id,
          type: 'SLEEP_RECOVERY',
          lifecycleState: 'active',
          createdAt: { $gte: startOfDay }
        });

        for (const reminder of activeReminders) {
           await NotificationService.markAsRead(reminder._id, req.user.id);
        }

        // Only create a new active notification if quality is poor (follow-up recommendation)
        if (quality === 'poor') {
          await WellnessEngine.recordEvent({
            userId: req.user.id,
            type: 'SLEEP_RECOVERY',
            category: 'sleep',
            title: 'Recovery Follow-up',
            message: `Your ${activityKey} session was logged as poor quality. We recommend prioritizing deep sleep tonight.`,
            sourceModule: 'sleep-recovery',
            sourceId: sleepLog._id.toString(),
            deepLink: '/sleeprecovery',
            priority: 'HIGH',
            dedupeKey: `sleep_followup:${sleepLog.activityKey}:${sleepLog.date.toISOString().slice(0, 10)}`,
            payload: {
              activityKey,
              durationMinutes: sleepLog.durationMinutes,
              quality: sleepLog.quality,
            },
          });
        }
      } catch (notificationError) {
        // Log error but don't fail the activity logging
        logger.error(`Failed to send sleep/recovery notification: ${notificationError.message}`);
      }

      res.status(201).json({
        status: 'success',
        message: 'Activity logged successfully',
        data: sleepLog,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * @desc    Get user sleep logs
   * @route   GET /api/sleep-recovery/logs
   * @access  Private
   */
  static async getSleepLogs(req, res, next) {
    try {
      const { date, limit } = req.query;

      const sleepLogs = await SleepRecoveryService.getUserSleepLogs(req.user.id, date, limit);

      res.status(200).json({
        status: 'success',
        data: sleepLogs,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * @desc    Get sleep log by ID
   * @route   GET /api/sleep-recovery/logs/:id
   * @access  Private
   */
  static async getSleepLogById(req, res, next) {
    try {
      const { id } = req.params;

      const sleepLog = await SleepRecoveryService.getSleepLogById(id);

      // Check ownership
      if (sleepLog.userId._id.toString() !== req.user.id.toString()) {
        return res.status(403).json({
          status: 'error',
          message: 'Not authorized to access this sleep log',
        });
      }

      res.status(200).json({
        status: 'success',
        data: sleepLog,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * @desc    Update sleep log
   * @route   PUT /api/sleep-recovery/logs/:id
   * @access  Private
   */
  static async updateSleepLog(req, res, next) {
    try {
      const { id } = req.params;
      const updateData = req.body;

      const updatedLog = await SleepRecoveryService.updateSleepLog(id, req.user.id, updateData);

      try {
        await WellnessEngine.recordEvent({
          userId: req.user.id,
          type: 'SLEEP_RECOVERY',
          category: 'sleep',
          title: 'Sleep log updated',
          message: `${updatedLog.activityKey} was updated in your log.`,
          sourceModule: 'sleep-recovery',
          sourceId: updatedLog._id.toString(),
          deepLink: '/sleeprecovery',
          priority: 'MEDIUM',
          dedupeKey: `sleep:update:${updatedLog.activityKey}:${updatedLog.date.toISOString().slice(0, 10)}`,
          payload: {
            activityKey: updatedLog.activityKey,
            durationMinutes: updatedLog.durationMinutes,
            quality: updatedLog.quality,
          },
        });
      } catch (notificationError) {
        logger.error(`Failed to send sleep update notification: ${notificationError.message}`);
      }

      res.status(200).json({
        status: 'success',
        message: 'Sleep log updated successfully',
        data: updatedLog,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * @desc    Delete sleep log
   * @route   DELETE /api/sleep-recovery/logs/:id
   * @access  Private
   */
  static async deleteSleepLog(req, res, next) {
    try {
      const { id } = req.params;

      await SleepRecoveryService.deleteSleepLog(id, req.user.id);

      try {
        await WellnessEngine.recordEvent({
          userId: req.user.id,
          type: 'SLEEP_RECOVERY',
          category: 'sleep',
          title: 'Sleep log deleted',
          message: 'A sleep/recovery log was removed from your history.',
          sourceModule: 'sleep-recovery',
          sourceId: id,
          deepLink: '/sleeprecovery',
          priority: 'LOW',
          dedupeKey: `sleep:delete:${id}`,
        });
      } catch (notificationError) {
        logger.error(`Failed to send sleep delete notification: ${notificationError.message}`);
      }

      res.status(200).json({
        status: 'success',
        message: 'Sleep log deleted successfully',
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * @desc    Get sleep statistics
   * @route   GET /api/sleep-recovery/stats
   * @access  Private
   */
  static async getSleepStats(req, res, next) {
    try {
      const { period = 'week' } = req.query;

      const stats = await SleepRecoveryService.getSleepStats(req.user.id, period);

      res.status(200).json({
        status: 'success',
        data: stats,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * @desc    Get sleep score
   * @route   GET /api/sleep-recovery/score
   * @access  Private
   */
  static async getSleepScore(req, res, next) {
    try {
      const { date } = req.query;

      const score = await SleepRecoveryService.getSleepScore(req.user.id, date);

      res.status(200).json({
        status: 'success',
        data: score,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * @desc    Seed default activities (admin only)
   * @route   POST /api/sleep-recovery/seed
   * @access  Private/Admin
   */
  static async seedDefaultActivities(req, res, next) {
    try {
      await SleepRecoveryService.seedDefaultActivities();

      res.status(200).json({
        status: 'success',
        message: 'Default activities seeded successfully',
      });
    } catch (error) {
      next(error);
    }
  }
}

module.exports = SleepRecoveryController;
