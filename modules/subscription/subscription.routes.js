const express = require('express');
const router = express.Router();
const SubscriptionController = require('./subscription.controller');
const { protect } = require('../../middlewares/auth.middleware');

// Public routes
router.get('/plans', SubscriptionController.getPlans);

// Protected routes
router.get('/', protect, SubscriptionController.getUserSubscription);
router.post('/checkout', protect, SubscriptionController.createCheckoutSession);
router.post('/portal', protect, SubscriptionController.createPortalSession);
router.get('/verify-session/:sessionId', protect, SubscriptionController.verifyCheckoutSession);
router.post('/success', protect, SubscriptionController.handleSuccess);
router.post('/cancel', protect, SubscriptionController.cancelSubscription);
router.get('/check-access', protect, SubscriptionController.checkPremiumAccess);

// Webhook (raw body needed for Stripe)
router.post('/webhook', express.raw({ type: 'application/json' }), SubscriptionController.webhookHandler);

module.exports = router;
