const logger = require('../../utils/logger');

// In a real application, you would have a Settings model
// For now, we'll use a simple object
let appSettings = {
  appName: 'Bootble',
  maintenanceMode: false,
  registrationEnabled: true,
  maxFileSize: 5, // MB
  allowedFileTypes: ['jpg', 'jpeg', 'png', 'gif'],
  emailNotifications: true,
  pushNotifications: true,
  defaultShift: 'rotating',
  defaultGoal: 'maintenance',
  calorieCalculationMethod: 'mifflin_st_jeor',
  stripeEnabled: true,
  usdaApiEnabled: true,
  aiSuggestionsEnabled: true,
  createdAt: new Date(),
  updatedAt: new Date()
};

class AdminSettingsController {
  /**
   * @desc    Get application settings
   * @route   GET /api/admin/settings
   * @access  Private/Admin
   */
  static async getSettings(req, res, next) {
    try {
      res.status(200).json({
        status: 'success',
        data: appSettings
      });
    } catch (error) {
      logger.error(`Admin get settings error: ${error.message}`);
      next(error);
    }
  }

  /**
   * @desc    Update application settings
   * @route   PUT /api/admin/settings
   * @access  Private/Admin
   */
  static async updateSettings(req, res, next) {
    try {
      const updateData = req.body;

      // Update settings
      appSettings = {
        ...appSettings,
        ...updateData,
        updatedAt: new Date()
      };

      // In a real application, you would save to database
      // await Settings.findOneAndUpdate({}, appSettings, { upsert: true });

      res.status(200).json({
        status: 'success',
        message: 'Settings updated successfully',
        data: appSettings
      });
    } catch (error) {
      logger.error(`Admin update settings error: ${error.message}`);
      next(error);
    }
  }
}

module.exports = AdminSettingsController;
