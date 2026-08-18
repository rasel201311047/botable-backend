const RecoveryActivity = require('../../modules/sleep-recovery/recoveryActivity.model');
const logger = require('../../utils/logger');

class AdminRecoveryController {
  /**
   * @desc    Get all recovery activities
   * @route   GET /api/admin/recovery-activities
   * @access  Private/Admin
   */
  static async getActivities(req, res, next) {
    try {
      const { page = 1, limit = 20, timingTag, isActive } = req.query;

      // Build query
      const query = {};

      if (timingTag) {
        query.timingTag = timingTag;
      }

      if (isActive !== undefined) {
        query.isActive = isActive === 'true';
      }

      const skip = (page - 1) * limit;

      const activities = await RecoveryActivity.find(query)
        .sort({ order: 1, createdAt: -1 })
        .skip(skip)
        .limit(parseInt(limit))
        .lean();

      // Get total count
      const total = await RecoveryActivity.countDocuments(query);

      res.status(200).json({
        status: 'success',
        data: activities,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total,
          pages: Math.ceil(total / limit),
        },
      });
    } catch (error) {
      logger.error(`Admin get recovery activities error: ${error.message}`);
      next(error);
    }
  }

  /**
   * @desc    Create recovery activity
   * @route   POST /api/admin/recovery-activities
   * @access  Private/Admin
   */
  static async createActivity(req, res, next) {
    try {
      const activityData = req.body;

      const activity = await RecoveryActivity.create(activityData);

      res.status(201).json({
        status: 'success',
        message: 'Recovery activity created successfully',
        data: activity,
      });
    } catch (error) {
      logger.error(`Admin create recovery activity error: ${error.message}`);
      next(error);
    }
  }

  /**
   * @desc    Update recovery activity
   * @route   PUT /api/admin/recovery-activities/:id
   * @access  Private/Admin
   */
  static async updateActivity(req, res, next) {
    try {
      const { id } = req.params;
      const updateData = req.body;

      const activity = await RecoveryActivity.findByIdAndUpdate(id, updateData, {
        returnDocument: 'after',
        runValidators: true,
      });

      if (!activity) {
        return res.status(404).json({
          status: 'error',
          message: 'Recovery activity not found',
        });
      }

      res.status(200).json({
        status: 'success',
        message: 'Recovery activity updated successfully',
        data: activity,
      });
    } catch (error) {
      logger.error(`Admin update recovery activity error: ${error.message}`);
      next(error);
    }
  }

  /**
   * @desc    Delete recovery activity
   * @route   DELETE /api/admin/recovery-activities/:id
   * @access  Private/Admin
   */
  static async deleteActivity(req, res, next) {
    try {
      const { id } = req.params;

      const activity = await RecoveryActivity.findById(id);
      if (!activity) {
        return res.status(404).json({
          status: 'error',
          message: 'Recovery activity not found',
        });
      }

      // Check if activity is used in sleep logs
      const SleepLog = require('../../modules/sleep-recovery/sleepLog.model');
      const logCount = await SleepLog.countDocuments({ activityKey: activity.key });

      if (logCount > 0) {
        // Soft delete instead
        activity.isActive = false;
        await activity.save();

        return res.status(200).json({
          status: 'success',
          message: 'Recovery activity deactivated (used in logs)',
        });
      }

      await RecoveryActivity.findByIdAndDelete(id);

      res.status(200).json({
        status: 'success',
        message: 'Recovery activity deleted successfully',
      });
    } catch (error) {
      logger.error(`Admin delete recovery activity error: ${error.message}`);
      next(error);
    }
  }

  /**
   * @desc    Reorder recovery activities
   * @route   PUT /api/admin/recovery-activities/reorder
   * @access  Private/Admin
   */
  static async reorderActivities(req, res, next) {
    try {
      const { order } = req.body; // Array of { id, order }

      if (!Array.isArray(order)) {
        return res.status(400).json({
          status: 'error',
          message: 'Order array is required',
        });
      }

      const bulkOps = order.map(item => ({
        updateOne: {
          filter: { _id: item.id },
          update: { order: item.order },
        },
      }));

      await RecoveryActivity.bulkWrite(bulkOps);

      res.status(200).json({
        status: 'success',
        message: 'Recovery activities reordered successfully',
      });
    } catch (error) {
      logger.error(`Admin reorder recovery activities error: ${error.message}`);
      next(error);
    }
  }
}

module.exports = AdminRecoveryController;
