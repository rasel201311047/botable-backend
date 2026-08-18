const Stripe = require('stripe');
const logger = require('../utils/logger');

if (!process.env.STRIPE_SECRET_KEY) {
  logger.warn('STRIPE_SECRET_KEY is not set. Subscription features will not work.');
}

const stripe = Stripe(process.env.STRIPE_SECRET_KEY || 'dummy_key');

/**
 * Create a Stripe customer
 * @param {Object} user - User object
 * @returns {Promise<string>} Stripe customer ID
 */
const createCustomer = async (user) => {
  if (!process.env.STRIPE_SECRET_KEY) {
    throw new Error('Stripe not configured');
  }

  try {
    const customer = await stripe.customers.create({
      email: user.email,
      name: user.name,
      metadata: {
        userId: user._id.toString()
      }
    });

    return customer.id;
  } catch (error) {
    logger.error(`Create Stripe customer error: ${error.message}`);
    throw new Error(`Failed to create Stripe customer: ${error.message}`);
  }
};

/**
 * Create a subscription
 * @param {string} customerId - Stripe customer ID
 * @param {string} priceId - Stripe price ID
 * @returns {Promise<Object>} Subscription object
 */
const createSubscription = async (customerId, priceId) => {
  if (!process.env.STRIPE_SECRET_KEY) {
    throw new Error('Stripe not configured');
  }

  try {
    const subscription = await stripe.subscriptions.create({
      customer: customerId,
      items: [{ price: priceId }],
      payment_behavior: 'default_incomplete',
      payment_settings: { save_default_payment_method: 'on_subscription' },
      expand: ['latest_invoice.payment_intent']
    });

    return subscription;
  } catch (error) {
    logger.error(`Create Stripe subscription error: ${error.message}`);
    throw new Error(`Failed to create subscription: ${error.message}`);
  }
};

/**
 * Cancel a subscription
 * @param {string} subscriptionId - Stripe subscription ID
 * @returns {Promise<Object>} Cancelled subscription object
 */
const cancelSubscription = async (subscriptionId) => {
  if (!process.env.STRIPE_SECRET_KEY) {
    throw new Error('Stripe not configured');
  }

  try {
    const cancelledSubscription = await stripe.subscriptions.cancel(subscriptionId);
    return cancelledSubscription;
  } catch (error) {
    logger.error(`Cancel Stripe subscription error: ${error.message}`);
    throw new Error(`Failed to cancel subscription: ${error.message}`);
  }
};

/**
 * Get subscription details
 * @param {string} subscriptionId - Stripe subscription ID
 * @returns {Promise<Object>} Subscription details
 */
const getSubscription = async (subscriptionId) => {
  if (!process.env.STRIPE_SECRET_KEY) {
    throw new Error('Stripe not configured');
  }

  try {
    const subscription = await stripe.subscriptions.retrieve(subscriptionId);
    return subscription;
  } catch (error) {
    logger.error(`Get Stripe subscription error: ${error.message}`);
    throw new Error(`Failed to get subscription details: ${error.message}`);
  }
};

/**
 * Create checkout session
 * @param {string} customerId - Stripe customer ID
 * @param {string} priceId - Stripe price ID
 * @param {string} successUrl - Success redirect URL
 * @param {string} cancelUrl - Cancel redirect URL
 * @returns {Promise<Object>} Checkout session
 */
const createCheckoutSession = async (customerId, priceId, successUrl, cancelUrl) => {
  if (!process.env.STRIPE_SECRET_KEY) {
    throw new Error('Stripe not configured');
  }

  if (!priceId) {
    throw new Error('Stripe price ID is required. Make sure STRIPE_MONTHLY_PRICE_ID or STRIPE_YEARLY_PRICE_ID environment variables are set with valid Stripe price IDs.');
  }

  try {
    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      payment_method_types: ['card'],
      line_items: [
        {
          price: priceId,
          quantity: 1
        }
      ],
      mode: 'subscription',
      success_url: successUrl,
      cancel_url: cancelUrl,
      metadata: {
        customerId
      }
    });

    return session;
  } catch (error) {
    logger.error(`Create Stripe checkout session error: ${error.message}`);
    throw new Error(`Failed to create checkout session: ${error.message}`);
  }
};

/**
 * Create portal session for customer management
 * @param {string} customerId - Stripe customer ID
 * @param {string} returnUrl - Return URL
 * @returns {Promise<Object>} Portal session
 */
const createPortalSession = async (customerId, returnUrl) => {
  if (!process.env.STRIPE_SECRET_KEY) {
    throw new Error('Stripe not configured');
  }

  try {
    const session = await stripe.billingPortal.sessions.create({
      customer: customerId,
      return_url: returnUrl
    });

    return session;
  } catch (error) {
    logger.error(`Create Stripe portal session error: ${error.message}`);
    throw new Error(`Failed to create portal session: ${error.message}`);
  }
};

/**
 * Verify webhook signature
 * @param {string} payload - Raw request body
 * @param {string} signature - Stripe signature header
 * @returns {Object} Webhook event
 */
const verifyWebhook = (payload, signature) => {
  if (!process.env.STRIPE_WEBHOOK_SECRET) {
    throw new Error('Stripe webhook secret not configured');
  }

  try {
    const event = stripe.webhooks.constructEvent(
      payload,
      signature,
      process.env.STRIPE_WEBHOOK_SECRET
    );
    return event;
  } catch (error) {
    logger.error(`Stripe webhook verification error: ${error.message}`);
    throw new Error(`Webhook verification failed: ${error.message}`);
  }
};

module.exports = {
  stripe,
  createCustomer,
  createSubscription,
  cancelSubscription,
  getSubscription,
  createCheckoutSession,
  createPortalSession,
  verifyWebhook
};