const express = require('express');
const router = express.Router();
const OnboardingController = require('./onboarding.controller');
const { protect, admin } = require('../../middlewares/auth.middleware');

// Protected routes
router.get('/shifts', protect, OnboardingController.getShifts);
router.get('/goals', protect, OnboardingController.getGoals);
router.put('/shift', protect, OnboardingController.updateShift);
router.put('/goal', protect, OnboardingController.updateGoal);
router.post('/complete', protect, OnboardingController.completeOnboarding);
router.get('/status', protect, OnboardingController.getStatus);

// Admin routes
router.post('/seed', protect, admin, OnboardingController.seedDefaultData);

module.exports = router;