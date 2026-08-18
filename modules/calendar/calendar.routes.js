const express = require('express');
const router = express.Router();
const CalendarController = require('./calendar.controller');
const { protect } = require('../../middlewares/auth.middleware');

// Calendar views
router.get('/month', protect, CalendarController.getMonthView);
router.get('/day', protect, CalendarController.getDailyTimeline);

// Schedule management
router.post('/generate', protect, CalendarController.generateSchedule);
router.put('/schedule', protect, CalendarController.updateSchedule);
router.get('/stats', protect, CalendarController.getScheduleStats);

// Event management
router.post('/reschedule', protect, CalendarController.rescheduleEvent);
router.post('/complete', protect, CalendarController.completeEvent);
router.get('/upcoming', protect, CalendarController.getUpcomingEvents);

module.exports = router;