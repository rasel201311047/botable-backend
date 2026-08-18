const express = require('express');
const router = express.Router();
const NutritionController = require('./nutrition.controller');
const { protect } = require('../middlewares/auth.middleware');

// Food search and management
router.get('/foods/search', protect, NutritionController.searchFoods);
router.get('/foods/usda/:fdcId', protect, NutritionController.getUSDAFoodDetails);
router.get('/foods/:id', protect, NutritionController.getFoodDetails);
router.post('/foods/custom', protect, NutritionController.createCustomFood);

// Meal management
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