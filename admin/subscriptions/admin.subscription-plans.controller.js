const SubscriptionPlan = require('../../modules/subscription/subscriptionPlan.model');
const logger = require('../../utils/logger');

class AdminSubscriptionPlansController {
  /**
   * @desc    Get all subscription plans
   * @route   GET /api/admin/subscription-plans
   * @access  Admin
   */
  static async getPlans(req, res, next) {
    try {
      const plans = await SubscriptionPlan.find();

      res.status(200).json({
        status: 'success',
        data: plans,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * @desc    Update subscription plan with Stripe price ID
   * @route   PUT /api/admin/subscription-plans/:id
   * @access  Admin
   */
  static async updatePlan(req, res, next) {
    try {
      const { id } = req.params;
      const { stripePriceId, price, currency, interval, features, isActive } = req.body;

      // Validate Stripe price ID format
      if (stripePriceId && !stripePriceId.startsWith('price_')) {
        return res.status(400).json({
          status: 'error',
          message: 'Invalid Stripe price ID format. Must start with "price_"',
        });
      }

      const plan = await SubscriptionPlan.findByIdAndUpdate(
        id,
        {
          stripePriceId,
          price,
          currency,
          interval,
          features,
          isActive,
          updatedAt: new Date(),
        },
        { returnDocument: 'after', runValidators: true },
      );

      if (!plan) {
        return res.status(404).json({
          status: 'error',
          message: 'Plan not found',
        });
      }

      logger.info(`Subscription plan updated: ${plan.name}`);

      res.status(200).json({
        status: 'success',
        data: plan,
        message: 'Plan updated successfully',
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * @desc    Update plan Stripe price ID
   * @route   PUT /api/admin/subscription-plans/:id/stripe-price
   * @access  Admin
   */
  static async updateStripePriceId(req, res, next) {
    try {
      const { id } = req.params;
      const { stripePriceId } = req.body;

      if (!stripePriceId) {
        return res.status(400).json({
          status: 'error',
          message: 'Stripe price ID is required',
        });
      }

      if (!stripePriceId.startsWith('price_')) {
        return res.status(400).json({
          status: 'error',
          message: 'Invalid Stripe price ID format. Must start with "price_"',
        });
      }

      const plan = await SubscriptionPlan.findByIdAndUpdate(
        id,
        { stripePriceId, updatedAt: new Date() },
        { returnDocument: 'after' },
      );

      if (!plan) {
        return res.status(404).json({
          status: 'error',
          message: 'Plan not found',
        });
      }

      logger.info(`Stripe price ID updated for plan: ${plan.name} - ${stripePriceId}`);

      res.status(200).json({
        status: 'success',
        data: plan,
        message: `Stripe price ID updated successfully for ${plan.displayName} plan`,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * @desc    Get subscription plan by ID
   * @route   GET /api/admin/subscription-plans/:id
   * @access  Admin
   */
  static async getPlanById(req, res, next) {
    try {
      const { id } = req.params;

      const plan = await SubscriptionPlan.findById(id);

      if (!plan) {
        return res.status(404).json({
          status: 'error',
          message: 'Plan not found',
        });
      }

      res.status(200).json({
        status: 'success',
        data: plan,
      });
    } catch (error) {
      next(error);
    }
  }
}

module.exports = AdminSubscriptionPlansController;
