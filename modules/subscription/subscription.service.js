const User = require('../user/user.model');
const SubscriptionPlan = require('./subscriptionPlan.model');
const notificationService = require('../notification/notification.service');
const {
  stripe,
  createCustomer,
  createCheckoutSession,
  createPortalSession,
  getSubscription,
  cancelSubscription,
} = require('../../config/stripe');
const logger = require('../../utils/logger');

class SubscriptionService {
  /**
   * Initialize default subscription plans in database
   */
  static async initializeDefaultPlans() {
    try {
      const existingPlans = await SubscriptionPlan.countDocuments();
      if (existingPlans === 0) {
        const defaultPlans = [
          {
            name: 'free',
            displayName: 'Free',
            price: 0,
            currency: 'usd',
            interval: null,
            stripePriceId: null,
            features: [
              'Basic workout tracking',
              'Nutrition logging',
              'Sleep tracking',
              'Basic analytics',
              '1-month free trial of premium features',
            ],
            isActive: true,
          },
          {
            name: 'monthly',
            displayName: 'Monthly',
            price: 10,
            currency: 'usd',
            interval: 'month',
            stripePriceId: null,
            features: [
              'All free features',
              'Advanced AI recommendations',
              'Detailed analytics',
              'Custom workout plans',
              'Priority support',
              'Export data',
            ],
            isActive: true,
          },
          {
            name: 'yearly',
            displayName: 'Yearly',
            price: 100,
            currency: 'usd',
            interval: 'year',
            stripePriceId: null,
            features: [
              'All monthly features',
              '2 months free (compared to monthly)',
              'Priority support',
              'Early access to new features',
            ],
            isActive: true,
          },
        ];
        await SubscriptionPlan.insertMany(defaultPlans);
        logger.info('Default subscription plans initialized');
      }
    } catch (error) {
      logger.error(`Initialize default plans error: ${error.message}`);
    }
  }

  /**
   * Get subscription plans from database
   */
  static async getPlans() {
    try {
      const plans = await SubscriptionPlan.find({ isActive: true }).lean();

      // Transform array to object with plan name as key
      const plansObj = {};
      plans.forEach(plan => {
        const { name, ...planData } = plan;
        plansObj[name] = {
          name: plan.displayName,
          price: plan.price,
          currency: plan.currency,
          interval: plan.interval,
          features: plan.features,
          stripePriceId: plan.stripePriceId,
        };
      });

      return plansObj;
    } catch (error) {
      logger.error(`Get plans error: ${error.message}`);
      throw error;
    }
  }

  /**
   * Get user subscription status
   */
  static async getUserSubscription(userId) {
    try {
      const user = await User.findById(userId);
      if (!user) {
        throw new Error('User not found');
      }

      // Check if free trial is expired
      const isTrialExpired = this.isTrialExpired(user);

      return {
        plan: user.subscription.plan,
        isActive: user.subscription.isActive && !isTrialExpired,
        startDate: user.subscription.startDate,
        endDate: user.subscription.endDate,
        trialExpired: isTrialExpired,
        features: await this.getPlanFeatures(user.subscription.plan),
        canUpgrade: user.subscription.plan === 'free',
      };
    } catch (error) {
      logger.error(`Get user subscription error: ${error.message}`);
      throw error;
    }
  }

  /**
   * Create checkout session for subscription
   */
  static async createCheckoutSession(userId, plan) {
    try {
      const user = await User.findById(userId);
      if (!user) {
        throw new Error('User not found');
      }

      // Validate plan exists and is not free
      if (plan === 'free') {
        throw new Error('Cannot create checkout session for free plan');
      }

      // Get plan from database
      const planRecord = await SubscriptionPlan.findOne({ name: plan, isActive: true });
      if (!planRecord) {
        throw new Error('Invalid subscription plan');
      }

      // Validate Stripe price ID is configured
      const priceId = planRecord.stripePriceId;
      if (!priceId) {
        throw new Error(
          `Stripe price ID not configured for ${plan} plan. Please update the subscription plan with a valid Stripe price ID.`,
        );
      }

      // Get or create Stripe customer
      let customerId = user.subscription.stripeCustomerId;
      if (!customerId) {
        customerId = await createCustomer(user);

        // Update user with Stripe customer ID
        user.subscription.stripeCustomerId = customerId;
        await user.save();
      }

      // Create checkout session
      const successUrl = `${process.env.APP_URL}/subscription/success?session_id={CHECKOUT_SESSION_ID}`;
      const cancelUrl = `${process.env.APP_URL}/subscription/cancel`;

      const session = await createCheckoutSession(customerId, priceId, successUrl, cancelUrl);

      return {
        sessionId: session.id,
        url: session.url,
      };
    } catch (error) {
      logger.error(`Create checkout session error: ${error.message}`);
      throw error;
    }
  }

  /**
   * Verify and activate subscription after successful checkout
   */
  static async verifyAndActivateSubscription(userId, sessionId) {
    try {
      const user = await User.findById(userId);
      if (!user) {
        throw new Error('User not found');
      }

      // Retrieve the checkout session from Stripe
      const session = await stripe.checkout.sessions.retrieve(sessionId);

      if (!session) {
        throw new Error('Checkout session not found');
      }

      // Verify payment status
      if (session.payment_status !== 'paid') {
        throw new Error('Payment was not completed');
      }

      // Get subscription details from Stripe
      const subscriptionId = session.subscription;
      const stripeSubscription = await stripe.subscriptions.retrieve(subscriptionId);

      if (!stripeSubscription) {
        throw new Error('Stripe subscription not found');
      }

      // Determine plan from price
      let planName = 'monthly';
      if (stripeSubscription.items.data.length > 0) {
        const priceId = stripeSubscription.items.data[0].price.id;
        const subscriptionPlan = await SubscriptionPlan.findOne({ stripePriceId: priceId });

        if (subscriptionPlan) {
          planName = subscriptionPlan.name;
        }
      }

      // Validate and convert end date
      let endDate = null;
      if (stripeSubscription.current_period_end) {
        const timestamp = parseInt(stripeSubscription.current_period_end);
        if (!isNaN(timestamp)) {
          endDate = new Date(timestamp * 1000);
        }
      }

      if (!endDate || isNaN(endDate.getTime())) {
        // If no valid end date from Stripe, calculate based on plan interval
        endDate = new Date();
        if (planName === 'yearly') {
          endDate.setFullYear(endDate.getFullYear() + 1);
        } else {
          endDate.setMonth(endDate.getMonth() + 1);
        }
      }

      // Update user subscription in database
      user.subscription.plan = planName;
      user.subscription.isActive = true;
      user.subscription.stripeCustomerId = session.customer;
      user.subscription.stripeSubscriptionId = subscriptionId;
      user.subscription.startDate = new Date();
      user.subscription.endDate = endDate;

      await user.save();

      logger.info(`Subscription activated for user ${userId}: ${planName}`);

      return {
        plan: planName,
        isActive: true,
        startDate: user.subscription.startDate,
        endDate: user.subscription.endDate,
        sessionId: sessionId,
      };
    } catch (error) {
      logger.error(`Verify subscription error: ${error.message}`);
      throw error;
    }
  }

  /**
   * Create portal session for subscription management
   */
  static async createPortalSession(userId) {
    try {
      const user = await User.findById(userId);
      if (!user) {
        throw new Error('User not found');
      }

      if (!user.subscription.stripeCustomerId) {
        throw new Error('No Stripe customer found');
      }

      const returnUrl = `${process.env.APP_URL}/profile`;
      const session = await createPortalSession(user.subscription.stripeCustomerId, returnUrl);

      return {
        url: session.url,
      };
    } catch (error) {
      logger.error(`Create portal session error: ${error.message}`);
      throw error;
    }
  }

  /**
   * Handle successful subscription
   */
  static async handleSubscriptionSuccess(userId, sessionId) {
    try {
      return await this.verifyAndActivateSubscription(userId, sessionId);
    } catch (error) {
      logger.error(`Handle subscription success error: ${error.message}`);
      throw error;
    }
  }

  /**
   * Cancel subscription
   */
  static async cancelSubscription(userId) {
    try {
      const user = await User.findById(userId);
      if (!user) {
        throw new Error('User not found');
      }

      if (!user.subscription.stripeSubscriptionId) {
        // For demo, just update the database
        user.subscription.isActive = false;
        user.subscription.endDate = new Date();
        await user.save();

        return {
          cancelled: true,
          message: 'Subscription cancelled successfully',
        };
      }

      // Cancel with Stripe
      await cancelSubscription(user.subscription.stripeSubscriptionId);

      // Update user
      user.subscription.isActive = false;
      user.subscription.endDate = new Date();
      await user.save();

      try {
        await notificationService.sendSubscriptionNotification(userId, 'subscription_cancelled', {
          planName: user.subscription.plan,
          subscriptionId: user.subscription.stripeSubscriptionId,
        });
      } catch (notificationError) {
        logger.error(`Subscription cancellation notification error: ${notificationError.message}`);
      }

      logger.info(`Subscription cancelled for user ${userId}`);

      return {
        cancelled: true,
        message: 'Subscription cancelled successfully',
      };
    } catch (error) {
      logger.error(`Cancel subscription error: ${error.message}`);
      throw error;
    }
  }

  /**
   * Update subscription from webhook
   */
  static async updateSubscriptionFromWebhook(event) {
    try {
      const object = event.data.object;

      if (event.type === 'checkout.session.completed') {
        const session = object;
        const customerId = session.customer;
        const user = await User.findOne({ 'subscription.stripeCustomerId': customerId });

        if (!user) {
          logger.warn(`User not found for Stripe customer: ${customerId}`);
          return;
        }

        if (session.payment_status !== 'paid') {
          logger.warn(`Checkout session not paid for user ${user._id}: ${session.id}`);
          return;
        }

        let planName = 'monthly';
        if (session.subscription) {
          const stripeSubscription = await stripe.subscriptions.retrieve(session.subscription);
          const priceId = stripeSubscription.items.data[0]?.price?.id;
          if (priceId) {
            const subscriptionPlan = await SubscriptionPlan.findOne({ stripePriceId: priceId });
            if (subscriptionPlan) {
              planName = subscriptionPlan.name;
            }
          }

          user.subscription.stripeSubscriptionId = stripeSubscription.id;
          user.subscription.endDate = stripeSubscription.current_period_end
            ? new Date(stripeSubscription.current_period_end * 1000)
            : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
        }

        user.subscription.plan = planName;
        user.subscription.isActive = true;
        user.subscription.startDate = new Date();
        user.subscription.status = 'active';
        await user.save();

        try {
          await notificationService.sendSubscriptionNotification(user._id, 'subscription_created', {
            planName: user.subscription.plan,
            subscriptionId: session.subscription || session.id,
          });
        } catch (notificationError) {
          logger.error('Failed to send checkout subscription notification:', notificationError.message);
        }

        logger.info(`Updated subscription for user ${user._id}: checkout.session.completed`);
        return;
      }

      const subscription = object;
      const customerId = subscription.customer;
      const status = subscription.status;

      // Find user by Stripe customer ID
      const user = await User.findOne({ 'subscription.stripeCustomerId': customerId });
      if (!user) {
        logger.warn(`User not found for Stripe customer: ${customerId}`);
        return;
      }

      switch (status) {
        case 'active':
          user.subscription.isActive = true;
          user.subscription.stripeSubscriptionId = subscription.id;
          user.subscription.endDate = new Date(subscription.current_period_end * 1000);

          // Send subscription activated notification
          try {
            await notificationService.sendSubscriptionNotification(user._id, 'subscription_created', {
              planName: user.subscription.plan,
              amount: subscription.items.data[0]?.price?.unit_amount / 100 || 0,
              interval: subscription.items.data[0]?.price?.recurring?.interval || 'month',
            });
          } catch (notificationError) {
            logger.error('Failed to send subscription created notification:', notificationError.message);
          }
          break;

        case 'canceled':
        case 'unpaid':
        case 'past_due':
          user.subscription.isActive = false;
          user.subscription.endDate = new Date();

          // Send subscription cancelled/expired notification
          try {
            const eventType = status === 'canceled' ? 'subscription_cancelled' : 'subscription_expired';
            await notificationService.sendSubscriptionNotification(user._id, eventType, {
              planName: user.subscription.plan,
              cancelledAt: new Date(),
            });
          } catch (notificationError) {
            logger.error('Failed to send subscription status notification:', notificationError.message);
          }
          break;

        case 'trialing':
          user.subscription.plan = 'free';
          user.subscription.isActive = true;
          user.subscription.startDate = new Date();
          user.subscription.endDate = new Date(subscription.trial_end * 1000);
          break;
      }

      await user.save();
      logger.info(`Updated subscription for user ${user._id}: ${status}`);
    } catch (error) {
      logger.error(`Update subscription from webhook error: ${error.message}`);
    }
  }

  /**
   * Check if user has access to premium features
   */
  static async hasPremiumAccess(userId) {
    try {
      const subscription = await this.getUserSubscription(userId);
      return subscription.isActive && subscription.plan !== 'free';
    } catch (error) {
      logger.error(`Check premium access error: ${error.message}`);
      return false;
    }
  }

  /**
   * Check if free trial is expired
   */
  static isTrialExpired(user) {
    if (user.subscription.plan !== 'free') {
      return false;
    }

    const trialEnd = new Date(user.createdAt);
    trialEnd.setMonth(trialEnd.getMonth() + 1); // 1 month free trial

    return new Date() > trialEnd;
  }

  /**
   * Get features for a plan
   */
  static async getPlanFeatures(plan) {
    try {
      const planRecord = await SubscriptionPlan.findOne({ name: plan, isActive: true }).lean();
      return planRecord?.features || [];
    } catch (error) {
      logger.error(`Get plan features error: ${error.message}`);
      return [];
    }
  }
}

module.exports = SubscriptionService;
