const express = require('express');
const router = express.Router();
const AIController = require('./ai.controller');
const { protect, requireSubscription } = require('../../middlewares/auth.middleware');

// All routes are protected
router.use(protect);

// AI suggestions (available to all)
router.get('/suggestions', AIController.getSuggestions);
router.get('/sleep-tips', AIController.getSleepTips);

// Premium AI features
router.get('/workout-plan', requireSubscription, AIController.getWorkoutPlan);
router.get('/nutrition-advice', requireSubscription, AIController.getNutritionAdvice);
router.get('/progress-insights', requireSubscription, AIController.getProgressInsights);
router.post('/chat', requireSubscription, AIController.chatWithAI);
router.get('/history', protect, AIController.getChatHistory);

// ---------------------------------------------------------
// NEW AI ENGINE ENDPOINTS (Ported from Python FastAPI app)
// ---------------------------------------------------------
router.post('/analyze', protect, AIController.analyze);
router.post('/progress/checkin', protect, AIController.progressCheckin);
router.get('/progress/:userId', protect, AIController.analyzeProgressHistory);

module.exports = router;
