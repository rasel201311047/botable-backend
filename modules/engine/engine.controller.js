const jwt = require('jsonwebtoken');
const User = require('../user/user.model');
const SubscriptionService = require('../subscription/subscription.service');
const WellnessEngine = require('./wellnessEngine.service');
const logger = require('../../utils/logger');

const getTokenFromRequest = (req) => {
  if (req.headers.authorization?.startsWith('Bearer ')) {
    return req.headers.authorization.split(' ')[1];
  }

  return null;
};

const readSession = async (req) => {
  const token = getTokenFromRequest(req);
  if (!token) {
    return { authenticated: false, tokenValid: false, user: null };
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findById(decoded.id).select('-password');
    if (!user) {
      return { authenticated: false, tokenValid: false, user: null };
    }

    return { authenticated: true, tokenValid: true, user };
  } catch (error) {
    logger.warn(`Startup token check failed: ${error.message}`);
    return { authenticated: false, tokenValid: false, user: null };
  }
};

class EngineController {
  static async getStartupState(req, res, next) {
    try {
      const session = await readSession(req);

      if (!session.authenticated) {
        return res.status(200).json({
          status: 'success',
          data: {
            authenticated: false,
            tokenValid: session.tokenValid,
            nextRoute: '/sign-in',
          },
        });
      }

      const user = session.user;
      const subscription = await SubscriptionService.getUserSubscription(user._id).catch(() => null);

      let nextRoute = '/';
      if (!user.isEmailVerified) {
        nextRoute = '/verification';
      } else if (!user.onboardingCompleted || !user.shiftType || !user.goalType) {
        nextRoute = '/onboarding';
      } else if (!subscription?.isActive && user.subscription?.plan !== 'free') {
        nextRoute = '/subscription';
      }

      return res.status(200).json({
        status: 'success',
        data: {
          authenticated: true,
          tokenValid: true,
          nextRoute,
          accountStatus: user.accountStatus,
          onboardingCompleted: user.onboardingCompleted,
          profile: {
            id: user._id,
            name: user.name,
            email: user.email,
            shiftType: user.shiftType,
            goalType: user.goalType,
            profilePhoto: user.profilePhoto,
          },
          subscription,
          featureFlags: {
            premiumAi: Boolean(subscription?.isActive),
          },
        },
      });
    } catch (error) {
      next(error);
    }
  }

  static async getContext(req, res, next) {
    try {
      const context = await WellnessEngine.buildContext(req.user.id);
      const actionPlan = await WellnessEngine.buildActionPlan(req.user.id);

      res.status(200).json({
        status: 'success',
        data: {
          context,
          actionPlan,
        },
      });
    } catch (error) {
      next(error);
    }
  }
}

module.exports = EngineController;
