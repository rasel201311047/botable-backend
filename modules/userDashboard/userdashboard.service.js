const User = require('../user/user.model');
const DailyNutritionSummary = require('../../nutrition/dailyNutritionSummary.model');
const NutritionTarget = require('../../nutrition/nutritionTarget.model');
const SleepLog = require('../sleep-recovery/sleepLog.model');
const WorkoutLog = require('../workout/workoutLog.model');
const Meal = require('../nutrition/meal.model');
const Shift = require('../onboarding/shift.model');
const mongoose = require('mongoose');
const {
  calculateSleepScore,
  calculateSleepDuration
} = require('../../utils/sleepScore');
const {
  calculateRecoveryScore
} = require('../../utils/recoveryScore');
const {
  calculateReadinessScore
} = require('../../utils/readinessScore');
const {
  calculateProgress,
  calculateRemaining
} = require('../../utils/macros');
const WellnessEngine = require('../engine/wellnessEngine.service');
const logger = require('../../utils/logger');

class DashboardService {
  /**
   * Get home dashboard data
   */
  static async getHomeDashboard(userId) {
    try {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      
      const tomorrow = new Date(today);
      tomorrow.setDate(tomorrow.getDate() + 1);

      // Step 1: Get user profile
      const user = await User.findById(userId);
      if (!user) {
        throw new Error('User not found');
      }

      // Step 2: Get shift information
      let shiftInfo = null;
      if (user.shiftType) {
        shiftInfo = await Shift.findOne({ name: user.shiftType });
      }

      // Step 3: Get nutrition data for today
      const nutrition = await DailyNutritionSummary.findOne({
        userId,
        date: { $gte: today, $lt: tomorrow }
      });

      // Step 4: Get nutrition targets
      const targets = await NutritionTarget.findOne({ userId });

      // Step 5: Get sleep logs for today
      const sleepLogs = await SleepLog.find({
        userId,
        date: { $gte: today, $lt: tomorrow }
      });

      // Step 6: Get workout logs for today
      const workoutLogs = await WorkoutLog.find({
        userId,
        date: { $gte: today, $lt: tomorrow },
        completed: true
      });

      // Step 7: Get recent meals (last 3)
      const recentMeals = await Meal.find({
        userId,
        date: { $gte: today, $lt: tomorrow }
      })
      .sort({ createdAt: -1 })
      .limit(3);

      // Step 8: Calculate sleep data
      const sleepData = this.calculateSleepData(sleepLogs);

      // Step 9: Calculate workout data
      const workoutData = this.calculateWorkoutData(workoutLogs);

      // Step 10: Calculate nutrition data
      const nutritionData = this.calculateNutritionData(nutrition, targets);

      // Step 11: Calculate scores
      const scores = await this.calculateScores(
        userId,
        sleepData,
        workoutData,
        nutritionData,
        today
      );

      // Step 12: Generate AI message based on shift and scores
      const aiMessage = this.generateAIMessage(user, shiftInfo, scores);

      // Step 13: Determine greeting based on shift
      const greeting = this.generateGreeting(user, shiftInfo);
      const actionPlan = await WellnessEngine.buildActionPlan(userId);

      return {
        greeting,
        aiMessage,
        scores,
        actionPlan,
        sleep: sleepData,
        nutrition: nutritionData,
        recentMeals,
        workout: workoutData,
        notifications: { unreadCount: actionPlan.context.unreadNotificationCount },
        user: {
          name: user.name,
          shiftType: user.shiftType,
          goalType: user.goalType
        }
      };
    } catch (error) {
      logger.error(`Get home dashboard error: ${error.message}`);
      throw error;
    }
  }

  /**
   * Calculate sleep data from logs
   */
  static calculateSleepData(sleepLogs) {
    if (!sleepLogs || sleepLogs.length === 0) {
      return {
        totalHours: 0,
        quality: 'no_data',
        score: 0,
        logs: []
      };
    }

    let totalDuration = 0;
    let bestQuality = 'poor';
    const qualityCount = { poor: 0, average: 0, good: 0 };

    sleepLogs.forEach(log => {
      totalDuration += log.durationMinutes / 60; // Convert to hours
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

    const sleepScore = calculateSleepScore(totalDuration, bestQuality);

    return {
      totalHours: Math.round(totalDuration * 10) / 10,
      quality: bestQuality,
      score: sleepScore,
      logs: sleepLogs.map(log => ({
        startTime: log.startTime,
        endTime: log.endTime,
        duration: log.durationMinutes,
        quality: log.quality
      }))
    };
  }

  /**
   * Calculate workout data
   */
  static calculateWorkoutData(workoutLogs) {
    if (!workoutLogs || workoutLogs.length === 0) {
      return {
        completedCount: 0,
        totalDuration: 0,
        avgIntensity: 'low',
        score: 0
      };
    }

    const completedCount = workoutLogs.length;
    let totalDuration = 0;
    const intensityCount = { low: 0, medium: 0, high: 0 };

    workoutLogs.forEach(log => {
      totalDuration += log.durationMinutes || 0;
      if (log.intensity && intensityCount.hasOwnProperty(log.intensity)) {
        intensityCount[log.intensity]++;
      }
    });

    // Determine average intensity
    let avgIntensity = 'low';
    if (intensityCount.high > 0) {
      avgIntensity = 'high';
    } else if (intensityCount.medium > 0) {
      avgIntensity = 'medium';
    }

    return {
      completedCount,
      totalDuration,
      avgIntensity,
      score: Math.min(completedCount * 20, 100) // Simple score based on completion
    };
  }

  /**
   * Calculate nutrition data
   */
  static calculateNutritionData(nutrition, targets) {
    if (!nutrition) {
      return {
        calories: 0,
        protein: 0,
        carbs: 0,
        fat: 0,
        progress: {
          calories: 0,
          protein: 0,
          carbs: 0,
          fat: 0
        },
        remaining: {
          calories: targets?.calorieTarget || 0,
          protein: targets?.proteinTarget || 0,
          carbs: targets?.carbTarget || 0,
          fat: targets?.fatTarget || 0
        }
      };
    }

    const progress = {
      calories: calculateProgress(nutrition.calories, targets?.calorieTarget || 0),
      protein: calculateProgress(nutrition.protein, targets?.proteinTarget || 0),
      carbs: calculateProgress(nutrition.carbs, targets?.carbTarget || 0),
      fat: calculateProgress(nutrition.fat, targets?.fatTarget || 0)
    };

    const remaining = {
      calories: calculateRemaining(nutrition.calories, targets?.calorieTarget || 0),
      protein: calculateRemaining(nutrition.protein, targets?.proteinTarget || 0),
      carbs: calculateRemaining(nutrition.carbs, targets?.carbTarget || 0),
      fat: calculateRemaining(nutrition.fat, targets?.fatTarget || 0)
    };

    return {
      calories: nutrition.calories,
      protein: nutrition.protein,
      carbs: nutrition.carbs,
      fat: nutrition.fat,
      progress,
      remaining,
      mealCount: nutrition.mealCount
    };
  }

  /**
   * Calculate all scores
   */
  static async calculateScores(userId, sleepData, workoutData, nutritionData, date) {
    // Calculate recovery score
    const recoveryScore = calculateRecoveryScore({
      sleepScore: sleepData.score,
      workoutsToday: workoutData.completedCount,
      workoutIntensity: workoutData.avgIntensity,
      recoveryActivities: 0, // Will be fetched in real implementation
      consecutiveWorkoutDays: await this.getConsecutiveWorkoutDays(userId, date),
      stressLevel: 'medium' // Default
    });

    // Calculate readiness score
    const readinessScore = calculateReadinessScore({
      recoveryScore,
      nutritionAdherence: nutritionData.progress.calories,
      sleepConsistency: await this.getSleepConsistency(userId, 7), // Last 7 days
      hrvScore: 0 // Not implemented yet
    });

    return {
      sleep: sleepData.score,
      recovery: recoveryScore,
      readiness: readinessScore,
      nutrition: nutritionData.progress.calories
    };
  }

  /**
   * Get consecutive workout days
   */
  static async getConsecutiveWorkoutDays(userId, untilDate) {
    try {
      let consecutiveDays = 0;
      let currentDate = new Date(untilDate);
      
      while (consecutiveDays < 30) { // Check up to 30 days back
        const startOfDay = new Date(currentDate);
        startOfDay.setHours(0, 0, 0, 0);
        
        const endOfDay = new Date(currentDate);
        endOfDay.setHours(23, 59, 59, 999);
        
        const workouts = await WorkoutLog.find({
          userId,
          date: { $gte: startOfDay, $lte: endOfDay },
          completed: true
        });
        
        if (workouts.length === 0) {
          break;
        }
        
        consecutiveDays++;
        currentDate.setDate(currentDate.getDate() - 1);
      }
      
      return consecutiveDays;
    } catch (error) {
      logger.error(`Get consecutive workout days error: ${error.message}`);
      return 0;
    }
  }

  /**
   * Get sleep consistency (percentage of days with sleep logged)
   */
  static async getSleepConsistency(userId, days) {
    try {
      const endDate = new Date();
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - days);
      
      const sleepLogs = await SleepLog.find({
        userId,
        date: { $gte: startDate, $lte: endDate }
      }).distinct('date');
      
      const uniqueDays = new Set(sleepLogs.map(date => date.toDateString()));
      const consistency = (uniqueDays.size / days) * 100;
      
      return Math.round(consistency);
    } catch (error) {
      logger.error(`Get sleep consistency error: ${error.message}`);
      return 0;
    }
  }

  /**
   * Generate AI message based on user data
   */
  static generateAIMessage(user, shiftInfo, scores) {
    const messages = [];
    
    // Based on shift type
    if (user.shiftType === 'fixed_night') {
      messages.push(
        "Night shifts can disrupt your circadian rhythm. Try to maintain consistent sleep times even on days off.",
        "Consider a pre-shift light meal to maintain energy through your shift.",
        "Post-shift wind down activities can help you transition to sleep mode."
      );
    } else if (user.shiftType === 'rotating') {
      messages.push(
        "Rotating shifts require careful planning. Gradually adjust your sleep schedule 1-2 days before shift changes.",
        "Keep your meal times consistent regardless of shift to help regulate your body clock."
      );
    } else if (user.shiftType === 'early_morning') {
      messages.push(
        "Early risers benefit from morning sunlight exposure to regulate circadian rhythm.",
        "Consider a post-workout protein-rich breakfast to maximize muscle recovery."
      );
    }
    
    // Based on goal
    if (user.goalType === 'fat_loss') {
      messages.push(
        "For fat loss, focus on protein intake to preserve muscle mass while in a calorie deficit.",
        "Resistance training 3-4 times per week can help maintain metabolism during weight loss."
      );
    } else if (user.goalType === 'strength_building') {
      messages.push(
        "Strength gains require adequate protein (1.6-2.2g per kg of body weight) and recovery time.",
        "Track your progressive overload to ensure consistent strength improvements."
      );
    }
    
    // Based on scores
    if (scores.sleep < 50) {
      messages.push("Your sleep score is low. Aim for 7-9 hours of quality sleep for optimal recovery.");
    }
    
    if (scores.recovery < 40) {
      messages.push("Your recovery score suggests you may need more rest. Consider a lighter workout or active recovery day.");
    }
    
    if (scores.nutrition < 30) {
      messages.push("You're behind on your nutrition goals. Try spacing meals evenly throughout your waking hours.");
    }
    
    // Default message if none match
    if (messages.length === 0) {
      messages.push("Stay consistent with your routine. Small daily habits lead to big long-term results.");
    }
    
    // Return a random message from the filtered list
    const randomIndex = Math.floor(Math.random() * messages.length);
    return messages[randomIndex];
  }

  /**
   * Generate greeting based on shift
   */
  static generateGreeting(user, shiftInfo) {
    const now = new Date();
    const hour = now.getHours();
    let timeOfDay;
    
    if (hour < 12) timeOfDay = "Morning";
    else if (hour < 18) timeOfDay = "Afternoon";
    else timeOfDay = "Evening";
    
    if (user.shiftType === 'fixed_night') {
      if (hour >= 18 || hour < 6) {
        return `Pre-Shift ${timeOfDay}, ${user.name.split(' ')[0]}`;
      } else {
        return `Post-Shift ${timeOfDay}, ${user.name.split(' ')[0]}`;
      }
    } else if (user.shiftType === 'early_morning') {
      if (hour < 12) {
        return `Early ${timeOfDay}, ${user.name.split(' ')[0]}`;
      }
    }
    
    return `Good ${timeOfDay}, ${user.name.split(' ')[0]}`;
  }

  /**
   * Get dashboard stats for analytics
   */
  static async getDashboardStats(userId, period = 'week') {
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
      
      // Get nutrition data
      const nutritionStats = await DailyNutritionSummary.aggregate([
        {
          $match: {
            userId: new mongoose.Types.ObjectId(userId),
            date: { $gte: startDate, $lte: endDate }
          }
        },
        {
          $group: {
            _id: null,
            avgCalories: { $avg: '$calories' },
            avgProtein: { $avg: '$protein' },
            avgCarbs: { $avg: '$carbs' },
            avgFat: { $avg: '$fat' }
          }
        }
      ]);
      
      // Get workout stats
      const workoutStats = await WorkoutLog.aggregate([
        {
          $match: {
            userId: new mongoose.Types.ObjectId(userId),
            date: { $gte: startDate, $lte: endDate },
            completed: true
          }
        },
        {
          $group: {
            _id: null,
            totalWorkouts: { $sum: 1 },
            totalDuration: { $sum: '$durationMinutes' },
            avgDuration: { $avg: '$durationMinutes' }
          }
        }
      ]);
      
      // Get sleep stats
      const sleepStats = await SleepLog.aggregate([
        {
          $match: {
            userId: new mongoose.Types.ObjectId(userId),
            date: { $gte: startDate, $lte: endDate }
          }
        },
        {
          $group: {
            _id: null,
            avgDuration: { $avg: '$durationMinutes' },
            totalLogs: { $sum: 1 }
          }
        }
      ]);
      
      return {
        nutrition: nutritionStats[0] || {
          avgCalories: 0,
          avgProtein: 0,
          avgCarbs: 0,
          avgFat: 0
        },
        workouts: workoutStats[0] || {
          totalWorkouts: 0,
          totalDuration: 0,
          avgDuration: 0
        },
        sleep: sleepStats[0] || {
          avgDuration: 0,
          totalLogs: 0
        },
        period,
        startDate,
        endDate
      };
    } catch (error) {
      logger.error(`Get dashboard stats error: ${error.message}`);
      throw error;
    }
  }
}

module.exports = DashboardService;
