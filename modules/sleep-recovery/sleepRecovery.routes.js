const express = require('express');
const router = express.Router();
const SleepRecoveryController = require('./sleepRecovery.controller');
const { protect, admin } = require('../../middlewares/auth.middleware');

// Recovery activities
router.get('/activities', protect, SleepRecoveryController.getRecoveryActivities);

// Sleep logs
router.post('/log', protect, SleepRecoveryController.logActivity);
router.get('/logs', protect, SleepRecoveryController.getSleepLogs);
router.get('/logs/:id', protect, SleepRecoveryController.getSleepLogById);
router.put('/logs/:id', protect, SleepRecoveryController.updateSleepLog);
router.delete('/logs/:id', protect, SleepRecoveryController.deleteSleepLog);

// Statistics and scores
router.get('/stats', protect, SleepRecoveryController.getSleepStats);
router.get('/score', protect, SleepRecoveryController.getSleepScore);

// Admin routes
router.post('/seed', protect, admin, SleepRecoveryController.seedDefaultActivities);

module.exports = router;