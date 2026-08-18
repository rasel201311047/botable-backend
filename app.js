const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const rateLimit = require('express-rate-limit');
// const mongoSanitize = require('express-mongo-sanitize'); // Removed: incompatible with Express 5
// const xss = require('xss-clean'); // Removed: incompatible with Express 5
const path = require('path');

// Import configuration
require('dotenv').config();
require('./config/db');

// Import services for initialization
const SubscriptionService = require('./modules/subscription/subscription.service');

// Initialize subscription plans on startup
SubscriptionService.initializeDefaultPlans().catch(err => {
  console.error('Failed to initialize subscription plans:', err);
});

// Import middleware
const errorMiddleware = require('./middlewares/error.middleware');

// Import routes
const authRoutes = require('./modules/auth/auth.routes');
const userRoutes = require('./modules/user/user.routes');
const onboardingRoutes = require('./modules/onboarding/onboarding.routes');
const nutritionRoutes = require('./nutrition/nutrition.routes');
const aiRoutes = require('./modules/ai/ai.routes');
const subscriptionRoutes = require('./modules/subscription/subscription.routes');
const notificationRoutes = require('./modules/notification/notification.routes');
const contentRoutes = require('./modules/content/content.routes');
const sleepRecoveryRoutes = require('./modules/sleep-recovery/sleepRecovery.routes');
const workoutRoutes = require('./modules/workout/workout.routes');
const dashboardRoutes = require('./modules/userDashboard/userdashboard.routes');
const calendarRoutes = require('./modules/calendar/calendar.routes');
const engineRoutes = require('./modules/engine/engine.routes');
const adminRoutes = require('./admin/admin.routes');

const app = express();

// Security middleware
app.use(helmet({
  crossOriginResourcePolicy: { policy: "cross-origin" }
}));

// CORS configuration
const allowedOrigins = (process.env.CORS_ORIGIN || '')
  .split(',')
  .map(origin => origin.trim())
  .filter(Boolean);

app.use(cors({
  origin: (origin, callback) => {
    if (!origin) return callback(null, true);
    if (process.env.NODE_ENV !== 'production' || allowedOrigins.includes(origin)) {
      return callback(null, true);
    }
    return callback(new Error('CORS not allowed'), false);
  },
}));

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100 // limit each IP to 100 requests per windowMs
});
app.use('/api', limiter);

// Body parsing middleware
app.use(express.json({
  limit: '10kb',
  verify: (req, res, buf, encoding) => {
    req.rawBody = buf.toString(encoding || 'utf8');
  },
}));
app.use(express.urlencoded({ extended: true, limit: '10kb' }));

// Custom data sanitization against NoSQL injection (Express 5 compatible)
const mongoSanitizeMiddleware = (req, res, next) => {
  const sanitize = (obj) => {
    if (obj && typeof obj === 'object') {
      for (const key in obj) {
        if (key.startsWith('$')) {
          delete obj[key];
        } else if (typeof obj[key] === 'object') {
          sanitize(obj[key]);
        }
      }
    }
  };

  if (req.body) sanitize(req.body);
  if (req.query) sanitize(req.query);
  if (req.params) sanitize(req.params);

  next();
};
app.use(mongoSanitizeMiddleware);

// Custom data sanitization against XSS (Express 5 compatible)
const xssSanitizeMiddleware = (req, res, next) => {
  const sanitize = (obj) => {
    if (obj && typeof obj === 'object') {
      for (const key in obj) {
        if (typeof obj[key] === 'string') {
          // Basic XSS sanitization: escape HTML characters but keep forward slashes
          obj[key] = obj[key]
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#x27;');
          // Removed: .replace(/\//g, '&#x2F;') - forward slashes are needed for timezones
        } else if (typeof obj[key] === 'object') {
          sanitize(obj[key]);
        }
      }
    }
  };

  if (req.body) sanitize(req.body);
  // Note: Not sanitizing req.query and req.params as they are read-only in Express 5

  next();
};
app.use(xssSanitizeMiddleware);

// Logging in development
if (process.env.NODE_ENV === 'development') {
  app.use(morgan('dev'));
}

// Static files (for backward compatibility with local uploads)
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.status(200).json({
    status: 'success',
    message: 'Server is running',
    timestamp: new Date().toISOString()
  });
});

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/onboarding', onboardingRoutes);
app.use('/api/nutrition', nutritionRoutes);
app.use('/api/sleep-recovery', sleepRecoveryRoutes);
app.use('/api/workouts', workoutRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/calendar', calendarRoutes);
app.use('/api/engine', engineRoutes);
app.use('/api/ai', aiRoutes);
app.use('/api/subscription', subscriptionRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api', contentRoutes);
// Admin Routes
app.use('/api/admin', adminRoutes);

// Error handling middleware (should be last)
app.use(errorMiddleware);

// 404 handler
app.use((req, res) => {
  res.status(404).json({
    status: 'error',
    message: `Can't find ${req.originalUrl} on this server!`
  });
});

module.exports = app;
