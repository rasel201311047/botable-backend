const DashboardService = require('./userdashboard.service');

class DashboardController {
  /**
   * @desc    Get home dashboard data
   * @route   GET /api/dashboard/home
   * @access  Private
   */
  static async getHomeDashboard(req, res, next) {
    try {
      const data = await DashboardService.getHomeDashboard(req.user.id);

      res.status(200).json({
        status: 'success',
        data
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * @desc    Get dashboard statistics
   * @route   GET /api/dashboard/stats
   * @access  Private
   */
  static async getDashboardStats(req, res, next) {
    try {
      const { period = 'week' } = req.query;
      
      const stats = await DashboardService.getDashboardStats(req.user.id, period);

      res.status(200).json({
        status: 'success',
        data: stats
      });
    } catch (error) {
      next(error);
    }
  }
}

module.exports = DashboardController;