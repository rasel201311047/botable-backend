const express = require('express');
const router = express.Router();
const { protect, admin } = require('../middlewares/auth.middleware');

// Import admin controllers
const adminAuthController = require('./auth/admin.auth.controller');
const adminUsersController = require('./users/admin.users.controller');
const adminWorkoutsController = require('./workouts/admin.workouts.controller');
const adminRecoveryController = require('./recovery/admin.recovery.controller');
const adminFoodsController = require('./foods/admin.foods.controller');
const adminSubscriptionsController = require('./subscriptions/admin.subscriptions.controller');
const adminSubscriptionPlansController = require('./subscriptions/admin.subscription-plans.controller');
const adminAnalyticsController = require('./analytics/admin.analytics.controller');
const adminSettingsController = require('./settings/admin.settings.controller');
const adminContentRoutes = require('./content/admin.content.routes');
const { uploadWorkoutImage } = require('../config/upload');

// Admin auth
router.post('/login', adminAuthController.login);

// All routes below require admin authentication
router.use(protect);
router.use(admin);

// Admin dashboard
router.get('/dashboard', adminAnalyticsController.getDashboardStats);

// User management
router.get('/users', adminUsersController.getUsers);
router.get('/users/:id', adminUsersController.getUserById);
router.put('/users/:id', adminUsersController.updateUser);
router.delete('/users/:id', adminUsersController.deleteUser);
router.put('/users/:id/status', adminUsersController.updateUserStatus);
router.put('/users/:id/block', adminUsersController.blockUser);
router.put('/users/:id/unblock', adminUsersController.unblockUser);

// Workout management
router.get('/workouts', adminWorkoutsController.getWorkouts);
router.post('/workouts', uploadWorkoutImage().any(), adminWorkoutsController.createWorkout);
router.put('/workouts/:id', uploadWorkoutImage().any(), adminWorkoutsController.updateWorkout);
router.delete('/workouts/:id', adminWorkoutsController.deleteWorkout);

// Recovery activities management
router.get('/recovery-activities', adminRecoveryController.getActivities);
router.post('/recovery-activities', adminRecoveryController.createActivity);
router.put('/recovery-activities/:id', adminRecoveryController.updateActivity);
router.delete('/recovery-activities/:id', adminRecoveryController.deleteActivity);

// Food database management
router.get('/foods', adminFoodsController.getFoods);
router.post('/foods', adminFoodsController.createFood);
router.post('/foods/import', adminFoodsController.importFoods);
router.put('/foods/:id', adminFoodsController.updateFood);
router.delete('/foods/:id', adminFoodsController.deleteFood);

// Subscription management
router.get('/subscriptions', adminSubscriptionsController.getSubscriptions);
router.get('/subscriptions/stats/total', adminSubscriptionsController.getTotalSubscriptions);
router.get('/subscriptions/stats/revenue', adminSubscriptionsController.getMonthlyRevenue);
router.get('/subscriptions/transactions', adminSubscriptionsController.getRecentTransactions);
router.get('/subscriptions/transactions/:transactionId', adminSubscriptionsController.getTransactionDetail);
router.put('/subscriptions/:userId', adminSubscriptionsController.updateSubscription);
router.put('/subscriptions/:userId/status', adminSubscriptionsController.updateSubscription);
router.get('/payments', adminSubscriptionsController.getPayments);
router.get('/revenue', adminSubscriptionsController.getRevenueStats);

// Subscription plans management
router.get('/subscription-plans', adminSubscriptionPlansController.getPlans);
router.get('/subscription-plans/:id', adminSubscriptionPlansController.getPlanById);
router.put('/subscription-plans/:id', adminSubscriptionPlansController.updatePlan);
router.put('/subscription-plans/:id/stripe-price', adminSubscriptionPlansController.updateStripePriceId);

// Analytics
router.get('/analytics/overview', adminAnalyticsController.getOverview);
router.get('/analytics/usage', adminAnalyticsController.getUsageStats);

// Settings
router.get('/settings', adminSettingsController.getSettings);
router.put('/settings', adminSettingsController.updateSettings);

// Content Management (Terms, Privacy, FAQs, Contact Support)
router.use('/', adminContentRoutes);

module.exports = router;
