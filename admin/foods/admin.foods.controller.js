const Food = require('../../modules/nutrition/food.model');
const logger = require('../../utils/logger');

class AdminFoodsController {
  /**
   * @desc    Get all foods
   * @route   GET /api/admin/foods
   * @access  Private/Admin
   */
  static async getFoods(req, res, next) {
    try {
      const { page = 1, limit = 20, search, source, isVerified } = req.query;

      // Build query
      const query = {};

      if (search) {
        query.$text = { $search: search };
      }

      if (source) {
        query.source = source;
      }

      if (isVerified !== undefined) {
        query.isVerified = isVerified === 'true';
      }

      const skip = (page - 1) * limit;

      const foods = await Food.find(query)
        .populate('createdBy', 'name email')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(parseInt(limit))
        .lean();

      // Get total count
      const total = await Food.countDocuments(query);

      res.status(200).json({
        status: 'success',
        data: foods,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total,
          pages: Math.ceil(total / limit),
        },
      });
    } catch (error) {
      logger.error(`Admin get foods error: ${error.message}`);
      next(error);
    }
  }

  /**
   * @desc    Create food
   * @route   POST /api/admin/foods
   * @access  Private/Admin
   */
  static async createFood(req, res, next) {
    try {
      const foodData = req.body;

      const food = await Food.create({
        ...foodData,
        source: 'manual',
        isVerified: true,
        createdBy: req.user.id,
      });

      res.status(201).json({
        status: 'success',
        message: 'Food created successfully',
        data: food,
      });
    } catch (error) {
      logger.error(`Admin create food error: ${error.message}`);
      next(error);
    }
  }

  /**
   * @desc    Update food
   * @route   PUT /api/admin/foods/:id
   * @access  Private/Admin
   */
  static async updateFood(req, res, next) {
    try {
      const { id } = req.params;
      const updateData = req.body;

      const food = await Food.findByIdAndUpdate(id, updateData, {
        returnDocument: 'after',
        runValidators: true,
      });

      if (!food) {
        return res.status(404).json({
          status: 'error',
          message: 'Food not found',
        });
      }

      res.status(200).json({
        status: 'success',
        message: 'Food updated successfully',
        data: food,
      });
    } catch (error) {
      logger.error(`Admin update food error: ${error.message}`);
      next(error);
    }
  }

  /**
   * @desc    Delete food
   * @route   DELETE /api/admin/foods/:id
   * @access  Private/Admin
   */
  static async deleteFood(req, res, next) {
    try {
      const { id } = req.params;

      const food = await Food.findById(id);
      if (!food) {
        return res.status(404).json({
          status: 'error',
          message: 'Food not found',
        });
      }

      // Check if food is used in meals
      const Meal = require('../../modules/nutrition/meal.model');
      const mealCount = await Meal.countDocuments({ foodId: id });

      if (mealCount > 0) {
        // Soft delete instead
        food.isActive = false;
        await food.save();

        return res.status(200).json({
          status: 'success',
          message: 'Food deactivated (used in meals)',
        });
      }

      await Food.findByIdAndDelete(id);

      res.status(200).json({
        status: 'success',
        message: 'Food deleted successfully',
      });
    } catch (error) {
      logger.error(`Admin delete food error: ${error.message}`);
      next(error);
    }
  }

  /**
   * @desc    Bulk import foods from USDA
   * @route   POST /api/admin/foods/import
   * @access  Private/Admin
   */
  static async importFoods(req, res, next) {
    try {
      const { query, limit = 20 } = req.body;

      if (!query) {
        return res.status(400).json({
          status: 'error',
          message: 'Search query is required',
        });
      }

      // Cap the limit to prevent very large requests that might timeout
      const maxLimit = 50;
      const searchLimit = Math.min(parseInt(limit) || 20, maxLimit);

      const { searchFoods, extractNutritionFacts } = require('../../config/usda');

      // Search USDA database
      const usdaFoods = await searchFoods(query, searchLimit, 1);

      let importedCount = 0;
      let skippedCount = 0;

      for (const usdaFood of usdaFoods) {
        try {
          // Check if already exists
          const existingFood = await Food.findOne({ fdcId: usdaFood.fdcId });

          if (existingFood) {
            skippedCount++;
            continue;
          }

          // Extract nutrition facts
          const foodData = extractNutritionFacts(usdaFood);

          // Save to database
          await Food.create({
            ...foodData,
            source: 'usda',
            isVerified: true,
            createdBy: req.user.id,
          });

          importedCount++;
        } catch (foodError) {
          logger.error(`Failed to import food ${usdaFood.fdcId}: ${foodError.message}`);
          skippedCount++;
          continue;
        }
      }

      res.status(200).json({
        status: 'success',
        message: 'Food import completed',
        data: {
          imported: importedCount,
          skipped: skippedCount,
          total: usdaFoods.length,
        },
      });
    } catch (error) {
      logger.error(`Admin import foods error: ${error.message}`);

      // Provide more specific error messages
      let errorMessage = 'Food import failed';
      let statusCode = 500;

      if (error.message.includes('timeout')) {
        errorMessage =
          'USDA API request timed out. The service may be slow or unavailable. Please try again.';
        statusCode = 504; // Gateway Timeout
      } else if (error.message.includes('USDA API key not configured')) {
        errorMessage = 'USDA API key is not configured. Please check your environment variables.';
        statusCode = 500;
      } else if (error.message.includes('USDA search failed')) {
        errorMessage = 'Failed to search USDA database. Please check your query and try again.';
        statusCode = 502; // Bad Gateway
      }

      res.status(statusCode).json({
        status: 'error',
        message: errorMessage,
        details: process.env.NODE_ENV === 'development' ? error.message : undefined,
      });
    }
  }
}

module.exports = AdminFoodsController;
