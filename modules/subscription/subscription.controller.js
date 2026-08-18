const SubscriptionService = require('./subscription.service');
const logger = require('../../utils/logger');

class SubscriptionController {
  /**
   * @desc    Get subscription plans
   * @route   GET /api/subscription/plans
   * @access  Public
   */
  static async getPlans(req, res, next) {
    try {
      const plans = await SubscriptionService.getPlans();

      res.status(200).json({
        status: 'success',
        data: plans,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * @desc    Get user subscription
   * @route   GET /api/subscription
   * @access  Private
   */
  static async getUserSubscription(req, res, next) {
    try {
      const subscription = await SubscriptionService.getUserSubscription(req.user.id);

      res.status(200).json({
        status: 'success',
        data: subscription,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * @desc    Create checkout session
   * @route   POST /api/subscription/checkout
   * @access  Private
   */
  static async createCheckoutSession(req, res, next) {
    try {
      const { plan } = req.body;

      if (!plan) {
        return res.status(400).json({
          status: 'error',
          message: 'Subscription plan is required',
        });
      }

      const session = await SubscriptionService.createCheckoutSession(req.user.id, plan);

      res.status(200).json({
        status: 'success',
        data: session,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * @desc    Create portal session
   * @route   POST /api/subscription/portal
   * @access  Private
   */
  static async createPortalSession(req, res, next) {
    try {
      const session = await SubscriptionService.createPortalSession(req.user.id);

      res.status(200).json({
        status: 'success',
        data: session,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * @desc    Verify checkout session and activate subscription
   * @route   GET /api/subscription/verify-session/:sessionId
   * @access  Private
   */
  static async verifyCheckoutSession(req, res, next) {
    try {
      const { sessionId } = req.params;
      const userId = req.user.id;

      if (!sessionId) {
        return res.status(400).json({
          status: 'error',
          message: 'Session ID is required',
        });
      }

      const subscription = await SubscriptionService.verifyAndActivateSubscription(userId, sessionId);

      res.status(200).json({
        status: 'success',
        message: 'Subscription activated successfully',
        data: subscription,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * @desc    Handle subscription success (legacy)
   * @route   POST /api/subscription/success
   * @access  Private
   */
  static async handleSuccess(req, res, next) {
    try {
      const { sessionId } = req.body;

      if (!sessionId) {
        return res.status(400).json({
          status: 'error',
          message: 'Session ID is required',
        });
      }

      const subscription = await SubscriptionService.handleSubscriptionSuccess(req.user.id, sessionId);

      res.status(200).json({
        status: 'success',
        message: 'Subscription activated successfully',
        data: subscription,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * @desc    Cancel subscription
   * @route   POST /api/subscription/cancel
   * @access  Private
   */
  static async cancelSubscription(req, res, next) {
    try {
      const result = await SubscriptionService.cancelSubscription(req.user.id);

      res.status(200).json({
        status: 'success',
        message: result.message,
        data: result,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * @desc    Check premium access
   * @route   GET /api/subscription/check-access
   * @access  Private
   */
  static async checkPremiumAccess(req, res, next) {
    try {
      const hasAccess = await SubscriptionService.hasPremiumAccess(req.user.id);

      res.status(200).json({
        status: 'success',
        data: { hasPremiumAccess: hasAccess },
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * @desc    Webhook handler for Stripe events
   * @route   POST /api/subscription/webhook
   * @access  Public
   */
  static async webhookHandler(req, res, next) {
    try {
      const { verifyWebhook } = require('../../config/stripe');

      const sig = req.headers['stripe-signature'];
      const event = verifyWebhook(req.rawBody || req.body, sig);

      // Handle the event
      switch (event.type) {
        case 'customer.subscription.created':
        case 'customer.subscription.updated':
        case 'customer.subscription.deleted':
          await SubscriptionService.updateSubscriptionFromWebhook(event);
          break;

        case 'checkout.session.completed':
          await SubscriptionService.updateSubscriptionFromWebhook(event);
          break;

        default:
          logger.info(`Unhandled Stripe event type: ${event.type}`);
      }

      res.status(200).json({ received: true });
    } catch (error) {
      next(error);
    }
  }
}

module.exports = SubscriptionController;
