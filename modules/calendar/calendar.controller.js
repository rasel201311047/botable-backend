const CalendarService = require('./calendar.service');

class CalendarController {
  /**
   * @desc    Get month view
   * @route   GET /api/calendar/month
   * @access  Private
   */
  static async getMonthView(req, res, next) {
    try {
      const { year, month } = req.query;
      const currentDate = new Date();
      
      const targetYear = parseInt(year) || currentDate.getFullYear();
      const targetMonth = parseInt(month) || currentDate.getMonth() + 1;

      const monthData = await CalendarService.getMonthView(
        req.user.id,
        targetYear,
        targetMonth
      );

      res.status(200).json({
        status: 'success',
        data: monthData
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * @desc    Get daily timeline
   * @route   GET /api/calendar/day
   * @access  Private
   */
  static async getDailyTimeline(req, res, next) {
    try {
      const { date, filter = 'all' } = req.query;
      const targetDate = date || new Date().toISOString().split('T')[0];

      const timeline = await CalendarService.getDailyTimeline(
        req.user.id,
        targetDate,
        filter
      );

      res.status(200).json({
        status: 'success',
        data: timeline
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * @desc    Reschedule event
   * @route   POST /api/calendar/reschedule
   * @access  Private
   */
  static async rescheduleEvent(req, res, next) {
    try {
      const { eventType, eventId, newTime } = req.body;

      if (!eventType || !eventId || !newTime) {
        return res.status(400).json({
          status: 'error',
          message: 'Event type, event ID, and new time are required'
        });
      }

      const updatedEvent = await CalendarService.rescheduleEvent(
        req.user.id,
        { eventType, eventId, newTime }
      );

      res.status(200).json({
        status: 'success',
        message: 'Event rescheduled successfully',
        data: updatedEvent
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * @desc    Complete event
   * @route   POST /api/calendar/complete
   * @access  Private
   */
  static async completeEvent(req, res, next) {
    try {
      const { eventType, eventId, date, time } = req.body;

      if (!eventType || !eventId) {
        return res.status(400).json({
          status: 'error',
          message: 'Event type and event ID are required'
        });
      }

      const completedEvent = await CalendarService.completeEvent(
        req.user.id,
        { eventType, eventId, date, time }
      );

      res.status(200).json({
        status: 'success',
        message: 'Event marked as completed successfully',
        data: completedEvent
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * @desc    Get upcoming events
   * @route   GET /api/calendar/upcoming
   * @access  Private
   */
  static async getUpcomingEvents(req, res, next) {
    try {
      const { days = 7 } = req.query;

      const events = await CalendarService.getUpcomingEvents(
        req.user.id,
        parseInt(days)
      );

      res.status(200).json({
        status: 'success',
        data: events
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * @desc    Update schedule manually
   * @route   PUT /api/calendar/schedule
   * @access  Private
   */
  static async updateSchedule(req, res, next) {
    try {
      const { date, dayType, shiftStart, shiftEnd, notes } = req.body;

      if (!date || !dayType) {
        return res.status(400).json({
          status: 'error',
          message: 'Date and day type are required'
        });
      }

      const schedule = await CalendarService.updateSchedule(
        req.user.id,
        date,
        { dayType, shiftStart, shiftEnd, notes }
      );

      res.status(200).json({
        status: 'success',
        message: 'Schedule updated successfully',
        data: schedule
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * @desc    Generate schedule
   * @route   POST /api/calendar/generate
   * @access  Private
   */
  static async generateSchedule(req, res, next) {
    try {
      const { startDate, endDate } = req.body;
      const currentDate = new Date();

      const targetStartDate = startDate || currentDate.toISOString().split('T')[0];
      const targetEndDate = endDate || new Date(currentDate.setMonth(currentDate.getMonth() + 1))
        .toISOString().split('T')[0];

      const schedule = await CalendarService.generateSchedule(
        req.user.id,
        targetStartDate,
        targetEndDate
      );

      res.status(200).json({
        status: 'success',
        message: 'Schedule generated successfully',
        data: schedule
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * @desc    Get schedule statistics
   * @route   GET /api/calendar/stats
   * @access  Private
   */
  static async getScheduleStats(req, res, next) {
    try {
      const { startDate, endDate } = req.query;
      const currentDate = new Date();

      const targetStartDate = startDate || 
        new Date(currentDate.setDate(currentDate.getDate() - 30))
          .toISOString().split('T')[0];
      const targetEndDate = endDate || new Date().toISOString().split('T')[0];

      const stats = await CalendarService.getScheduleStats(
        req.user.id,
        targetStartDate,
        targetEndDate
      );

      res.status(200).json({
        status: 'success',
        data: stats
      });
    } catch (error) {
      next(error);
    }
  }
}

module.exports = CalendarController;