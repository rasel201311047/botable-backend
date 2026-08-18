const Food = require('../modules/nutrition/food.model');
const Meal = require('../modules/nutrition/meal.model');
const DailyNutritionSummary = require('./dailyNutritionSummary.model');
const NutritionTarget = require('./nutritionTarget.model');
const User = require('../modules/user/user.model');
const WellnessEngine = require('../modules/engine/wellnessEngine.service');
const { validateMealTotals } = require('../utils/healthValidation');
const { searchFoods, getFoodDetails, extractNutritionFacts } = require('../config/usda');
const logger = require('../utils/logger');
const mongoose = require('mongoose');

class NutritionService {
  /**
   * Search foods in USDA database and local database
   * Returns ONLY listing data - NO nutrition values
   * Follow USDA API architecture: Search = Listing, Details = Nutrition
   */
  static async searchFoods(query, page = 1, limit = 20) {
    try {
      if (!query || query.trim().length < 2) {
        throw new Error('Search query must be at least 2 characters');
      }

      const usdaResults = await searchFoods(query, limit, page);

      // Also search in local database for custom foods
      const localResults = await Food.find({
        $text: { $search: query },
        isActive: true,
      })
        .limit(limit)
        .select('name brand servingSize servingUnit')
        .lean();

      // Format results - LISTING ONLY (no nutrition values)
      const formattedResults = [];

      // Add USDA results - listing only
      usdaResults.forEach(food => {
        formattedResults.push({
          id: `usda_${food.fdcId}`,
          fdcId: food.fdcId,
          name: food.description,
          brand: food.brandOwner || null,
          servingSize: food.servingSize || 100,
          servingUnit: food.servingSizeUnit || 'g',
          source: 'usda',
        });
      });

      // Add local custom foods - listing only
      localResults.forEach(food => {
        formattedResults.push({
          id: food._id.toString(),
          name: food.name,
          brand: food.brand,
          servingSize: food.servingSize,
          servingUnit: food.servingUnit,
          source: 'custom',
        });
      });

      return formattedResults;
    } catch (error) {
      logger.error(`Search foods error: ${error.message}`);
      throw error;
    }
  }

  /**
   * Get USDA food details by FDC ID with caching
   * ONLY source of nutrition data - validates nutrition exists
   */
  static async getUSDAFoodDetails(fdcId) {
    try {
      if (!fdcId) {
        throw new Error('FDC ID is required');
      }

      // Check if we have it cached in local DB (with valid nutrition)
      let cachedFood = await Food.findOne({
        fdcId,
        isActive: true,
        // Ensure cached food has nutrition data
        $or: [{ calories: { $gt: 0 } }, { protein: { $gt: 0 } }, { carbs: { $gt: 0 } }, { fat: { $gt: 0 } }],
      });

      if (cachedFood) {
        // Return cached food with nutrition
        const food = cachedFood.toObject();
        food.id = `usda_${fdcId}`;
        food.source = 'usda';
        return food;
      }

      // Not cached, fetch from USDA
      const usdaFood = await getFoodDetails(fdcId);
      const food = extractNutritionFacts(usdaFood);
      food.id = `usda_${fdcId}`;
      food.fdcId = fdcId;
      food.source = 'usda';

      // Validate nutrition exists (prevent database poisoning)
      if (!food.hasNutrition) {
        throw new Error('This food has no nutrition data available in USDA database');
      }

      // Cache ONLY if nutrition values exist
      if (food.calories > 0 || food.protein > 0 || food.carbs > 0 || food.fat > 0) {
        try {
          await Food.create({
            fdcId,
            name: food.name,
            brand: food.brand,
            description: food.description,
            servingSize: food.servingSize,
            servingUnit: food.servingUnit,
            calories: food.calories,
            protein: food.protein,
            carbs: food.carbs,
            fat: food.fat,
            fiber: food.fiber,
            sugar: food.sugar,
            source: 'usda',
            isVerified: true,
          });
        } catch (cacheError) {
          // If caching fails (e.g., duplicate key), just continue
          logger.warn(`Failed to cache USDA food ${fdcId}: ${cacheError.message}`);
        }
      }

      return food;
    } catch (error) {
      logger.error(`Get USDA food details error: ${error.message}`);
      throw error;
    }
  }

  /**
   * Get food details by ID (generic - routes to appropriate handler)
   */
  static async getFoodDetails(foodId) {
    try {
      let food;

      // Check if it's a USDA food (prefixed with 'usda_')
      if (foodId.startsWith('usda_')) {
        const fdcId = foodId.replace('usda_', '');
        // Use getUSDAFoodDetails which handles caching and validation
        food = await this.getUSDAFoodDetails(fdcId);
      } else {
        // Local custom food
        food = await Food.findById(foodId);
        if (!food) {
          throw new Error('Food not found');
        }
        food = food.toObject();
        food.id = food._id.toString();
        food.source = 'custom';
      }

      return food;
    } catch (error) {
      logger.error(`Get food details error: ${error.message}`);
      throw error;
    }
  }

  /**
   * Add a meal
   */
  static async addMeal(userId, mealData) {
    const session = await mongoose.startSession();
    session.startTransaction();

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
      } = mealData;

      const loggedDate = loggedAt ? new Date(loggedAt) : new Date();
      loggedDate.setHours(0, 0, 0, 0);

      let mealPayload = {
        userId,
        mealType: mealType || 'snack',
        title: title || 'Meal',
        scheduledTime,
        notes,
        shiftContext,
        source: source || 'manual',
        loggedAt: loggedAt ? new Date(loggedAt) : new Date(),
        mealSessionId,
        date: loggedDate,
      };

      let nutritionData = { calories: 0, protein: 0, carbs: 0, fat: 0 };
      let resolvedItems = [];

      if (Array.isArray(items) && items.length > 0) {
        resolvedItems = items.map(item => {
          const validation = validateMealTotals(item);
          if (!validation.valid) {
            throw new Error(validation.message);
          }

          return {
            foodId: item.foodId || null,
            name: item.name || item.title || 'Food item',
            quantity: Number(item.quantity || 1),
            servingSize: Number(item.servingSize || item.quantity || 100),
            calories: Math.round(Number(item.calories)),
            protein: Math.round(Number(item.protein) * 10) / 10,
            carbs: Math.round(Number(item.carbs) * 10) / 10,
            fat: Math.round(Number(item.fat) * 10) / 10,
            source: item.source || 'manual',
          };
        });

        nutritionData = resolvedItems.reduce((sum, item) => {
          sum.calories += item.calories;
          sum.protein += item.protein;
          sum.carbs += item.carbs;
          sum.fat += item.fat;
          return sum;
        }, nutritionData);

        mealPayload.items = resolvedItems;
        mealPayload.calories = Math.round(nutritionData.calories);
        mealPayload.protein = Math.round(nutritionData.protein * 10) / 10;
        mealPayload.carbs = Math.round(nutritionData.carbs * 10) / 10;
        mealPayload.fat = Math.round(nutritionData.fat * 10) / 10;
        mealPayload.quantity = resolvedItems.reduce((sum, item) => sum + Number(item.quantity || 0), 0) || 1;
        mealPayload.servingSize = resolvedItems[0]?.servingSize || 100;
      } else {
        if (!foodId) {
          throw new Error('Food ID or meal items are required');
        }

        // Get food details
        let food;
        if (foodId.startsWith('usda_')) {
          const fdcId = foodId.replace('usda_', '');
          const usdaFood = await getFoodDetails(fdcId);
          food = extractNutritionFacts(usdaFood);

          let localFood = await Food.findOne({ fdcId });
          if (!localFood) {
            localFood = await Food.create({
              fdcId,
              name: food.name,
              brand: food.brand,
              description: food.description,
              servingSize: food.servingSize,
              servingUnit: food.servingUnit,
              calories: food.calories,
              protein: food.protein,
              carbs: food.carbs,
              fat: food.fat,
              fiber: food.fiber,
              sugar: food.sugar,
              source: 'usda',
              isVerified: true,
            });
          }
          food._id = localFood._id;
        } else {
          food = await Food.findById(foodId);
          if (!food) {
            throw new Error('Food not found');
          }
        }

        const quantityValue = Number(quantity || food.servingSize || 100);
        const multiplier = quantityValue / food.servingSize;
        nutritionData = {
          calories: Math.round(food.calories * multiplier),
          protein: Math.round(food.protein * multiplier * 10) / 10,
          carbs: Math.round(food.carbs * multiplier * 10) / 10,
          fat: Math.round(food.fat * multiplier * 10) / 10,
        };

        mealPayload = {
          ...mealPayload,
          foodId: food._id,
          quantity: quantityValue,
          calories: nutritionData.calories,
          protein: nutritionData.protein,
          carbs: nutritionData.carbs,
          fat: nutritionData.fat,
          items: [
            {
              foodId: food._id,
              name: food.name,
              quantity: quantityValue,
              servingSize: food.servingSize,
              calories: nutritionData.calories,
              protein: nutritionData.protein,
              carbs: nutritionData.carbs,
              fat: nutritionData.fat,
              source: food.source,
            },
          ],
        };
      }

      // Create meal
      const meal = await Meal.create([{ ...mealPayload }], { session });

      // Update daily nutrition summary
      await this.updateDailyNutritionSummary(userId, nutritionData, session, 1);

      await WellnessEngine.buildContext(userId).catch(() => null);

      await session.commitTransaction();
      session.endSession();

      return meal[0];
    } catch (error) {
      await session.abortTransaction();
      session.endSession();
      logger.error(`Add meal error: ${error.message}`);
      throw error;
    }
  }

  /**
   * Update daily nutrition summary
   */
  static async updateDailyNutritionSummary(userId, nutritionData, session = null, mealCountDelta = 1) {
    try {
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      const update = {
        $inc: {
          calories: nutritionData.calories,
          protein: nutritionData.protein,
          carbs: nutritionData.carbs,
          fat: nutritionData.fat,
          mealCount: mealCountDelta,
        },
        $set: {
          lastMealAt: new Date(),
          updatedAt: new Date(),
        },
      };

      const options = {
        upsert: true,
        returnDocument: 'after',
        setDefaultsOnInsert: true,
        session,
      };

      await DailyNutritionSummary.findOneAndUpdate({ userId, date: today }, update, options);
    } catch (error) {
      logger.error(`Update daily nutrition summary error: ${error.message}`);
      throw error;
    }
  }

  /**
   * Get user meals for a date
   */
  static async getUserMeals(userId, date = null) {
    try {
      const queryDate = date ? new Date(date) : new Date();
      queryDate.setHours(0, 0, 0, 0);

      const meals = await Meal.find({
        userId,
        date: queryDate,
      })
        .populate('foodId', 'name brand servingSize servingUnit')
        .sort({ createdAt: -1 });

      return meals;
    } catch (error) {
      logger.error(`Get user meals error: ${error.message}`);
      throw error;
    }
  }

  /**
   * Get meal by ID
   */
  static async getMealById(mealId) {
    try {
      const meal = await Meal.findById(mealId).populate('foodId').populate('userId', 'name email');

      if (!meal) {
        throw new Error('Meal not found');
      }

      return meal;
    } catch (error) {
      logger.error(`Get meal by ID error: ${error.message}`);
      throw error;
    }
  }

  /**
   * Update a meal
   */
  static async updateMeal(mealId, userId, updateData) {
    const session = await mongoose.startSession();
    session.startTransaction();

    try {
      const meal = await Meal.findById(mealId);
      if (!meal) {
        throw new Error('Meal not found');
      }

      // Check ownership
      if (meal.userId.toString() !== userId.toString()) {
        throw new Error('Not authorized to update this meal');
      }

      // Calculate nutrition changes if quantity changed
      let nutritionDelta = { calories: 0, protein: 0, carbs: 0, fat: 0 };

      if (Array.isArray(updateData.items) && updateData.items.length > 0) {
        const validation = updateData.items.map(item => validateMealTotals(item));
        if (validation.some(result => !result.valid)) {
          const invalid = validation.find(result => !result.valid);
          throw new Error(invalid.message);
        }

        const totals = updateData.items.reduce(
          (sum, item) => ({
            calories: sum.calories + Number(item.calories || 0),
            protein: sum.protein + Number(item.protein || 0),
            carbs: sum.carbs + Number(item.carbs || 0),
            fat: sum.fat + Number(item.fat || 0),
          }),
          { calories: 0, protein: 0, carbs: 0, fat: 0 },
        );

        nutritionDelta = {
          calories: totals.calories - meal.calories,
          protein: totals.protein - meal.protein,
          carbs: totals.carbs - meal.carbs,
          fat: totals.fat - meal.fat,
        };

        updateData.calories = Math.round(totals.calories);
        updateData.protein = Math.round(totals.protein * 10) / 10;
        updateData.carbs = Math.round(totals.carbs * 10) / 10;
        updateData.fat = Math.round(totals.fat * 10) / 10;
      } else if (updateData.quantity && updateData.quantity !== meal.quantity) {
        const food = meal.foodId ? await Food.findById(meal.foodId) : null;
        if (food && food.servingSize) {
          const oldMultiplier = meal.quantity / food.servingSize;
          const newMultiplier = updateData.quantity / food.servingSize;

          nutritionDelta = {
            calories: Math.round(food.calories * (newMultiplier - oldMultiplier)),
            protein: Math.round(food.protein * (newMultiplier - oldMultiplier) * 10) / 10,
            carbs: Math.round(food.carbs * (newMultiplier - oldMultiplier) * 10) / 10,
            fat: Math.round(food.fat * (newMultiplier - oldMultiplier) * 10) / 10,
          };

          updateData.calories = Math.round(food.calories * newMultiplier);
          updateData.protein = Math.round(food.protein * newMultiplier * 10) / 10;
          updateData.carbs = Math.round(food.carbs * newMultiplier * 10) / 10;
          updateData.fat = Math.round(food.fat * newMultiplier * 10) / 10;
        }
      }

      // Update meal
      const updatedMeal = await Meal.findByIdAndUpdate(
        mealId,
        { ...updateData, updatedAt: Date.now() },
        { returnDocument: 'after', session },
      );

      // Update daily nutrition summary if nutrition changed
      if (nutritionDelta.calories !== 0) {
        await this.updateDailyNutritionSummary(userId, nutritionDelta, session, 0);
      }

      await WellnessEngine.buildContext(userId).catch(() => null);

      await session.commitTransaction();
      session.endSession();

      return updatedMeal;
    } catch (error) {
      await session.abortTransaction();
      session.endSession();
      logger.error(`Update meal error: ${error.message}`);
      throw error;
    }
  }

  /**
   * Delete a meal
   */
  static async deleteMeal(mealId, userId) {
    const session = await mongoose.startSession();
    session.startTransaction();

    try {
      const meal = await Meal.findById(mealId);
      if (!meal) {
        throw new Error('Meal not found');
      }

      // Check ownership
      if (meal.userId.toString() !== userId.toString()) {
        throw new Error('Not authorized to delete this meal');
      }

      const nutritionDelta = {
        calories: -Math.round(meal.calories || 0),
        protein: -Math.round((meal.protein || 0) * 10) / 10,
        carbs: -Math.round((meal.carbs || 0) * 10) / 10,
        fat: -Math.round((meal.fat || 0) * 10) / 10,
      };

      // Delete meal
      await Meal.findByIdAndDelete(mealId, { session });

      // Update daily nutrition summary
      await this.updateDailyNutritionSummary(userId, nutritionDelta, session, -1);

      await WellnessEngine.buildContext(userId).catch(() => null);

      await session.commitTransaction();
      session.endSession();

      return true;
    } catch (error) {
      await session.abortTransaction();
      session.endSession();
      logger.error(`Delete meal error: ${error.message}`);
      throw error;
    }
  }

  /**
   * Get user nutrition summary for a date range
   */
  static async getNutritionSummary(userId, startDate, endDate) {
    try {
      const summaries = await DailyNutritionSummary.find({
        userId,
        date: { $gte: new Date(startDate), $lte: new Date(endDate) },
      }).sort({ date: 1 });

      // Get nutrition targets
      const targets = await NutritionTarget.findOne({ userId });

      return {
        summaries,
        targets,
      };
    } catch (error) {
      logger.error(`Get nutrition summary error: ${error.message}`);
      throw error;
    }
  }

  /**
   * Create custom food
   */
  static async createCustomFood(userId, foodData) {
    try {
      const food = await Food.create({
        ...foodData,
        source: 'user',
        createdBy: userId,
        isVerified: false,
      });

      return food;
    } catch (error) {
      logger.error(`Create custom food error: ${error.message}`);
      throw error;
    }
  }

  /**
   * Helper function to find nutrient amount
   */
  static findNutrientAmount(nutrients, nutrientId) {
    const nutrient = nutrients.find(n => n.nutrientId === nutrientId);
    return Math.round(nutrient?.amount || 0);
  }
}

module.exports = NutritionService;
