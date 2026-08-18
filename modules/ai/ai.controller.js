const AIService = require('./ai.service');
const logger = require('../../utils/logger');
const { calculateScores, calcNutritionTargets } = require('./engine/score_engine');
const { generateSuggestions } = require('./engine/suggestion_engine');
const { generateWeeklyPlan } = require('./engine/workout_planner');
const { generateNutritionAdvice } = require('./engine/nutrition_engine');
const { generateSleepAdvice } = require('./engine/sleep_engine');
const { generateWeeklySummary, generateCheckinInsights, analyzeProgressHistory } = require('./engine/progress_engine');
const AIProgressSnapshot = require('./aiProgressSnapshot.model');
const AICheckinSnapshot = require('./aiCheckinSnapshot.model');

class AIController {
    /**
     * @desc    Get AI suggestions
     * @route   GET /api/ai/suggestions
     * @access  Private
     */
    static async getSuggestions(req, res, next) {
        try {
            const { context } = req.query;

            const suggestions = await AIService.getSuggestions(req.user.id, context);

            res.status(200).json({
                status: 'success',
                data: suggestions,
            });
        } catch (error) {
            next(error);
        }
    }

    /**
     * @desc    Get personalized workout plan
     * @route   GET /api/ai/workout-plan
     * @access  Private (Premium only)
     */
    static async getWorkoutPlan(req, res, next) {
        try {
            const { goal, duration } = req.query;

            const plan = await AIService.generateWorkoutPlan(req.user.id, goal, duration);

            res.status(200).json({
                status: 'success',
                data: plan,
            });
        } catch (error) {
            next(error);
        }
    }

    /**
     * @desc    Get nutrition advice
     * @route   GET /api/ai/nutrition-advice
     * @access  Private (Premium only)
     */
    static async getNutritionAdvice(req, res, next) {
        try {
            const advice = await AIService.getNutritionAdvice(req.user.id);

            res.status(200).json({
                status: 'success',
                data: advice,
            });
        } catch (error) {
            next(error);
        }
    }

    /**
     * @desc    Get sleep optimization tips
     * @route   GET /api/ai/sleep-tips
     * @access  Private
     */

    static async getSleepTips(req, res, next) {
        try {
            const tips = await AIService.getSleepTips(req.user.id);

            res.status(200).json({
                status: 'success',
                data: tips,
            });
        } catch (error) {
            next(error);
        }
    }

    /**
     * @desc    Analyze progress and get insights
     * @route   GET /api/ai/progress-insights
     * @access  Private (Premium only)
     */
    static async getProgressInsights(req, res, next) {
        try {
            const { period = 'week' } = req.query;

            const insights = await AIService.analyzeProgress(req.user.id, period);

            res.status(200).json({
                status: 'success',
                data: insights,
            });
        } catch (error) {
            next(error);
        }
    }

    /**
     * @desc    Chat with AI fitness coach
     * @route   POST /api/ai/chat
     * @access  Private (Premium only)
     */
    static async chatWithAI(req, res, next) {
        try {
            const { message, context } = req.body;

            if (!message) {
                return res.status(400).json({
                    status: 'error',
                    message: 'Message is required',
                });
            }

            const response = await AIService.chatWithAI(req.user.id, message, context);

            res.status(200).json({
                status: 'success',
                data: response,
            });
        } catch (error) {
            next(error);
        }
    }

    /**
     * @desc    Get chat history
     * @route   GET /api/ai/history
     * @access  Private
     */
    static async getChatHistory(req, res, next) {
        try {
            const { limit = 20 } = req.query;

            const history = await AIService.getChatHistory(req.user.id, parseInt(limit));

            res.status(200).json({
                status: 'success',
                data: {
                    count: history.length,
                    history,
                },
            });
        } catch (error) {
            next(error);
        }
    }

    /**
     * @desc    Profile data -> AI suggestions, sleep, workout plan, nutrition
     * @route   POST /api/ai/analyze
     * @access  Private
     */
    static async analyze(req, res, next) {
        try {
            const u = req.body;
            u.user_id = req.user.id;
            
            const scores = await calculateScores(u);
            const suggestions = await generateSuggestions(u, scores);
            const workout = await generateWeeklyPlan(u, scores, u.week_number || 1, u.equipment || "body weight");
            const nutrition = await generateNutritionAdvice(u, scores);
            const sleep = await generateSleepAdvice(u, scores);
            const summary = await generateWeeklySummary(u, scores);

            // Save profile snapshot for progress history
            const snapshot = new AIProgressSnapshot({
                userId: req.user.id,
                user_id: req.user.id,
                week_label: u.week_label,
                age: u.age,
                weight_kg: u.weight_kg,
                height_cm: u.height_cm,
                sleep_hours: u.sleep_hours,
                energy_level: u.energy_level,
                days_since_rest: u.days_since_rest,
                goal: u.goal,
                shift_type: u.shift_type,
                recovery_score: scores.recovery_score,
                sleep_score: scores.sleep_score,
                energy_score: scores.energy_score,
                workout_readiness: scores.workout_readiness,
                nutrition_score: scores.nutrition_score,
                weekly_summary: summary.weekly_summary,
                strengths: summary.strengths,
                next_steps: summary.next_steps,
            });
            await snapshot.save();

            const t = nutrition.daily_targets;

            res.status(200).json({
                user_id: req.user.id,
                user_name: u.name,
                week_label: u.week_label,
                generated_at: new Date().toISOString(),
                scores: scores,
                suggestions: suggestions,
                workout_plan: workout,
                nutrition: nutrition,
                sleep: sleep,
            });
        } catch (error) {
            next(error);
        }
    }

    /**
     * @desc    Weekly check-in data -> AI progress insights
     * @route   POST /api/ai/progress/checkin
     * @access  Private
     */
    static async progressCheckin(req, res, next) {
        try {
            const userId = req.user.id;
            const checkinData = req.body;
            checkinData.user_id = userId;

            const profileSnaps = await AIProgressSnapshot.find({ userId }).sort({ createdAt: 1 });
            const pastCheckins = await AICheckinSnapshot.find({ userId }).sort({ createdAt: 1 });

            const insights = await generateCheckinInsights(checkinData, profileSnaps, pastCheckins);

            // Save check-in snapshot
            const snapshot = new AICheckinSnapshot({
                userId: userId,
                user_id: userId,
                week_label: checkinData.week_label,
                current_weight_kg: checkinData.current_weight_kg,
                current_sleep_hours: checkinData.current_sleep_hours,
                current_energy_level: checkinData.current_energy_level,
                current_stress_level: checkinData.current_stress_level,
                workouts_completed: checkinData.workouts_completed,
                workouts_missed: checkinData.workouts_missed,
                days_since_rest: checkinData.days_since_rest,
                ai_summary: insights.ai_summary,
                strengths: insights.strengths,
                areas_for_improvement: insights.areas_for_improvement,
                recommended_next_steps: insights.recommended_next_steps,
                overall_trend: insights.overall_trend,
                top_improvements: insights.top_improvements,
                persistent_weaknesses: insights.persistent_weaknesses,
            });
            await snapshot.save();

            res.status(200).json(insights);
        } catch (error) {
            next(error);
        }
    }

    /**
     * @desc    Full history -> AI trend analysis
     * @route   GET /api/ai/progress/:userId
     * @access  Private
     */
    static async analyzeProgressHistory(req, res, next) {
        try {
            const targetUserId = req.params.userId || req.user.id;
            const profileSnaps = await AIProgressSnapshot.find({ userId: targetUserId }).sort({ createdAt: 1 });
            
            if (profileSnaps.length === 0) {
                return res.status(404).json({ message: "No history found for this user." });
            }

            const analysis = await analyzeProgressHistory(profileSnaps);
            res.status(200).json(analysis);
        } catch (error) {
            next(error);
        }
    }
}

module.exports = AIController;
