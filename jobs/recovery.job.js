const cron = require('node-cron');
const User = require('../modules/user/user.model');
const SleepLog = require('../modules/sleep-recovery/sleepLog.model');
const WorkoutLog = require('../modules/workout/workoutLog.model');
const logger = require('../utils/logger');

class RecoveryJob {
  /**
   * Initialize recovery jobs
   */
  static init() {
    // Daily recovery score calculation - runs at 2 AM
    cron.schedule('0 2 * * *', async () => {
      logger.info('Starting daily recovery score calculation...');
      await this.calculateDailyRecoveryScores();
    });

    // Weekly recovery trend analysis - runs every Monday at 3 AM
    cron.schedule('0 3 * * 1', async () => {
      logger.info('Starting weekly recovery trend analysis...');
      await this.analyzeRecoveryTrends();
    });

    logger.info('Recovery jobs initialized');
  }

  /**
   * Calculate daily recovery scores for all active users
   */
  static async calculateDailyRecoveryScores() {
    try {
      const users = await User.find({ isActive: true }).select('_id name email shiftType');

      for (const user of users) {
        try {
          await this.calculateUserRecoveryScore(user._id);
        } catch (userError) {
          logger.error(`Error calculating recovery score for user ${user._id}: ${userError.message}`);
          continue;
        }
      }

      logger.info(`Calculated recovery scores for ${users.length} users`);
    } catch (error) {
      logger.error(`Daily recovery score calculation error: ${error.message}`);
    }
  }

  /**
   * Calculate recovery score for a specific user
   */
  static async calculateUserRecoveryScore(userId) {
    try {
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      yesterday.setHours(0, 0, 0, 0);

      const today = new Date();
      today.setHours(0, 0, 0, 0);

      // Get sleep data from yesterday
      const sleepLogs = await SleepLog.find({
        userId,
        date: yesterday
      });

      // Get workout data from yesterday
      const workouts = await WorkoutLog.find({
        userId,
        date: yesterday,
        completed: true
      });

      // Calculate sleep score
      const sleepScore = this.calculateSleepScore(sleepLogs);

      // Calculate workout impact
      const workoutImpact = this.calculateWorkoutImpact(workouts);

      // Calculate recovery score (simplified)
      const recoveryScore = Math.max(0, Math.min(100, 
        sleepScore - workoutImpact + 50 // Base score
      ));

      // Here you would save the recovery score to the database
      // For example: UserRecoveryScore.create({ userId, date: yesterday, score: recoveryScore })

      logger.debug(`Calculated recovery score ${recoveryScore} for user ${userId}`);

      return recoveryScore;
    } catch (error) {
      logger.error(`Calculate user recovery score error: ${error.message}`);
      throw error;
    }
  }

  /**
   * Analyze recovery trends
   */
  static async analyzeRecoveryTrends() {
    try {
      const oneWeekAgo = new Date();
      oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);

      // Get all active users
      const users = await User.find({ isActive: true }).select('_id name email');

      for (const user of users) {
        try {
          // Get sleep consistency
          const sleepConsistency = await this.getSleepConsistency(user._id, oneWeekAgo);

          // Get workout frequency
          const workoutFrequency = await this.getWorkoutFrequency(user._id, oneWeekAgo);

          // Analyze trends
          const trends = {
            sleepConsistency,
            workoutFrequency,
            recoveryTrend: this.analyzeTrend([/* recovery scores from past week */]),
            recommendations: this.generateRecommendations(sleepConsistency, workoutFrequency)
          };

          // Here you would save the trend analysis
          logger.debug(`Analyzed recovery trends for user ${user._id}`);
        } catch (userError) {
          logger.error(`Error analyzing trends for user ${user._id}: ${userError.message}`);
          continue;
        }
      }

      logger.info('Weekly recovery trend analysis completed');
    } catch (error) {
      logger.error(`Recovery trend analysis error: ${error.message}`);
    }
  }

  /**
   * Calculate sleep score from logs
   */
  static calculateSleepScore(sleepLogs) {
    if (!sleepLogs || sleepLogs.length === 0) {
      return 0;
    }

    let totalDuration = 0;
    let qualityScore = 0;

    sleepLogs.forEach(log => {
      totalDuration += log.durationMinutes / 60; // Convert to hours
      
      switch (log.quality) {
        case 'good':
          qualityScore += 30;
          break;
        case 'average':
          qualityScore += 20;
          break;
        case 'poor':
          qualityScore += 10;
          break;
        default:
          qualityScore += 15;
      }
    });

    // Duration component (max 70 points)
    let durationScore = 0;
    if (totalDuration >= 7) {
      durationScore = 70;
    } else if (totalDuration >= 5) {
      durationScore = 50;
    } else if (totalDuration >= 3) {
      durationScore = 30;
    } else {
      durationScore = 10;
    }

    // Quality component (max 30 points, average across logs)
    const avgQualityScore = qualityScore / sleepLogs.length;

    return Math.min(100, Math.round(durationScore + avgQualityScore));
  }

  /**
   * Calculate workout impact on recovery
   */
  static calculateWorkoutImpact(workouts) {
    if (!workouts || workouts.length === 0) {
      return 0;
    }

    let totalImpact = 0;

    workouts.forEach(workout => {
      let impact = 0;
      
      switch (workout.intensity) {
        case 'high':
          impact = 25;
          break;
        case 'medium':
          impact = 15;
          break;
        case 'low':
          impact = 5;
          break;
        default:
          impact = 10;
      }

      // Adjust based on duration
      const durationHours = (workout.durationMinutes || 30) / 60;
      impact *= Math.min(durationHours, 2); // Cap at 2 hours

      totalImpact += impact;
    });

    return Math.min(50, totalImpact); // Cap at 50
  }

  /**
   * Get sleep consistency
   */
  static async getSleepConsistency(userId, startDate) {
    try {
      const sleepLogs = await SleepLog.find({
        userId,
        date: { $gte: startDate }
      }).distinct('date');

      const totalDays = Math.ceil((new Date() - startDate) / (1000 * 60 * 60 * 24));
      const consistency = sleepLogs.length / totalDays;

      return Math.round(consistency * 100);
    } catch (error) {
      logger.error(`Get sleep consistency error: ${error.message}`);
      return 0;
    }
  }

  /**
   * Get workout frequency
   */
  static async getWorkoutFrequency(userId, startDate) {
    try {
      const workouts = await WorkoutLog.find({
        userId,
        date: { $gte: startDate },
        completed: true
      }).distinct('date');

      const totalDays = Math.ceil((new Date() - startDate) / (1000 * 60 * 60 * 24));
      const frequency = workouts.length / totalDays;

      return Math.round(frequency * 100);
    } catch (error) {
      logger.error(`Get workout frequency error: ${error.message}`);
      return 0;
    }
  }

  /**
   * Analyze trend from scores
   */
  static analyzeTrend(scores) {
    if (!scores || scores.length < 2) {
      return 'stable';
    }

    const recentScore = scores[scores.length - 1];
    const previousScore = scores[scores.length - 2];

    if (recentScore > previousScore + 10) {
      return 'improving';
    } else if (recentScore < previousScore - 10) {
      return 'declining';
    } else {
      return 'stable';
    }
  }

  /**
   * Generate recommendations based on analysis
   */
  static generateRecommendations(sleepConsistency, workoutFrequency) {
    const recommendations = [];

    if (sleepConsistency < 70) {
      recommendations.push({
        type: 'sleep',
        message: 'Try to maintain a consistent sleep schedule.',
        priority: 'medium'
      });
    }

    if (workoutFrequency > 80) {
      recommendations.push({
        type: 'recovery',
        message: 'Consider adding more recovery days to your routine.',
        priority: 'low'
      });
    } else if (workoutFrequency < 30) {
      recommendations.push({
        type: 'activity',
        message: 'Try to incorporate more physical activity into your routine.',
        priority: 'high'
      });
    }

    return recommendations;
  }
}

module.exports = RecoveryJob;