const NutritionJob = require('./nutrition.job');
const RecoveryJob = require('./recovery.job');
const ReminderJob = require('./reminder.job');
const logger = require('../utils/logger');

class JobManager {
  /**
   * Initialize all background jobs
   */
  static init() {
    try {
      // Initialize jobs
      NutritionJob.init();
      RecoveryJob.init();
      ReminderJob.init();

      logger.info('All background jobs initialized');
    } catch (error) {
      logger.error(`Job manager initialization error: ${error.message}`);
      throw error;
    }
  }
}

module.exports = JobManager;