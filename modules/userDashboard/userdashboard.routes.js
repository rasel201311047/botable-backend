const express = require('express');
const router = express.Router();
const DashboardController = require('./userdashboard.controller');
const { protect } = require('../../middlewares/auth.middleware');

// Protected routes
router.get('/home', protect, DashboardController.getHomeDashboard);
router.get('/stats', protect, DashboardController.getDashboardStats);

module.exports = router;