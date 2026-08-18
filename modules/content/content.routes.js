const express = require('express');
const router = express.Router();
const ContentController = require('./content.controller');
const { protect } = require('../../middlewares/auth.middleware');

// Optional auth middleware - attaches user if token present but doesn't fail if missing
const optionalAuth = async (req, res, next) => {
  try {
    const token = req.headers.authorization?.startsWith('Bearer') 
      ? req.headers.authorization.split(' ')[1] 
      : null;
    
    if (token) {
      const jwt = require('jsonwebtoken');
      const User = require('../user/user.model');
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      const user = await User.findById(decoded.id).select('-password');
      if (user && user.isActive) {
        req.user = user;
      }
    }
  } catch (error) {
    // Ignore auth errors for optional auth
  }
  next();
};

// Public routes - anyone can view content
router.get('/content/terms', ContentController.getTerms);
router.get('/content/privacy', ContentController.getPrivacy);
router.get('/content/faqs', ContentController.getFaqs);

// Public route - anyone can submit contact (auth optional)
router.post('/contact-support', optionalAuth, ContentController.submitContact);

// Private route - view own contact messages
router.get('/my-contacts', protect, ContentController.getMyContacts);

module.exports = router;
