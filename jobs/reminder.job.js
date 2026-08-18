const cron = require('node-cron');
const User = require('../modules/user/user.model');
const WorkoutLog = require('../modules/workout/workoutLog.model');
const Meal = require('../modules/nutrition/meal.model');
const logger = require('../utils/logger');
const { sendReminder } = require('../config/socket');

class ReminderJob {
  /**
   * Initialize reminder jobs
   */
  static init() {
    // Morning reminders - runs at 7 AM
    cron.schedule('0 7 * * *', async () => {
      logger.info('Starting morning reminders...');
      await this.sendMorningReminders();
    });

    // Evening reminders - runs at 7 PM
    cron.schedule('0 19 * * *', async () => {
      logger.info('Starting evening reminders...');
      await this.sendEveningReminders();
    });

    // Shift-based reminders - runs every hour
    cron.schedule('0 * * * *', async () => {
      logger.info('Checking for shift-based reminders...');
      await this.sendShiftBasedReminders();
    });

    logger.info('Reminder jobs initialized');
  }

  /**
   * Send morning reminders
   */
  static async sendMorningReminders() {
    try {
      const users = await User.find({ 
        isActive: true,
        'subscription.isActive': true // Only send to active subscribers
      }).select('_id name email shiftType');

      for (const user of users) {
        try {
          const reminders = await this.getMorningReminders(user);
          
          if (reminders.length > 0) {
            await this.sendUserReminders(user, reminders, 'morning');
          }
        } catch (userError) {
          logger.error(`Error sending morning reminders to user ${user._id}: ${userError.message}`);
          continue;
        }
      }

      logger.info(`Sent morning reminders to ${users.length} users`);
    } catch (error) {
      logger.error(`Morning reminders error: ${error.message}`);
    }
  }

  /**
   * Send evening reminders
   */
  static async sendEveningReminders() {
    try {
      const users = await User.find({ 
        isActive: true,
        'subscription.isActive': true
      }).select('_id name email shiftType');

      for (const user of users) {
        try {
          const reminders = await this.getEveningReminders(user);
          
          if (reminders.length > 0) {
            await this.sendUserReminders(user, reminders, 'evening');
          }
        } catch (userError) {
          logger.error(`Error sending evening reminders to user ${user._id}: ${userError.message}`);
          continue;
        }
      }

      logger.info(`Sent evening reminders to ${users.length} users`);
    } catch (error) {
      logger.error(`Evening reminders error: ${error.message}`);
    }
  }

  /**
   * Send shift-based reminders
   */
  static async sendShiftBasedReminders() {
    try {
      const currentHour = new Date().getHours();
      
      // Determine which shift types need reminders at this hour
      let shiftTypes = [];
      
      if (currentHour === 6) { // 6 AM - Early morning shift prep
        shiftTypes = ['early_morning'];
      } else if (currentHour === 14) { // 2 PM - Afternoon for night shift prep
        shiftTypes = ['fixed_night'];
      } else if (currentHour === 22) { // 10 PM - Night for morning shift prep
        shiftTypes = ['early_morning'];
      }

      if (shiftTypes.length === 0) {
        return;
      }

      const users = await User.find({ 
        isActive: true,
        'subscription.isActive': true,
        shiftType: { $in: shiftTypes }
      }).select('_id name email shiftType');

      for (const user of users) {
        try {
          const reminders = await this.getShiftReminders(user, currentHour);
          
          if (reminders.length > 0) {
            await this.sendUserReminders(user, reminders, 'shift');
          }
        } catch (userError) {
          logger.error(`Error sending shift reminders to user ${user._id}: ${userError.message}`);
          continue;
        }
      }

      logger.info(`Sent shift reminders to ${users.length} users`);
    } catch (error) {
      logger.error(`Shift reminders error: ${error.message}`);
    }
  }

  /**
   * Get morning reminders for a user
   */
  static async getMorningReminders(user) {
    const reminders = [];
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // Check for scheduled workouts
    const scheduledWorkouts = await WorkoutLog.countDocuments({
      userId: user._id,
      date: today,
      scheduledTime: { $ne: null },
      completed: false
    });

    if (scheduledWorkouts > 0) {
      reminders.push({
        type: 'workout',
        message: `You have ${scheduledWorkouts} workout${scheduledWorkouts > 1 ? 's' : ''} scheduled for today.`,
        priority: 'high'
      });
    }

    // Check nutrition goals
    const nutritionTarget = await this.getNutritionTarget(user._id);
    if (nutritionTarget) {
      reminders.push({
        type: 'nutrition',
        message: `Remember to track your meals to reach your daily goal of ${nutritionTarget.calorieTarget} calories.`,
        priority: 'medium'
      });
    }

    // Shift-specific reminders
    if (user.shiftType === 'fixed_night') {
      reminders.push({
        type: 'shift',
        message: 'Night shift workers: Try to get some daytime sleep before your shift.',
        priority: 'medium'
      });
    } else if (user.shiftType === 'early_morning') {
      reminders.push({
        type: 'shift',
        message: 'Early riser: Morning sunlight can help regulate your circadian rhythm.',
        priority: 'low'
      });
    }

    return reminders;
  }

  /**
   * Get evening reminders for a user
   */
  static async getEveningReminders(user) {
    const reminders = [];
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // Check for completed workouts
    const completedWorkouts = await WorkoutLog.countDocuments({
      userId: user._id,
      date: today,
      completed: true
    });

    if (completedWorkouts === 0) {
      reminders.push({
        type: 'activity',
        message: 'No workouts logged today. Even a short walk can help!',
        priority: 'low'
      });
    }

    // Sleep reminder
    reminders.push({
      type: 'sleep',
      message: 'Wind down before bed for better sleep quality.',
      priority: 'medium'
    });

    // Shift-specific reminders
    if (user.shiftType === 'fixed_night') {
      reminders.push({
        type: 'shift',
        message: 'Heading to work? Stay hydrated during your shift.',
        priority: 'medium'
      });
    }

    return reminders;
  }

  /**
   * Get shift reminders for a user
   */
  static async getShiftReminders(user, currentHour) {
    const reminders = [];

    switch (user.shiftType) {
      case 'fixed_night':
        if (currentHour === 14) { // 2 PM
          reminders.push({
            type: 'shift',
            message: 'Night shift in a few hours. Consider a pre-shift nap.',
            priority: 'high'
          });
        }
        break;

      case 'early_morning':
        if (currentHour === 22) { // 10 PM
          reminders.push({
            type: 'shift',
            message: 'Early start tomorrow. Try to get to bed soon.',
            priority: 'high'
          });
        }
        break;

      case 'rotating':
        // Rotating shift reminders would be more complex
        // based on the user's specific schedule
        break;
    }

    return reminders;
  }

  /**
   * Get nutrition target for a user
   */
  static async getNutritionTarget(userId) {
    try {
      const NutritionTarget = require('../nutrition/nutritionTarget.model');
      return await NutritionTarget.findOne({ userId });
    } catch (error) {
      logger.error(`Get nutrition target error: ${error.message}`);
      return null;
    }
  }

  /**
   * Send reminders to a user
   */
static async sendUserReminders(user, reminders, timeOfDay) {
  try {
    // Send push notifications (in production)
    // Send emails (in production)
    
    // Send real-time notifications via Socket.IO
    reminders.forEach(reminder => {
      sendReminder(user._id, {
        type: reminder.type,
        title: reminder.title,
        message: reminder.message,
        priority: reminder.priority,
        action: reminder.action
      });
    });

    // Also log for debugging
    logger.info(`Reminders for ${user.email} (${timeOfDay}):`, {
      userId: user._id,
      reminders: reminders.map(r => ({
        type: r.type,
        message: r.message,
        priority: r.priority
      }))
    });
  } catch (error) {
    logger.error(`Send user reminders error: ${error.message}`);
  }
}
}

module.exports = ReminderJob;