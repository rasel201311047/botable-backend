const jwt = require('jsonwebtoken');
const User = require('../modules/user/user.model');
const SubscriptionService = require('../modules/subscription/subscription.service');
const logger = require('../utils/logger');

/**
 * Protect routes - verify JWT token
 */
const protect = async (req, res, next) => {
  let token;

  // Get token from header
  if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
    token = req.headers.authorization.split(' ')[1];
  }

  if (!token) {
    return res.status(401).json({
      status: 'error',
      message: 'Not authorized to access this route'
    });
  }

  try {
    // Verify token
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    // Get user from database
    const user = await User.findById(decoded.id).select('-password');

    if (!user) {
      return res.status(401).json({
        status: 'error',
        message: 'User not found'
      });
    }

    // Check if user is active
    if (!user.isActive) {
      return res.status(401).json({
        status: 'error',
        message: 'Account is deactivated'
      });
    }

    // Check password version to invalidate stale sessions (on password change)
    const tokenVersion = decoded.passwordVersion || 1;
    const userVersion = user.passwordVersion || 1;
    if (tokenVersion !== userVersion) {
      return res.status(401).json({
        status: 'error',
        message: 'Session expired due to password change. Please sign in again.'
      });
    }

    // Check if email is verified to prevent orphaned data/inconsistent states
    const allowedUnverifiedRoutes = [
      '/me',
      '/resend-otp',
      '/verify-email',
      '/change-email',
      '/logout'
    ];
    const isAllowed = allowedUnverifiedRoutes.some(route => req.originalUrl.includes(route));
    if (!user.isEmailVerified && !isAllowed) {
      return res.status(403).json({
        status: 'error',
        message: 'Email verification is required to access this resource.'
      });
    }

    req.user = user;
    next();
  } catch (error) {
    logger.error(`Auth middleware error: ${error.message}`);

    if (error.name === 'JsonWebTokenError') {
      return res.status(401).json({
        status: 'error',
        message: 'Invalid token'
      });
    }

    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({
        status: 'error',
        message: 'Token expired'
      });
    }

    return res.status(500).json({
      status: 'error',
      message: 'Server error'
    });
  }
};

/**
 * Admin middleware - verify user is admin
 */
const admin = (req, res, next) => {
  if (req.user && req.user.role === 'admin') {
    next();
  } else {
    res.status(403).json({
      status: 'error',
      message: 'Not authorized as admin'
    });
  }
};

/**
 * Subscription middleware - check if user has active subscription
 */
const requireSubscription = async (req, res, next) => {
  try {
    const hasPremiumAccess = await SubscriptionService.hasPremiumAccess(req.user.id);

    if (!hasPremiumAccess) {
      return res.status(402).json({
        status: 'error',
        message: 'Subscription required for this feature'
      });
    }

    next();
  } catch (error) {
    logger.error(`Subscription middleware error: ${error.message}`);
    res.status(500).json({
      status: 'error',
      message: 'Server error'
    });
  }
};

module.exports = {
  protect,
  admin,
  requireSubscription
};
