/**
 * AI Assistant service.
 *
 * Every tool is built from the same per-user data snapshot (see context/userContext.service.js):
 * profile + body metrics, nutrition targets and consumption logs, sleep logs vs. a personal
 * sleep target, training history and readiness. The heavy lifting is deterministic, so the
 * screens respond in milliseconds; AI-written coaching notes are fetched separately and cached
 * (see coachNote.service.js) so they never block a screen.
 */
const Food = require('../nutrition/food.model');
const logger = require('../../utils/logger');
const { buildUserContext } = require('./context/userContext.service');
const { buildSuggestions } = require('./insights/suggestionInsights');
const { buildNutritionAdvice } = require('./insights/nutritionInsights');
const { buildSleepCoaching } = require('./insights/sleepInsights');
const { buildProgressInsights } = require('./insights/progressInsights');
const { buildWorkoutPlan } = require('./insights/workoutPlanner');
const { prewarm: prewarmExercises } = require('./insights/exerciseLibrary');
const chatService = require('./chat.service');
const coachNote = require('./coachNote.service');

const VALID_GOALS = ['fat_loss', 'strength_building', 'maintenance'];

// Warm the exercise library in the background so the first workout plan has full exercise data
if (process.env.NODE_ENV !== 'test') {
  setTimeout(() => prewarmExercises().catch(() => {}), 2000);
}

/** Foods from the shared database that are realistic suggestions (sane serving + macros). */
const loadFoodPool = async () => {
  try {
    return await Food.find({
      isActive: { $ne: false },
      createdBy: null, // skip foods typed in by individual users
      source: { $in: ['usda', 'manual'] },
      protein: { $gte: 8, $lte: 70 },
      calories: { $gt: 40, $lte: 700 },
      servingSize: { $gte: 20, $lte: 400 },
    })
      .sort({ protein: -1 })
      .limit(80)
      .maxTimeMS(1500)
      .lean();
  } catch (error) {
    logger.warn(`AI food pool unavailable: ${error.message}`);
    return [];
  }
};

class AIService {
  /** Today's prioritised suggestions. */
  static async getSuggestions(userId, context = 'dashboard') {
    try {
      const ctx = await buildUserContext(userId, { days: 14 });
      return buildSuggestions(ctx, { context });
    } catch (error) {
      logger.error(`Get AI suggestions error: ${error.message}`);
      return AIService.getFallbackSuggestions();
    }
  }

  static getFallbackSuggestions() {
    return [
      {
        id: 'fallback-0',
        type: 'profile',
        title: 'Welcome to Bootble!',
        message: 'Start by logging your first workout, meal or sleep so Bootsy can tailor your plan.',
        priority: 'low',
        action: 'log_meal',
      },
    ];
  }

  /** Personalised workout plan (week or month). */
  static async generateWorkoutPlan(userId, goal, duration = 'week', equipment = 'home') {
    const ctx = await buildUserContext(userId, { days: 14 });
    if (!ctx.profile.goal && VALID_GOALS.includes(goal)) {
      ctx.profile.goal = goal;
      ctx.profile.goalLabel = { fat_loss: 'Fat Loss', strength_building: 'Strength Building', maintenance: 'Maintenance' }[goal];
    }
    return buildWorkoutPlan(ctx, { duration: duration === 'month' ? 'month' : 'week', equipment });
  }

  /** "Analyze my macros". */
  static async getNutritionAdvice(userId) {
    const ctx = await buildUserContext(userId, { days: 14 });
    const needsFoods = ctx.nutrition.remaining.protein > 10 || ctx.nutrition.remaining.calories > 150;
    const foodPool = needsFoods ? await loadFoodPool() : [];
    return buildNutritionAdvice(ctx, foodPool);
  }

  /** "Optimize my sleep". Shape stays compatible with the sleep logger's suggested windows. */
  static async getSleepTips(userId) {
    const ctx = await buildUserContext(userId, { days: 14 });
    return buildSleepCoaching(ctx);
  }

  /** "Analyze progress" for the week or the last 4 weeks. */
  static async analyzeProgress(userId, period = 'week') {
    const p = period === 'month' ? 'month' : 'week';
    const ctx = await buildUserContext(userId, { days: p === 'month' ? 56 : 14 });
    return buildProgressInsights(ctx, p);
  }

  static chatWithAI(userId, message) {
    return chatService.chat(userId, message);
  }

  static getChatHistory(userId, limit = 20) {
    return chatService.history(userId, limit);
  }

  static getChatSnapshot(userId) {
    return chatService.snapshot(userId);
  }

  static getCoachNote(userId, tool) {
    return coachNote.getCoachNote(userId, tool);
  }
}

module.exports = AIService;
