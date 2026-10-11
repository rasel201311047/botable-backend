const express = require('express');
const rateLimit = require('express-rate-limit');
const router = express.Router();
const NutritionController = require('./nutrition.controller');
const { protect } = require('../middlewares/auth.middleware');

// Each AI meal analysis costs an OpenAI call, so cap it per user (runs after `protect`, so req.user exists)
const aiMealLimiter = rateLimit({
  windowMs: 10 * 60 * 1000, // 10 minutes
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: req => (req.user ? String(req.user.id) : 'anonymous'),
  validate: { keyGeneratorIpFallback: false },
  message: {
    status: 'error',
    message: 'You are logging meals very quickly. Please wait a few minutes and try again.',
  },
});

// Food search and management
router.get('/foods/search', protect, NutritionController.searchFoods);
router.get('/foods/usda/:fdcId', protect, NutritionController.getUSDAFoodDetails);
router.get('/foods/:id', protect, NutritionController.getFoodDetails);
router.post('/foods/custom', protect, NutritionController.createCustomFood);

// Meal management
router.post('/meals/ai-log', protect, aiMealLimiter, NutritionController.logMealWithAI);
router.post('/meals', protect, NutritionController.addMeal);
router.get('/meals', protect, NutritionController.getMeals);
router.get('/meals/:id', protect, NutritionController.getMealById);
router.put('/meals/:id', protect, NutritionController.updateMeal);
router.delete('/meals/:id', protect, NutritionController.deleteMeal);

// Nutrition summary and targets
router.get('/summary', protect, NutritionController.getNutritionSummary);
router.get('/targets', protect, NutritionController.getNutritionTargets);
router.put('/targets', protect, NutritionController.updateNutritionTargets);

module.exports = router;
