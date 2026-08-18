const AuthController = require('../../modules/auth/auth.controller');

class AdminAuthController {
  /**
   * @desc    Admin login
   * @route   POST /api/admin/login
   * @access  Public
   */
  static async login(req, res, next) {
    // For now, use the regular auth controller
    // In production, this should have separate admin authentication logic
    return AuthController.login(req, res, next);
  }
}

module.exports = AdminAuthController;