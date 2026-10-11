const express = require('express');
const rateLimit = require('express-rate-limit');
const router = express.Router();
const AIController = require('./ai.controller');
const { protect, requireSubscription } = require('../../middlewares/auth.middleware');

// Chat and coach notes can trigger an OpenAI call, so cap them per user (runs after `protect`)
const perUserLimiter = (max, message) =>
  rateLimit({
    windowMs: 10 * 60 * 1000,
    max,
    standardHeaders: true,
    legacyHeaders: false,
    keyGenerator: req => (req.user ? String(req.user.id) : 'anonymous'),
    validate: { keyGeneratorIpFallback: false },
    message: { status: 'error', message },
  });

const chatLimiter = perUserLimiter(60, 'You are sending messages very quickly. Please wait a few minutes and try again.');
const coachNoteLimiter = perUserLimiter(60, 'Too many requests. Please try again in a few minutes.');

// All routes are protected
router.use(protect);

// AI suggestions (available to all)
router.get('/suggestions', AIController.getSuggestions);
router.get('/sleep-tips', AIController.getSleepTips);

// Premium AI features
router.get('/workout-plan', requireSubscription, AIController.getWorkoutPlan);
router.get('/nutrition-advice', requireSubscription, AIController.getNutritionAdvice);
router.get('/progress-insights', requireSubscription, AIController.getProgressInsights);
router.post('/chat', requireSubscription, chatLimiter, AIController.chatWithAI);
router.get('/chat-context', requireSubscription, AIController.getChatContext);
router.get('/coach-note', coachNoteLimiter, AIController.getCoachNote);
router.get('/history', protect, AIController.getChatHistory);

// ---------------------------------------------------------
// NEW AI ENGINE ENDPOINTS (Ported from Python FastAPI app)
// ---------------------------------------------------------
router.post('/analyze', protect, AIController.analyze);
router.post('/progress/checkin', protect, AIController.progressCheckin);
router.get('/progress/:userId', protect, AIController.analyzeProgressHistory);

module.exports = router;
