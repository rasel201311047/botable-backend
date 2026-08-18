const User = require('../../modules/user/user.model');
const WorkoutLog = require('../../modules/workout/workoutLog.model');
const Meal = require('../../modules/nutrition/meal.model');
const SleepLog = require('../../modules/sleep-recovery/sleepLog.model');
const logger = require('../../utils/logger');
const mongoose = require('mongoose');

class AdminAnalyticsController {
  /**
   * @desc    Get dashboard overview
   * @route   GET /api/admin/analytics/overview
   * @access  Private/Admin
   */
  static async getOverview(req, res, next) {
    try {
      const data = await AdminAnalyticsController.buildOverviewData();

      res.status(200).json({
        status: 'success',
        data
      });
    } catch (error) {
      logger.error(`Admin get overview error: ${error.message}`);
      next(error);
    }
  }

  /**
   * Build overview data without sending a response (used by dashboard aggregation)
   */
  static async buildOverviewData() {
    const today = new Date();
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    // Get total counts
    const [
      totalUsers,
      activeUsers,
      newUsersToday,
      totalWorkouts,
      totalMeals,
      totalSleepLogs,
      subscriptionStats
    ] = await Promise.all([
      User.countDocuments(),
      User.countDocuments({ isActive: true }),
      User.countDocuments({ createdAt: { $gte: today.setHours(0, 0, 0, 0) } }),
      WorkoutLog.countDocuments(),
      Meal.countDocuments(),
      SleepLog.countDocuments(),
      AdminAnalyticsController.getSubscriptionStats()
    ]);

    // Get daily activity for last 30 days
    const dailyActivity = await AdminAnalyticsController.getDailyActivity(thirtyDaysAgo, today);

    // Get user growth
    const userGrowth = await AdminAnalyticsController.getUserGrowth(thirtyDaysAgo, today);

    return {
      overview: {
        totalUsers,
        activeUsers,
        newUsersToday,
        totalWorkouts,
        totalMeals,
        totalSleepLogs,
        activeRate: totalUsers > 0 ? Math.round((activeUsers / totalUsers) * 100) : 0
      },
      subscriptions: subscriptionStats,
      dailyActivity,
      userGrowth,
      period: {
        start: thirtyDaysAgo,
        end: today
      }
    };
  }

  /**
   * @desc    Get usage statistics
   * @route   GET /api/admin/analytics/usage
   * @access  Private/Admin
   */
  static async getUsageStats(req, res, next) {
    try {
      const data = await AdminAnalyticsController.buildUsageStatsData(req.query?.startDate, req.query?.endDate);

      res.status(200).json({
        status: 'success',
        data
      });
    } catch (error) {
      logger.error(`Admin get usage stats error: ${error.message}`);
      next(error);
    }
  }

  /**
   * Build usage stats data without sending a response (used by dashboard aggregation)
   */
  static async buildUsageStatsData(startDate, endDate) {
    const start = startDate ? new Date(startDate) : new Date();
    start.setDate(start.getDate() - 30);
    start.setHours(0, 0, 0, 0);
    
    const end = endDate ? new Date(endDate) : new Date();
    end.setHours(23, 59, 59, 999);

    // Get workout usage
    const workoutStats = await WorkoutLog.aggregate([
      {
        $match: {
          date: { $gte: start, $lte: end }
        }
      },
      {
        $group: {
          _id: { $dateToString: { format: '%Y-%m-%d', date: '$date' } },
          count: { $sum: 1 }
        }
      },
      { $sort: { _id: 1 } }
    ]);

    // Get meal usage
    const mealStats = await Meal.aggregate([
      {
        $match: {
          date: { $gte: start, $lte: end }
        }
      },
      {
        $group: {
          _id: { $dateToString: { format: '%Y-%m-%d', date: '$date' } },
          count: { $sum: 1 }
        }
      },
      { $sort: { _id: 1 } }
    ]);

    // Get sleep log usage
    const sleepStats = await SleepLog.aggregate([
      {
        $match: {
          date: { $gte: start, $lte: end }
        }
      },
      {
        $group: {
          _id: { $dateToString: { format: '%Y-%m-%d', date: '$date' } },
          count: { $sum: 1 }
        }
      },
      { $sort: { _id: 1 } }
    ]);

    // Get user engagement
    const userEngagement = await AdminAnalyticsController.getUserEngagement(start, end);

    return {
      workoutStats,
      mealStats,
      sleepStats,
      userEngagement,
      period: { start, end }
    };
  }

  /**
   * @desc    Get dashboard stats (summary) with year filtering
   * @route   GET /api/admin/dashboard?year=2026
   * @access  Private/Admin
   */
  static async getDashboardStats(req, res, next) {
    try {
      const { year } = req.query;
      const targetYear = parseInt(year) || new Date().getFullYear();

      // Get total users and revenue
      const totalUsers = await User.countDocuments();
      const activeUsers = await User.countDocuments({ isActive: true });
      const totalSubscribers = await User.countDocuments({
        'subscription.plan': { $in: ['monthly', 'yearly'] }
      });

      // Calculate total revenue
      const monthlyRevenue = await User.countDocuments({
        'subscription.plan': 'monthly',
        'subscription.isActive': true
      }) * 10;

      const yearlyRevenue = await User.countDocuments({
        'subscription.plan': 'yearly',
        'subscription.isActive': true
      }) * 100;

      const totalRevenue = monthlyRevenue + yearlyRevenue;

      // Get monthly statistics for the selected year
      const monthlyStats = [];
      
      for (let month = 1; month <= 12; month++) {
        const startDate = new Date(targetYear, month - 1, 1);
        const endDate = new Date(targetYear, month, 0, 23, 59, 59, 999);

        // New users this month
        const newUsers = await User.countDocuments({
          createdAt: { $gte: startDate, $lte: endDate }
        });

        // New subscribers this month
        const newSubscribers = await User.countDocuments({
          'subscription.plan': { $in: ['monthly', 'yearly'] },
          'subscription.startDate': { $gte: startDate, $lte: endDate }
        });

        // Revenue for this month
        const monthlyNewSubs = await User.countDocuments({
          'subscription.plan': 'monthly',
          'subscription.startDate': { $gte: startDate, $lte: endDate }
        });

        const yearlyNewSubs = await User.countDocuments({
          'subscription.plan': 'yearly',
          'subscription.startDate': { $gte: startDate, $lte: endDate }
        });

        const monthRevenue = (monthlyNewSubs * 10) + (yearlyNewSubs * 100);

        monthlyStats.push({
          month: month,
          monthName: new Date(targetYear, month - 1).toLocaleString('en-US', { month: 'long' }),
          year: targetYear,
          newUsers: newUsers,
          newSubscribers: newSubscribers,
          revenue: monthRevenue
        });
      }

      // Get overview data (similar to before)
      const overview = await AdminAnalyticsController.buildOverviewData();

      // Calculate year totals
      const yearStartDate = new Date(targetYear, 0, 1);
      const yearEndDate = new Date(targetYear, 11, 31, 23, 59, 59, 999);

      const yearNewUsers = await User.countDocuments({
        createdAt: { $gte: yearStartDate, $lte: yearEndDate }
      });

      const yearNewSubscribers = await User.countDocuments({
        'subscription.plan': { $in: ['monthly', 'yearly'] },
        'subscription.startDate': { $gte: yearStartDate, $lte: yearEndDate }
      });

      const yearRevenue = monthlyStats.reduce((sum, m) => sum + m.revenue, 0);

      res.status(200).json({
        status: 'success',
        data: {
          summary: {
            totalRevenue,
            totalUsers,
            totalSubscribers,
            activeUsers,
            conversionRate: totalUsers > 0 ? ((totalSubscribers / totalUsers) * 100).toFixed(2) + '%' : '0%'
          },
          yearStats: {
            year: targetYear,
            newUsers: yearNewUsers,
            newSubscribers: yearNewSubscribers,
            revenue: yearRevenue
          },
          monthlyBreakdown: monthlyStats,
          chartData: {
            labels: monthlyStats.map(m => m.monthName),
            datasets: [
              {
                label: 'New Users',
                data: monthlyStats.map(m => m.newUsers)
              },
              {
                label: 'New Subscribers',
                data: monthlyStats.map(m => m.newSubscribers)
              },
              {
                label: 'Revenue ($)',
                data: monthlyStats.map(m => m.revenue)
              }
            ]
          },
          overview
        }
      });
    } catch (error) {
      logger.error(`Admin get dashboard stats error: ${error.message}`);
      next(error);
    }
  }

  /**
   * Get subscription statistics
   */
  static async getSubscriptionStats() {
    try {
      const stats = await User.aggregate([
        {
          $group: {
            _id: '$subscription.plan',
            count: { $sum: 1 },
            active: {
              $sum: {
                $cond: [{ $eq: ['$subscription.isActive', true] }, 1, 0]
              }
            }
          }
        }
      ]);

      const formattedStats = {
        free: { total: 0, active: 0 },
        monthly: { total: 0, active: 0 },
        yearly: { total: 0, active: 0 }
      };

      stats.forEach(stat => {
        if (stat._id && formattedStats.hasOwnProperty(stat._id)) {
          formattedStats[stat._id] = {
            total: stat.count,
            active: stat.active
          };
        }
      });

      return formattedStats;
    } catch (error) {
      logger.error(`Get subscription stats error: ${error.message}`);
      return { free: { total: 0, active: 0 }, monthly: { total: 0, active: 0 }, yearly: { total: 0, active: 0 } };
    }
  }

  /**
   * Get daily activity
   */
  static async getDailyActivity(startDate, endDate) {
    try {
      const activity = await User.aggregate([
        {
          $match: {
            lastLogin: { $gte: startDate, $lte: endDate }
          }
        },
        {
          $group: {
            _id: { $dateToString: { format: '%Y-%m-%d', date: '$lastLogin' } },
            count: { $sum: 1 }
          }
        },
        { $sort: { _id: 1 } }
      ]);

      return activity;
    } catch (error) {
      logger.error(`Get daily activity error: ${error.message}`);
      return [];
    }
  }

  /**
   * Get user growth
   */
  static async getUserGrowth(startDate, endDate) {
    try {
      const growth = await User.aggregate([
        {
          $match: {
            createdAt: { $gte: startDate, $lte: endDate }
          }
        },
        {
          $group: {
            _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } },
            count: { $sum: 1 }
          }
        },
        { $sort: { _id: 1 } }
      ]);

      // Calculate cumulative growth
      let cumulative = 0;
      const cumulativeGrowth = growth.map(day => {
        cumulative += day.count;
        return {
          date: day._id,
          daily: day.count,
          cumulative
        };
      });

      return cumulativeGrowth;
    } catch (error) {
      logger.error(`Get user growth error: ${error.message}`);
      return [];
    }
  }

  /**
   * Get user engagement
   */
  static async getUserEngagement(startDate, endDate) {
    try {
      // Get users with activity counts
      const engagement = await User.aggregate([
        {
          $lookup: {
            from: 'workoutlogs',
            localField: '_id',
            foreignField: 'userId',
            as: 'workouts'
          }
        },
        {
          $lookup: {
            from: 'meals',
            localField: '_id',
            foreignField: 'userId',
            as: 'meals'
          }
        },
        {
          $lookup: {
            from: 'sleeplogs',
            localField: '_id',
            foreignField: 'userId',
            as: 'sleepLogs'
          }
        },
        {
          $project: {
            name: 1,
            email: 1,
            workoutCount: { $size: '$workouts' },
            mealCount: { $size: '$meals' },
            sleepLogCount: { $size: '$sleepLogs' },
            totalActivity: {
              $add: [
                { $size: '$workouts' },
                { $size: '$meals' },
                { $size: '$sleepLogs' }
              ]
            },
            lastLogin: 1,
            createdAt: 1
          }
        },
        { $sort: { totalActivity: -1 } },
        { $limit: 10 }
      ]);

      return engagement;
    } catch (error) {
      logger.error(`Get user engagement error: ${error.message}`);
      return [];
    }
  }
}

module.exports = AdminAnalyticsController;