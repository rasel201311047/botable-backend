const User = require('../user/user.model');
const WorkoutLog = require('../workout/workoutLog.model');
const Meal = require('../nutrition/meal.model');
const Food = require('../nutrition/food.model');
const SleepLog = require('../sleep-recovery/sleepLog.model');
const DailyNutritionSummary = require('../../nutrition/dailyNutritionSummary.model');
const NutritionTarget = require('../../nutrition/nutritionTarget.model');
const AIChat = require('./aiChat.model');
const SubscriptionService = require('../subscription/subscription.service');
const WellnessEngine = require('../engine/wellnessEngine.service');
const { openai } = require('../../config/openai');
const { calculateSleepScore } = require('../../utils/sleepScore');
const { calculateRecoveryScore } = require('../../utils/recoveryScore');
const { calculateReadinessScore } = require('../../utils/readinessScore');
const { generateWeeklyPlan } = require('./engine/workout_planner');
const logger = require('../../utils/logger');

class AIService {
    /**
     * Get AI suggestions based on user context
     */
    static async getSuggestions(userId, context = 'dashboard') {
        try {
            const engineContext = await WellnessEngine.buildContext(userId);
            const user = engineContext.user;
            if (!user) {
                throw new Error('User not found');
            }

            // Check if user has premium access for advanced AI
            const hasPremium = await SubscriptionService.hasPremiumAccess(userId);

            const suggestions = [];

            // Context-based suggestions
            switch (context) {
                case 'dashboard':
                    suggestions.push(...(await this.getDashboardSuggestions(user, engineContext)));
                    break;
                case 'workout':
                    suggestions.push(...(await this.getWorkoutSuggestions(user, engineContext)));
                    break;
                case 'nutrition':
                    suggestions.push(...(await this.getNutritionSuggestions(user, engineContext)));
                    break;
                case 'sleep':
                    suggestions.push(...(await this.getSleepSuggestions(user, engineContext)));
                    break;
                default:
                    suggestions.push(...(await this.getGeneralSuggestions(user, engineContext)));
            }

            // Add premium suggestions if applicable
            if (hasPremium) {
                suggestions.push(...(await this.getPremiumSuggestions(user)));
            }

            // Limit to 5 suggestions
            return suggestions.slice(0, 5);
        } catch (error) {
            logger.error(`Get AI suggestions error: ${error.message}`);
            return this.getFallbackSuggestions();
        }
    }

    /**
     * Get dashboard suggestions
     */
    static async getDashboardSuggestions(user, context = {}) {
        const suggestions = [];
        const readiness = context.scores?.workout_readiness ?? context.scores?.readiness ?? 50;
        const recentWorkouts = context.workouts?.length || 0;
        const recentMeals = context.nutrition?.mealCount || 0;
        const recentSleep = context.sleepLogs?.length || 0;
        const shiftType = user.shiftType || 'regular';

        // 1. Evaluate Recovery & Sleep Needs First
        if (readiness < 40 || recentSleep === 0) {
            suggestions.push({
                type: 'sleep',
                title: 'Critical: Prioritize Recovery',
                message: `Your readiness is low (${Math.round(readiness)}/100). Focus on sleep and hydration before attempting any strenuous workouts.`,
                priority: 'high',
                action: 'log_sleep',
            });
            // If they are tired, active recovery might be an option but not a full workout
            if (recentWorkouts === 0) {
                suggestions.push({
                    type: 'workout',
                    title: 'Active Recovery Only',
                    message: 'Take a light walk or do some stretching to aid recovery without taxing your central nervous system.',
                    priority: 'low',
                    action: 'schedule_workout',
                });
            }
        } else {
            // High Readiness - Push for a workout if none logged
            if (recentWorkouts === 0) {
                suggestions.push({
                    type: 'workout',
                    title: 'Prime Time for Training',
                    message: `Your readiness is high (${Math.round(readiness)}/100). Take advantage of this energy and hit your workout today!`,
                    priority: 'high',
                    action: 'schedule_workout',
                });
            } else {
                suggestions.push({
                    type: 'workout',
                    title: 'Great Work Today',
                    message: 'You have already logged your training today. Rest and refuel.',
                    priority: 'low',
                    action: 'schedule_workout',
                });
            }
        }

        // 2. Evaluate Nutrition & Shift Pattern
        if (recentMeals < 2) {
            if (shiftType === 'fixed_night') {
                suggestions.push({
                    type: 'nutrition',
                    title: 'Night Shift Fueling',
                    message: 'You are on a night shift and have missed meals. Eat a high-protein meal before 2am to maintain alertness.',
                    priority: 'high',
                    action: 'log_meal',
                });
            } else {
                suggestions.push({
                    type: 'nutrition',
                    title: 'Missed Macros',
                    message: 'You are falling behind on your daily nutrition. Log a meal to check your exact macro deficit.',
                    priority: 'medium',
                    action: 'log_meal',
                });
            }
        }

        // Sort by priority so high comes first
        const priorityScore = { high: 3, medium: 2, low: 1 };
        suggestions.sort((a, b) => priorityScore[b.priority] - priorityScore[a.priority]);

        return suggestions;
    }

    /**
     * Get workout suggestions
     */
    static async getWorkoutSuggestions(user) {
        const suggestions = [];
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        // Get last 7 days workout data
        const weekAgo = new Date();
        weekAgo.setDate(weekAgo.getDate() - 7);

        const weeklyWorkouts = await WorkoutLog.find({
            userId: user._id,
            date: { $gte: weekAgo, $lte: today },
            completed: true,
        });

        // Frequency suggestions
        if (weeklyWorkouts.length < 3) {
            suggestions.push({
                type: 'frequency',
                title: 'Increase frequency',
                message: 'Aim for 3-5 workouts per week for optimal results.',
                priority: 'medium',
            });
        }

        // Variety suggestions
        const categories = new Set(weeklyWorkouts.map(w => w.workoutId?.category).filter(Boolean));
        if (categories.size < 2 && weeklyWorkouts.length >= 3) {
            suggestions.push({
                type: 'variety',
                title: 'Add variety',
                message: 'Try different workout types (strength, cardio, flexibility) for balanced fitness.',
                priority: 'low',
            });
        }

        // Recovery suggestions
        const recentIntenseWorkouts = weeklyWorkouts.filter(w => w.intensity === 'high').length;
        if (recentIntenseWorkouts >= 3) {
            suggestions.push({
                type: 'recovery',
                title: 'Recovery focus',
                message: 'Consider a lighter workout or active recovery day after intense sessions.',
                priority: 'high',
            });
        }

        return suggestions;
    }

    /**
     * Get nutrition suggestions
     */
    static async getNutritionSuggestions(user) {
        const suggestions = [];
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        // Get today's nutrition
        const nutrition = await DailyNutritionSummary.findOne({
            userId: user._id,
            date: today,
        });

        const targets = await NutritionTarget.findOne({ userId: user._id });

        if (nutrition && targets) {
            // Calorie suggestions
            const calorieProgress = (nutrition.calories / targets.calorieTarget) * 100;

            if (calorieProgress < 50) {
                suggestions.push({
                    type: 'calories',
                    title: 'Increase calorie intake',
                    message: `You're at ${Math.round(calorieProgress)}% of your daily goal. Try spacing meals evenly.`,
                    priority: 'medium',
                });
            } else if (calorieProgress > 120) {
                suggestions.push({
                    type: 'calories',
                    title: 'Monitor intake',
                    message: `You've exceeded your goal by ${Math.round(calorieProgress - 100)}%. Consider portion control.`,
                    priority: 'low',
                });
            }

            // Protein suggestions
            const proteinProgress = (nutrition.protein / targets.proteinTarget) * 100;

            if (proteinProgress < 70) {
                suggestions.push({
                    type: 'protein',
                    title: 'Boost protein',
                    message: 'Adequate protein supports muscle repair and satiety.',
                    priority: user.goalType === 'strength_building' ? 'high' : 'medium',
                });
            }
        }

        // Meal timing suggestions based on shift
        if (user.shiftType === 'fixed_night') {
            suggestions.push({
                type: 'timing',
                title: 'Night shift nutrition',
                message: 'Have a light meal before shift and stay hydrated during work.',
                priority: 'medium',
            });
        }

        return suggestions;
    }

    /**
     * Get sleep suggestions
     */
    static async getSleepSuggestions(user) {
        const suggestions = [];
        const weekAgo = new Date();
        weekAgo.setDate(weekAgo.getDate() - 7);

        // Get sleep data from last week
        const sleepLogs = await SleepLog.find({
            userId: user._id,
            date: { $gte: weekAgo },
        });

        if (sleepLogs.length > 0) {
            // Calculate average sleep duration
            const totalDuration = sleepLogs.reduce((sum, log) => sum + log.durationMinutes, 0);
            const avgDurationHours = totalDuration / sleepLogs.length / 60;

            if (avgDurationHours < 6) {
                suggestions.push({
                    type: 'duration',
                    title: 'Increase sleep duration',
                    message: `Average ${avgDurationHours.toFixed(1)} hours. Aim for 7-9 hours for optimal recovery.`,
                    priority: 'high',
                });
            }

            // Quality suggestions
            const poorQualityLogs = sleepLogs.filter(log => log.quality === 'poor').length;
            const poorQualityPercentage = (poorQualityLogs / sleepLogs.length) * 100;

            if (poorQualityPercentage > 30) {
                suggestions.push({
                    type: 'quality',
                    title: 'Improve sleep quality',
                    message:
                        'Try relaxation techniques before bed and maintain a cool, dark sleep environment.',
                    priority: 'medium',
                });
            }
        }

        // Shift-specific sleep suggestions
        if (user.shiftType === 'fixed_night') {
            suggestions.push({
                type: 'shift_sleep',
                title: 'Daytime sleep tips',
                message: 'Use blackout curtains and white noise for better daytime sleep quality.',
                priority: 'medium',
            });
        } else if (user.shiftType === 'early_morning') {
            suggestions.push({
                type: 'shift_sleep',
                title: 'Early riser advice',
                message: 'Morning sunlight exposure helps regulate your circadian rhythm.',
                priority: 'low',
            });
        }

        return suggestions;
    }

    /**
     * Get general suggestions
     */
    static async getGeneralSuggestions(user) {
        return [
            {
                type: 'general',
                title: 'Stay consistent',
                message: 'Small daily habits lead to big long-term results.',
                priority: 'low',
            },
            {
                type: 'general',
                title: 'Listen to your body',
                message: 'Adjust intensity based on how you feel. Rest when needed.',
                priority: 'low',
            },
        ];
    }

    /**
     * Get premium suggestions
     */
    static async getPremiumSuggestions(user) {
        return [
            {
                type: 'premium',
                title: 'Advanced insights',
                message: 'Unlock detailed analytics and personalized recommendations.',
                priority: 'low',
                isPremium: true,
            },
        ];
    }

    /**
     * Get fallback suggestions
     */
    static getFallbackSuggestions() {
        return [
            {
                type: 'fallback',
                title: 'Welcome to Bootble!',
                message: 'Start by logging your first workout or meal.',
                priority: 'low',
            },
        ];
    }

    /**
     * Generate workout plan (Premium feature)
     */
    static async generateWorkoutPlan(userId, goal, duration = 'week') {
        const user = await User.findById(userId);
        if (!user) {
            throw new Error('User not found');
        }

        // Get live context and scores
        const engineContext = await WellnessEngine.buildContext(userId);
        const scores = engineContext.scores || { workout_readiness: 70 };

        const weeksToGenerate = duration === 'month' ? 4 : 1;
        const schedule = [];
        let programTitle = '';
        let programDesc = '';

        for (let week = 1; week <= weeksToGenerate; week++) {
            const plan = await generateWeeklyPlan(user, scores, week);
            programTitle = plan.phase; // Use last phase as title base
            
            plan.days.forEach(d => {
                schedule.push({
                    day: weeksToGenerate > 1 ? `Week ${week} ${d.day}` : d.day,
                    workout: d.workout,
                    duration: d.duration_min,
                    intensity: d.intensity,
                    notes: d.notes,
                    exercises: d.exercises
                });
            });
        }

        programDesc = `Adaptive program based on your current readiness score of ${scores.workout_readiness}/100`;

        return {
            title: duration === 'month' ? `Monthly Adaptive Program` : `Weekly Adaptive Program`,
            description: programDesc,
            schedule: schedule
        };
    }
    /**
     * Get nutrition advice (Premium feature)
     */
    static async getNutritionAdvice(userId) {
        const user = await User.findById(userId);
        if (!user) {
            throw new Error('User not found');
        }

        const targets = await NutritionTarget.findOne({ userId }) || {
            calorieTarget: 2000,
            proteinTarget: 150,
            carbTarget: 200,
            fatTarget: 67,
        };

        const today = new Date();
        today.setHours(0, 0, 0, 0);
        
        const summary = await DailyNutritionSummary.findOne({ userId, date: today }) || {
            calories: 0,
            protein: 0,
            carbs: 0,
            fat: 0
        };

        const remainingProtein = targets.proteinTarget - summary.protein;
        const recommendations = [];
        let suggestedFoods = [];

        // Dynamic Recommendations based on deficit
        if (remainingProtein > 20) {
            recommendations.push(`You are ${remainingProtein}g short on protein today. Try a high-protein snack!`);
            // Fetch top 3 high protein foods
            suggestedFoods = await Food.find({ protein: { $gte: 15 } })
                                       .sort({ protein: -1 })
                                       .limit(3)
                                       .lean();
        } else {
            recommendations.push('Great job hitting your protein target!');
        }

        if (summary.calories < targets.calorieTarget * 0.5) {
            recommendations.push('You are less than halfway to your calorie goal. Space out your meals to maintain energy.');
        }

        recommendations.push('Stay hydrated throughout the day');
        recommendations.push('Include colorful vegetables in your next meal');

        // Shift specific timing
        let shiftSpecific = 'Maintain consistent meal times to support circadian rhythm.';
        let mealTiming = { breakfast: '08:00-09:30', lunch: '13:00-14:30', dinner: '19:00-20:30' };

        if (user.shiftType === 'fixed_night') {
            shiftSpecific = 'Eat your largest, protein-rich meal before your shift (20:00). Avoid heavy carbs after 02:00 to prevent sleepiness, and fast before daytime sleep.';
            mealTiming = { breakfast: '16:00-17:00 (Wake)', lunch: '20:00-21:30 (Pre-shift)', dinner: '02:00-03:00 (Mid-shift)' };
        } else if (user.shiftType === 'rotating') {
            shiftSpecific = 'Adapt your meal timings gradually as your shift transitions. Prioritize protein to maintain alertness.';
        } else if (user.shiftType === 'early_morning') {
            shiftSpecific = 'Have a light, carb-focused snack before your early shift for quick energy, and a solid protein breakfast post-shift.';
            mealTiming = { breakfast: '04:30-05:00 (Pre-shift)', lunch: '12:00-13:30', dinner: '18:00-19:30' };
        }

        return {
            title: 'Live Nutrition Guidance',
            dailyTargets: targets,
            consumed: {
                calories: summary.calories,
                protein: summary.protein,
                carbs: summary.carbs,
                fat: summary.fat
            },
            recommendations,
            shiftSpecific,
            mealTiming,
            suggestedFoods: suggestedFoods.map(f => ({
                id: f._id,
                name: f.name,
                protein: f.protein,
                calories: f.calories
            }))
        };
    }

    /**
     * Get sleep tips
     */
    static async getSleepTips(userId) {
        const engineContext = await WellnessEngine.buildContext(userId);
        const user = engineContext.user;
        if (!user) {
            throw new Error('User not found');
        }

        const universal = [
            'Maintain consistent sleep and wake times',
            'Create a relaxing bedtime routine',
            'Keep your bedroom cool, dark, and quiet',
            'Limit screen time 1 hour before bed',
            'Avoid caffeine and heavy meals close to sleep',
        ];

        let shiftSpecific = [];
        let behavioral = [];
        let actions = ['log_sleep']; // Default action
        let recommendedWindows = [];

        // Evaluate actual sleep logs
        const recentSleepLog = engineContext.sleepLogs?.[0];
        let hoursSlept = 0;
        if (recentSleepLog && recentSleepLog.duration) {
            hoursSlept = recentSleepLog.duration / 60; // Assuming duration is in minutes
        }

        // Generate shift-specific & behavioral tips
        if (user.shiftType === 'fixed_night') {
            shiftSpecific.push('Use blackout curtains and white noise for daytime sleep');
            shiftSpecific.push('Consider melatonin under medical guidance for shift adjustment');
            recommendedWindows = [
                { type: 'primary', label: 'Daytime Sleep', start: '08:00', end: '15:00', duration: '7h' },
                { type: 'nap', label: 'Pre-shift Nap', start: '20:00', end: '21:30', duration: '1.5h' }
            ];

            if (recentSleepLog && hoursSlept < 6) {
                behavioral.push({
                    title: 'Severe Sleep Deficit Detected',
                    message: `You only slept ${hoursSlept.toFixed(1)} hours today. We strongly recommend a 90-minute pre-shift nap tonight to maintain cognitive function.`,
                    priority: 'high'
                });
                actions.push('schedule_wind_down');
            } else if (!recentSleepLog) {
                behavioral.push({
                    title: 'Missing Daytime Sleep',
                    message: 'No daytime sleep logged. Make sure you are prioritizing your primary rest phase.',
                    priority: 'medium'
                });
            }
        } else if (user.shiftType === 'rotating') {
            shiftSpecific.push('Gradually shift your sleep schedule 1-2 hours per day before a rotation');
            shiftSpecific.push('Use bright light therapy to anchor your circadian rhythm');
            recommendedWindows = [
                { type: 'primary', label: 'Adaptive Sleep', start: '22:00', end: '06:00', duration: '8h' }
            ];

            if (recentSleepLog && hoursSlept < 6) {
                behavioral.push({
                    title: 'Rotation Fatigue Risk',
                    message: `Short sleep logged (${hoursSlept.toFixed(1)} hours). Avoid heavy training today and prioritize recovery.`,
                    priority: 'high'
                });
            }
        } else {
            recommendedWindows = [
                { type: 'primary', label: 'Standard Sleep', start: '22:30', end: '06:30', duration: '8h' }
            ];
            if (recentSleepLog && hoursSlept < 7) {
                behavioral.push({
                    title: 'Suboptimal Rest',
                    message: `You logged ${hoursSlept.toFixed(1)} hours of sleep. Aim for at least 7-8 hours tonight.`,
                    priority: 'medium'
                });
                actions.push('schedule_wind_down');
            } else if (!recentSleepLog) {
                behavioral.push({
                    title: 'Log Your Rest',
                    message: 'Tracking your sleep is the first step to optimizing your recovery.',
                    priority: 'low'
                });
            }
        }

        return {
            title: 'Sleep Coaching',
            categories: {
                behavioral,
                shiftSpecific,
                universal
            },
            actions,
            recommendedWindows,
            shiftContext: user.shiftType || 'standard',
        };
    }

    /**
     * Analyze progress (Premium feature)
     */
    static async analyzeProgress(userId, period = 'week') {
        const user = await User.findById(userId);
        if (!user) {
            throw new Error('User not found');
        }

        // Check premium access
        const hasPremium = await SubscriptionService.hasPremiumAccess(userId);
        if (!hasPremium) {
            throw new Error('Premium subscription required for progress analysis');
        }

        // This would involve complex analysis in production
        // For now, return template insights

        return {
            period,
            summary: 'Good consistency in workouts, could improve sleep quality',
            strengths: ['Workout frequency', 'Nutrition tracking consistency'],
            areasForImprovement: ['Sleep duration', 'Post-workout recovery'],
            nextSteps: ['Aim for 7+ hours of sleep nightly', 'Add 1-2 active recovery sessions per week'],
        };
    }

    /**
     * Chat with AI (Premium feature)
     */
    static async chatWithAI(userId, message, context = {}) {
        const user = await User.findById(userId);
        if (!user) {
            throw new Error('User not found');
        }

        // Check premium access
        const hasPremium = await SubscriptionService.hasPremiumAccess(userId);
        if (!hasPremium) {
            throw new Error('Premium subscription required for AI chat');
        }

        // Check if OpenAI is configured. If not, trigger our premium dynamic local intent handler!
        if (!process.env.OPENAI_API_KEY) {
            // 1. Contextual Memory: Fetch last 5 messages
            const chatHistory = await AIChat.find({ userId: user._id })
                .sort({ createdAt: -1 })
                .limit(5);
            chatHistory.reverse();

            // 2. Deep Context Integration
            const engineContext = await WellnessEngine.buildContext(user._id);
            const readiness = engineContext.readinessScore;
            const shift = user.shiftType || 'standard';
            const recentSleep = engineContext.sleepLogs?.[0];
            const recentWorkout = engineContext.workoutLogs?.[0];
            
            const lowerMsg = message.toLowerCase();
            let response = "";
            let suggestions = [];

            // 3. Robust Intent Parsing
            const isWeather = lowerMsg.match(/weather|forecast|rain|hot|cold|sun/);
            const isNutrition = lowerMsg.match(/eat|food|meal|protein|cook|diet|calories|dinner|lunch|breakfast|recipe|macro/);
            const isSleep = lowerMsg.match(/sleep|tired|fatigue|rest|insomnia|wake|nap/);
            const isWorkout = lowerMsg.match(/workout|exercise|gym|cardio|strength|routine|run|lift|train/);

            if (isWeather) {
                // Intelligent Pivoting (Out-of-Scope)
                response = `Hi ${user.name}! I don't track live weather conditions, but I can see your current Readiness Score is ${readiness.overall}/100. Whether it rains or shines, with a readiness score like that, I highly recommend an indoor active recovery or stretching session today. Should I schedule that for you?`;
                suggestions = ["Schedule indoor recovery", "Give me a home workout", "Check my macros instead"];
            } else if (isNutrition) {
                let shiftAdvice = "maintain consistent eating intervals.";
                if (shift === 'fixed_night') {
                    shiftAdvice = "prioritize high-protein meals before your night shift and avoid heavy carbs.";
                } else if (shift === 'rotating') {
                    shiftAdvice = "adapt your meal timings gradually as your rotations shift.";
                }
                
                response = `Based on your ${shift} schedule, you should ${shiftAdvice}`;
                
                if (engineContext.dailyNutrition && engineContext.nutritionTarget) {
                    const tracked = engineContext.dailyNutrition.calories;
                    const target = engineContext.nutritionTarget.calorieTarget;
                    const progress = Math.round((tracked / target) * 100);
                    response += ` Today, you have tracked ${tracked} / ${target} calories (${progress}%).`;
                } else {
                    response += " You haven't logged your full macros today. I recommend logging your meals now.";
                }
                suggestions = ["Log a meal", "Suggest high protein food", "Macro breakdown"];
            } else if (isSleep) {
                response = `Adjusting sleep is crucial for your ${shift} rotation, ${user.name}. `;
                if (recentSleep) {
                    const hours = (recentSleep.durationMinutes / 60).toFixed(1);
                    response += `Your last logged sleep was ${hours} hours. `;
                    if (hours < 6) {
                        response += "Since you're sleep-deprived, avoid high-intensity workouts today.";
                    }
                } else {
                    response += "I don't see any recent sleep logs. Make sure to track it so I can accurately assess your recovery!";
                }
                suggestions = ["Tips for night shift sleep", "Schedule a wind-down", "Log sleep session"];
            } else if (isWorkout) {
                if (readiness.overall < 50) {
                    response = `Your Readiness Score is currently ${readiness.overall}/100, which indicates high fatigue. I strongly recommend skipping heavy lifting today and opting for a mobility routine or complete rest.`;
                    suggestions = ["Suggest a mobility routine", "Log a rest day"];
                } else {
                    response = `You are primed for training! Your Readiness Score is a solid ${readiness.overall}/100. `;
                    if (recentWorkout && recentWorkout.completed) {
                        response += "I see you've already completed a session today. Great consistency!";
                    } else {
                        response += `Since you are on a ${shift} pattern, try scheduling your workout when your energy naturally peaks.`;
                    }
                    suggestions = ["Generate today's workout", "View my weekly plan"];
                }
            } else {
                // Check if they are responding to a previous prompt
                if (chatHistory.length > 0 && chatHistory[chatHistory.length - 1].role === 'assistant') {
                    response = `I hear you, ${user.name}. As your fitness coach, I want to keep us focused on your progress. Let's look at your current state: your Readiness is ${readiness.overall}/100. How can I support your training or recovery right now?`;
                } else {
                    response = `Hello ${user.name}! I'm Bootsy, your Bootble fitness and recovery coach. While I specialize in optimizing performance for shift workers, I'd love to help you with:
- Scheduling workouts around your ${shift} schedule
- Optimizing your recovery (Readiness: ${readiness.overall}/100)
- Nutrition adjustments

What can we focus on today?`;
                }
                suggestions = ["Schedule workouts", "Analyze my macros", "Sleep tips"];
            }

            // Save user message
            await AIChat.create({
                userId: user._id,
                role: 'user',
                message: message.trim(),
            });

            // Save assistant response
            await AIChat.create({
                userId: user._id,
                role: 'assistant',
                message: response,
            });

            return {
                response,
                suggestions
            };
        }

        try {
            // Get today's date
            const today = new Date();
            today.setHours(0, 0, 0, 0);

            // Load user data in parallel
            const [nutritionSummary, nutritionTarget, sleepLog, workoutLogs] = await Promise.all([
                DailyNutritionSummary.findOne({ userId: user._id, date: today }),
                NutritionTarget.findOne({ userId: user._id }),
                SleepLog.findOne({ userId: user._id, date: today }).sort({ createdAt: -1 }),
                WorkoutLog.find({ userId: user._id, date: today }),
            ]);

            // Calculate scores
            let sleepScore = 0;
            let recoveryScore = 50;
            let readinessScore = 50;

            if (sleepLog) {
                const durationHours = sleepLog.durationMinutes / 60;
                sleepScore = calculateSleepScore(durationHours, sleepLog.quality || 'average');
            }

            // Calculate recovery score
            const workoutsToday = workoutLogs.filter(w => w.completed).length;
            const highIntensityWorkouts = workoutLogs.filter(
                w => w.completed && w.intensity === 'high',
            ).length;
            const workoutIntensity =
                highIntensityWorkouts > 0
                    ? 'high'
                    : workoutLogs.some(w => w.completed && w.intensity === 'medium')
                      ? 'medium'
                      : 'low';

            recoveryScore = calculateRecoveryScore({
                sleepScore,
                workoutsToday,
                workoutIntensity,
                recoveryActivities: 0,
                consecutiveWorkoutDays: 0,
                stressLevel: 'medium',
            });

            // Calculate nutrition adherence
            let nutritionAdherence = 50;
            if (nutritionSummary && nutritionTarget) {
                const calorieAdherence = Math.min(
                    100,
                    (nutritionSummary.calories / nutritionTarget.calorieTarget) * 100,
                );
                const proteinAdherence = Math.min(
                    100,
                    (nutritionSummary.protein / nutritionTarget.proteinTarget) * 100,
                );
                nutritionAdherence = (calorieAdherence + proteinAdherence) / 2;
            }

            // Calculate readiness score
            readinessScore = calculateReadinessScore({
                recoveryScore,
                nutritionAdherence,
                sleepConsistency: sleepScore,
                hrvScore: 0,
            });

            // Build dynamic system prompt with all user data
            const systemPrompt = this.buildSystemPrompt({
                user,
                nutritionSummary,
                nutritionTarget,
                sleepLog,
                workoutLogs,
                sleepScore,
                recoveryScore,
                readinessScore,
            });

            // Get recent chat history for context (last 10 messages)
            const recentChats = await AIChat.find({ userId: user._id })
                .sort({ createdAt: -1 })
                .limit(10)
                .lean();

            // Build messages array for OpenAI (reverse to chronological order)
            const messages = [{ role: 'system', content: systemPrompt }];

            // Add recent chat history
            recentChats.reverse().forEach(chat => {
                messages.push({
                    role: chat.role,
                    content: chat.message,
                });
            });

            // Add current user message
            messages.push({
                role: 'user',
                content: message,
            });

            // Call OpenAI API
            const completion = await openai.chat.completions.create({
                model: 'gpt-3.5-turbo',
                messages: messages,
                temperature: 0.7,
                max_tokens: 500,
            });

            const aiResponse = completion.choices[0].message.content;

            // Save user message
            await AIChat.create({
                userId: user._id,
                role: 'user',
                message: message.trim(),
            });

            // Save assistant response
            await AIChat.create({
                userId: user._id,
                role: 'assistant',
                message: aiResponse,
            });

            return {
                response: aiResponse,
                metadata: {
                    sleepScore,
                    recoveryScore,
                    readinessScore,
                },
            };
        } catch (error) {
            logger.error(`AI Chat error: ${error.message}`);
            throw new Error(`Failed to chat with AI: ${error.message}`);
        }
    }

    /**
     * Check if message is fitness/health related
     */
    static isFitnessRelated(message) {
        const fitnessKeywords = [
            'workout',
            'exercise',
            'fitness',
            'training',
            'gym',
            'cardio',
            'strength',
            'muscle',
            'weight',
            'calories',
            'nutrition',
            'diet',
            'meal',
            'food',
            'eat',
            'protein',
            'carbs',
            'fat',
            'macros',
            'sleep',
            'rest',
            'recovery',
            'energy',
            'health',
            'wellness',
            'body',
            'run',
            'walk',
            'lift',
            'squat',
            'press',
            'pull',
            'push',
            'stretch',
            'yoga',
            'pilates',
            'hiit',
            'cardio',
            'hydration',
            'water',
            'supplements',
            'vitamins',
            'stress',
            'fatigue',
            'tired',
            'sore',
            'pain',
            'injury',
            'form',
            'technique',
            'reps',
            'sets',
            'routine',
            'plan',
            'goal',
            'progress',
            'track',
            'log',
            'performance',
            'endurance',
            'flexibility',
            'mobility',
            'core',
            'abs',
            'legs',
            'arms',
            'chest',
            'back',
            'shoulders',
            'shift',
            'schedule',
            'shift work',
            'night shift',
            'rotating shift',
        ];

        const lowerMessage = message.toLowerCase();
        return fitnessKeywords.some(keyword => lowerMessage.includes(keyword));
    }

    /**
     * Build comprehensive system prompt with user data
     */
    static buildSystemPrompt(data) {
        const {
            user,
            nutritionSummary,
            nutritionTarget,
            sleepLog,
            workoutLogs,
            sleepScore,
            recoveryScore,
            readinessScore,
        } = data;

        let prompt = `You are an expert AI Fitness Coach specializing in personalized health and fitness guidance for shift workers.

USER PROFILE:
- Name: ${user.name}
- Age: ${user.age || 'Not specified'}
- Gender: ${user.gender || 'Not specified'}
- Height: ${user.height ? `${user.height} cm` : 'Not specified'}
- Weight: ${user.weight ? `${user.weight} kg` : 'Not specified'}
- Shift Type: ${user.shiftType || 'Not specified'}
- Fitness Goal: ${user.goalType || 'Not specified'}

TODAY'S DATA (${new Date().toLocaleDateString()}):

SCORES:
- Sleep Score: ${sleepScore}/100 ${sleepScore < 50 ? '(Poor)' : sleepScore < 70 ? '(Fair)' : '(Good)'}
- Recovery Score: ${recoveryScore}/100 ${recoveryScore < 50 ? '(Poor)' : recoveryScore < 70 ? '(Fair)' : '(Good)'}
- Readiness Score: ${readinessScore}/100 ${readinessScore < 50 ? '(Not Ready)' : readinessScore < 70 ? '(Moderate)' : '(Ready)'}

NUTRITION:`;

        if (nutritionSummary && nutritionTarget) {
            prompt += `
- Calories: ${nutritionSummary.calories}/${nutritionTarget.calorieTarget} cal (${Math.round((nutritionSummary.calories / nutritionTarget.calorieTarget) * 100)}%)
- Protein: ${nutritionSummary.protein}g/${nutritionTarget.proteinTarget}g (${Math.round((nutritionSummary.protein / nutritionTarget.proteinTarget) * 100)}%)
- Carbs: ${nutritionSummary.carbs}g/${nutritionTarget.carbTarget}g (${Math.round((nutritionSummary.carbs / nutritionTarget.carbTarget) * 100)}%)
- Fat: ${nutritionSummary.fat}g/${nutritionTarget.fatTarget}g (${Math.round((nutritionSummary.fat / nutritionTarget.fatTarget) * 100)}%)
- Meals logged: ${nutritionSummary.mealCount}`;
        } else {
            prompt += `
- No nutrition data logged today`;
        }

        prompt += `

SLEEP:`;
        if (sleepLog) {
            prompt += `
- Duration: ${sleepLog.durationMinutes} minutes (${(sleepLog.durationMinutes / 60).toFixed(1)} hours)
- Quality: ${sleepLog.quality}
- Activity: ${sleepLog.activityKey}`;
            if (sleepLog.energyBefore) prompt += `\n- Energy before: ${sleepLog.energyBefore}/10`;
            if (sleepLog.energyAfter) prompt += `\n- Energy after: ${sleepLog.energyAfter}/10`;
        } else {
            prompt += `
- No sleep logged today`;
        }

        prompt += `

WORKOUTS:`;
        if (workoutLogs && workoutLogs.length > 0) {
            const completedWorkouts = workoutLogs.filter(w => w.completed);
            prompt += `
- Total workouts: ${workoutLogs.length}
- Completed: ${completedWorkouts.length}`;

            completedWorkouts.forEach((workout, index) => {
                prompt += `
  ${index + 1}. Duration: ${workout.durationMinutes || 'N/A'} min, Intensity: ${workout.intensity || 'N/A'}`;
                if (workout.perceivedExertion) prompt += `, RPE: ${workout.perceivedExertion}/10`;
            });
        } else {
            prompt += `
- No workouts logged today`;
        }

        prompt += `

YOUR ROLE:
- Provide personalized, evidence-based fitness and health advice
- Consider the user's shift work schedule and its impact on fitness
- Be encouraging, motivating, and supportive
- Keep responses concise, actionable, and practical
- Use the data above to give contextual recommendations
- Focus on sustainable habits and realistic goals
- Address sleep optimization, nutrition timing, and workout scheduling specific to shift work
- Only discuss fitness, health, nutrition, sleep, recovery, and wellness topics

IMPORTANT: If asked about topics unrelated to fitness, health, nutrition, sleep, recovery, or wellness, politely redirect the conversation back to fitness and health topics.`;

        return prompt;
    }

    /**
     * Get chat history
     */
    static async getChatHistory(userId, limit = 20) {
        try {
            const user = await User.findById(userId);
            if (!user) {
                throw new Error('User not found');
            }

            const chatHistory = await AIChat.find({ userId: user._id })
                .sort({ createdAt: -1 })
                .limit(limit)
                .lean();

            // Reverse to get chronological order
            return chatHistory.reverse();
        } catch (error) {
            logger.error(`Get chat history error: ${error.message}`);
            throw new Error(`Failed to get chat history: ${error.message}`);
        }
    }
}

module.exports = AIService;
