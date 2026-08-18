const cron = require('node-cron');
const mongoose = require('mongoose');
const User = require('../modules/user/user.model');
const DailyNutritionSummary = require('../nutrition/dailyNutritionSummary.model');
const logger = require('../utils/logger');

class NutritionJob {
  /**
   * Initialize nutrition jobs
   */
  static init() {
    // Daily reset job - runs at midnight
    cron.schedule('0 0 * * *', async () => {
      logger.info('Starting daily nutrition summary cleanup...');
      await this.cleanupOldSummaries();
    });

    // Weekly summary job - runs every Sunday at 1 AM
    cron.schedule('0 1 * * 0', async () => {
      logger.info('Starting weekly nutrition analysis...');
      await this.generateWeeklyReports();
    });

    logger.info('Nutrition jobs initialized');
  }

  /**
   * Cleanup old nutrition summaries (keep only 90 days)
   */
  static async cleanupOldSummaries() {
    try {
      const ninetyDaysAgo = new Date();
      ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);

      const result = await DailyNutritionSummary.deleteMany({
        date: { $lt: ninetyDaysAgo }
      });

      logger.info(`Cleaned up ${result.deletedCount} old nutrition summaries`);
    } catch (error) {
      logger.error(`Nutrition summary cleanup error: ${error.message}`);
    }
  }

  /**
   * Generate weekly nutrition reports for users
   */
  static async generateWeeklyReports() {
    try {
      const oneWeekAgo = new Date();
      oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);

      // Get all active users
      const users = await User.find({ isActive: true }).select('_id name email');

      for (const user of users) {
        try {
          // Get weekly nutrition summary
          const weeklySummary = await DailyNutritionSummary.aggregate([
            {
              $match: {
                userId: user._id,
                date: { $gte: oneWeekAgo }
              }
            },
            {
              $group: {
                _id: null,
                avgCalories: { $avg: '$calories' },
                avgProtein: { $avg: '$protein' },
                avgCarbs: { $avg: '$carbs' },
                avgFat: { $avg: '$fat' },
                totalMeals: { $sum: '$mealCount' },
                daysLogged: { $sum: 1 }
              }
            }
          ]);

          if (weeklySummary.length > 0) {
            const summary = weeklySummary[0];
            
            // Here you would:
            // 1. Generate a report
            // 2. Store it in the database
            // 3. Send email notification (if user opted in)
            
            logger.info(`Generated weekly report for user ${user.email}`);
          }
        } catch (userError) {
          logger.error(`Error generating report for user ${user._id}: ${userError.message}`);
          continue;
        }
      }

      logger.info('Weekly nutrition reports generated');
    } catch (error) {
      logger.error(`Weekly report generation error: ${error.message}`);
    }
  }

  /**
   * Update nutrition summary for a user (called when meal is added/updated/deleted)
   */
  static async updateUserNutritionSummary(userId, date) {
    try {
      const Meal = require('../nutrition/meal.model');
      
      const targetDate = new Date(date);
      targetDate.setHours(0, 0, 0, 0);

      // Get all meals for the day
      const meals = await Meal.find({
        userId,
        date: targetDate
      });

      // Calculate totals
      const totals = meals.reduce((acc, meal) => ({
        calories: acc.calories + (meal.calories || 0),
        protein: acc.protein + (meal.protein || 0),
        carbs: acc.carbs + (meal.carbs || 0),
        fat: acc.fat + (meal.fat || 0)
      }), { calories: 0, protein: 0, carbs: 0, fat: 0 });

      // Update or create summary
      await DailyNutritionSummary.findOneAndUpdate(
        { userId, date: targetDate },
        {
          userId,
          date: targetDate,
          calories: Math.round(totals.calories),
          protein: Math.round(totals.protein * 10) / 10,
          carbs: Math.round(totals.carbs * 10) / 10,
          fat: Math.round(totals.fat * 10) / 10,
          mealCount: meals.length,
          lastMealAt: meals.length > 0 ? new Date(Math.max(...meals.map(m => m.createdAt))) : null,
          updatedAt: new Date()
        },
        { upsert: true }
      );

      logger.debug(`Updated nutrition summary for user ${userId} on ${targetDate.toISOString()}`);
    } catch (error) {
      logger.error(`Update user nutrition summary error: ${error.message}`);
      throw error;
    }
  }
}

module.exports = NutritionJob;