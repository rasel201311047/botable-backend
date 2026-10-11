const NutritionService = require('./nutrition.service');
const NutritionAIService = require('./nutritionAI.service');
const WellnessEngine = require('../modules/engine/wellnessEngine.service');

const AI_MEAL_TYPES = ['breakfast', 'lunch', 'dinner', 'snack', 'pre_workout', 'post_workout'];

/**
 * Global XSS middleware HTML-escapes every body string (e.g. ' -> &#x27;, & -> &amp;).
 * Decode it again so the AI reads, and we store, exactly what the user typed.
 */
const cleanUserText = (value, maxLength) =>
  String(value ?? '')
    .replace(/&#x27;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&')
    .replace(/[\u0000-\u001F\u007F]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, maxLength);

class NutritionController {
  /**
   * @desc    Search foods
   * @route   GET /api/nutrition/foods/search
   * @access  Private
   */
  static async searchFoods(req, res, next) {
    try {
      const { q: query, page = 1, limit = 20 } = req.query;

      if (!query) {
        return res.status(400).json({
          status: 'error',
          message: 'Search query is required',
        });
      }

      const results = await NutritionService.searchFoods(query, parseInt(page), parseInt(limit));

      res.status(200).json({
        status: 'success',
        data: results,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * @desc    Get USDA food details by FDC ID
   * @route   GET /api/nutrition/foods/usda/:fdcId
   * @access  Private
   */
  static async getUSDAFoodDetails(req, res, next) {
    try {
      const { fdcId } = req.params;

      if (!fdcId || isNaN(fdcId)) {
        return res.status(400).json({
          status: 'error',
          message: 'Valid FDC ID is required',
        });
      }

      const food = await NutritionService.getUSDAFoodDetails(fdcId);

      res.status(200).json({
        status: 'success',
        data: food,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * @desc    Get food details
   * @route   GET /api/nutrition/foods/:id
   * @access  Private
   */
  static async getFoodDetails(req, res, next) {
    try {
      const { id } = req.params;

      const food = await NutritionService.getFoodDetails(id);

      res.status(200).json({
        status: 'success',
        data: food,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * @desc    Add a meal
   * @route   POST /api/nutrition/meals
   * @access  Private
   */
  static async addMeal(req, res, next) {
    try {
      const {
        foodId,
        quantity,
        mealType,
        title,
        scheduledTime,
        notes,
        items,
        shiftContext,
        source,
        loggedAt,
        mealSessionId,
      } = req.body;

      if (!foodId && (!Array.isArray(items) || items.length === 0)) {
        return res.status(400).json({
          status: 'error',
          message: 'Food ID or meal items are required',
        });
      }

      if (quantity !== undefined && quantity <= 0) {
        return res.status(400).json({
          status: 'error',
          message: 'Quantity must be greater than 0',
        });
      }

      const meal = await NutritionService.addMeal(req.user.id, {
        foodId,
        quantity: quantity !== undefined ? parseFloat(quantity) : undefined,
        mealType,
        title,
        scheduledTime,
        notes,
        items,
        shiftContext,
        source,
        loggedAt,
        mealSessionId,
      });

      try {
        const mealDate = new Date(meal.date || new Date());
        mealDate.setHours(0, 0, 0, 0);
        const nextDay = new Date(mealDate);
        nextDay.setDate(nextDay.getDate() + 1);

        const Meal = require('./meal.model');
        const sessionMeals = await Meal.find({
          userId: req.user.id,
          mealType: meal.mealType,
          date: { $gte: mealDate, $lt: nextDay }
        });

        const sessionTotals = sessionMeals.reduce((acc, m) => {
          acc.calories += (m.calories || 0);
          acc.protein += (m.protein || 0);
          acc.carbs += (m.carbs || 0);
          acc.fat += (m.fat || 0);
          acc.items += (m.items && m.items.length > 0 ? m.items.length : 1);
          return acc;
        }, { calories: 0, protein: 0, carbs: 0, fat: 0, items: 0 });

        const dateKey = mealDate.toISOString().slice(0, 10);
        const dedupeKey = `meal:${meal.mealType}:${dateKey}`;
        const titleCaseType = meal.mealType.charAt(0).toUpperCase() + meal.mealType.slice(1);

        await WellnessEngine.recordEvent({
          userId: req.user.id,
          type: 'MEAL',
          category: 'meal',
          title: `${titleCaseType} Logged`,
          message: `Your ${meal.mealType} now contains ${sessionTotals.items} items. Totals: ${Math.round(sessionTotals.calories)} kcal (P: ${Math.round(sessionTotals.protein)}g, C: ${Math.round(sessionTotals.carbs)}g, F: ${Math.round(sessionTotals.fat)}g).`,
          sourceModule: 'nutrition',
          sourceId: meal._id.toString(),
          deepLink: '/home',
          priority: 'MEDIUM',
          dedupeKey: dedupeKey,
          payload: {
            mealType: meal.mealType,
            mealSessionId: meal.mealSessionId,
            calories: sessionTotals.calories,
            protein: sessionTotals.protein,
            carbs: sessionTotals.carbs,
            fat: sessionTotals.fat,
            items: sessionTotals.items
          },
        });
      } catch (notificationError) {
        // Log error but don't fail the meal logging
        console.error('Failed to send meal notification:', notificationError.message);
      }

      res.status(201).json({
        status: 'success',
        message: 'Meal added successfully',
        data: { meal },
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * @desc    Describe a meal in plain text; AI extracts the nutrition and logs it
   *          (meal log + calendar timeline + daily totals)
   * @route   POST /api/nutrition/meals/ai-log
   * @access  Private
   */
  static async logMealWithAI(req, res, next) {
    // If the client cancels / disconnects, stop the OpenAI call and do NOT save the meal
    const abortController = new AbortController();
    res.on('close', () => {
      if (!res.writableFinished) abortController.abort();
    });

    try {
      const description = cleanUserText(req.body.description, 500);
      const notes = cleanUserText(req.body.notes, 300);

      if (description.length < 3) {
        return res.status(400).json({
          status: 'error',
          message: 'Please describe what you ate (at least 3 characters).',
        });
      }

      const mealType = AI_MEAL_TYPES.includes(req.body.mealType) ? req.body.mealType : 'snack';

      // Time of the meal (HH:MM, 24h). Defaults to "now".
      let scheduledTime = req.body.scheduledTime;
      if (scheduledTime === undefined || scheduledTime === null || scheduledTime === '') {
        const now = new Date();
        scheduledTime = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
      }
      const timeMatch = /^([01]?\d|2[0-3]):([0-5]\d)$/.exec(String(scheduledTime).trim());
      if (!timeMatch) {
        return res.status(400).json({
          status: 'error',
          message: 'Invalid time. Use HH:MM (24-hour format).',
        });
      }
      const hours = Number(timeMatch[1]);
      const minutes = Number(timeMatch[2]);
      scheduledTime = `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;

      // Day of the meal. Parsed exactly like the calendar endpoint so the meal lands on the same day.
      const day = req.body.date ? new Date(req.body.date) : new Date();
      if (Number.isNaN(day.getTime())) {
        return res.status(400).json({
          status: 'error',
          message: 'Invalid date.',
        });
      }
      day.setHours(0, 0, 0, 0);
      const loggedAt = new Date(day);
      loggedAt.setHours(hours, minutes, 0, 0);

      // 1) Ask OpenAI to extract the nutrition
      const analysis = await NutritionAIService.analyzeMeal({
        description,
        mealType,
        signal: abortController.signal,
      });

      if (abortController.signal.aborted) return;

      // 2) Save it as a normal meal so it shows up everywhere (home totals, meal list, calendar)
      const meal = await NutritionService.addMeal(req.user.id, {
        mealType,
        title: analysis.title,
        scheduledTime,
        notes: notes || undefined,
        source: 'ai',
        loggedAt,
        items: analysis.items.map(item => ({
          name: item.name,
          portion: item.portion,
          quantity: item.grams,
          servingSize: item.grams,
          calories: item.calories,
          protein: item.protein,
          carbs: item.carbs,
          fat: item.fat,
          fiber: item.fiber,
          sugar: item.sugar,
          sodium: item.sodium,
          source: 'ai',
        })),
        aiMeta: {
          originalText: description,
          confidence: analysis.confidence,
          assumptions: analysis.assumptions,
          model: analysis.model,
        },
      });

      return res.status(201).json({
        status: 'success',
        message: 'Meal analyzed and logged',
        data: {
          meal,
          analysis: {
            title: analysis.title,
            items: analysis.items,
            totals: analysis.totals,
            confidence: analysis.confidence,
            assumptions: analysis.assumptions,
          },
        },
      });
    } catch (error) {
      if (abortController.signal.aborted) return; // client is gone, nothing to respond to
      next(error);
    }
  }

  /**
   * @desc    Get user meals
   * @route   GET /api/nutrition/meals
   * @access  Private
   */
  static async getMeals(req, res, next) {
    try {
      const { date } = req.query;

      const meals = await NutritionService.getUserMeals(req.user.id, date);

      res.status(200).json({
        status: 'success',
        data: meals,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * @desc    Get meal by ID
   * @route   GET /api/nutrition/meals/:id
   * @access  Private
   */
  static async getMealById(req, res, next) {
    try {
      const { id } = req.params;

      const meal = await NutritionService.getMealById(id);

      // Check ownership
      if (meal.userId._id.toString() !== req.user.id.toString()) {
        return res.status(403).json({
          status: 'error',
          message: 'Not authorized to access this meal',
        });
      }

      res.status(200).json({
        status: 'success',
        data: meal,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * @desc    Update a meal
   * @route   PUT /api/nutrition/meals/:id
   * @access  Private
   */
  static async updateMeal(req, res, next) {
    try {
      const { id } = req.params;
      const updateData = req.body;

      if (updateData.quantity && updateData.quantity <= 0) {
        return res.status(400).json({
          status: 'error',
          message: 'Quantity must be greater than 0',
        });
      }

      const updatedMeal = await NutritionService.updateMeal(id, req.user.id, updateData);

      try {
        await WellnessEngine.recordEvent({
          userId: req.user.id,
          type: 'MEAL',
          category: 'meal',
          title: 'Meal updated',
          message: `${updatedMeal.title} was updated in your log.`,
          sourceModule: 'nutrition',
          sourceId: updatedMeal._id.toString(),
          deepLink: '/home',
          priority: 'MEDIUM',
          dedupeKey: `meal:update:${updatedMeal.mealSessionId || updatedMeal._id.toString()}`,
          payload: {
            mealType: updatedMeal.mealType,
            mealSessionId: updatedMeal.mealSessionId,
            calories: updatedMeal.calories,
            protein: updatedMeal.protein,
            carbs: updatedMeal.carbs,
            fat: updatedMeal.fat,
          },
        });
      } catch (notificationError) {
        console.error('Failed to send meal update notification:', notificationError.message);
      }

      res.status(200).json({
        status: 'success',
        message: 'Meal updated successfully',
        data: updatedMeal,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * @desc    Delete a meal
   * @route   DELETE /api/nutrition/meals/:id
   * @access  Private
   */
  static async deleteMeal(req, res, next) {
    try {
      const { id } = req.params;

      await NutritionService.deleteMeal(id, req.user.id);

      try {
        await WellnessEngine.recordEvent({
          userId: req.user.id,
          type: 'MEAL',
          category: 'meal',
          title: 'Meal deleted',
          message: 'A meal was removed from your log.',
          sourceModule: 'nutrition',
          sourceId: id,
          deepLink: '/home',
          priority: 'LOW',
          dedupeKey: `meal:delete:${id}`,
        });
      } catch (notificationError) {
        console.error('Failed to send meal delete notification:', notificationError.message);
      }

      res.status(200).json({
        status: 'success',
        message: 'Meal deleted successfully',
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * @desc    Get nutrition summary
   * @route   GET /api/nutrition/summary
   * @access  Private
   */
  static async getNutritionSummary(req, res, next) {
    try {
      const { startDate, endDate } = req.query;

      if (!startDate || !endDate) {
        return res.status(400).json({
          status: 'error',
          message: 'Start date and end date are required',
        });
      }

      const summary = await NutritionService.getNutritionSummary(req.user.id, startDate, endDate);

      res.status(200).json({
        status: 'success',
        data: summary,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * @desc    Create custom food
   * @route   POST /api/nutrition/foods/custom
   * @access  Private
   */
  static async createCustomFood(req, res, next) {
    try {
      const { name, servingSize, calories, protein, carbs, fat, brand, description } = req.body;

      if (
        !name ||
        !servingSize ||
        !calories ||
        protein === undefined ||
        carbs === undefined ||
        fat === undefined
      ) {
        return res.status(400).json({
          status: 'error',
          message: 'All nutrition fields are required',
        });
      }

      const food = await NutritionService.createCustomFood(req.user.id, {
        name,
        servingSize: parseFloat(servingSize),
        calories: parseFloat(calories),
        protein: parseFloat(protein),
        carbs: parseFloat(carbs),
        fat: parseFloat(fat),
        brand,
        description,
      });

      res.status(201).json({
        status: 'success',
        message: 'Custom food created successfully',
        data: food,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * @desc    Get nutrition targets
   * @route   GET /api/nutrition/targets
   * @access  Private
   */
  static async getNutritionTargets(req, res, next) {
    try {
      const NutritionTarget = require('./nutritionTarget.model');
      const targets = await NutritionTarget.findOne({ userId: req.user.id });

      if (!targets) {
        return res.status(404).json({
          status: 'error',
          message: 'Nutrition targets not found. Please complete onboarding.',
        });
      }

      res.status(200).json({
        status: 'success',
        data: targets,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * @desc    Update nutrition targets
   * @route   PUT /api/nutrition/targets
   * @access  Private
   */
  static async updateNutritionTargets(req, res, next) {
    try {
      const NutritionTarget = require('./nutritionTarget.model');
      const updateData = req.body;

      const targets = await NutritionTarget.findOneAndUpdate(
        { userId: req.user.id },
        { ...updateData, lastUpdated: new Date() },
        { returnDocument: 'after', upsert: true, runValidators: true },
      );

      res.status(200).json({
        status: 'success',
        message: 'Nutrition targets updated successfully',
        data: targets,
      });
    } catch (error) {
      next(error);
    }
  }
}

module.exports = NutritionController;
